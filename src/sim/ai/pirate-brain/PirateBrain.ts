/**
 * PirateBrain — the simpler counterpart to PredatorBrain.
 *
 * Pirates are mechanical antagonists (lantern-equipped marauders, not
 * organic predators) so their AI is deliberately less rich:
 *
 * - Wandering patrol (WanderBehavior) until the player crosses the
 *   lantern cone.
 * - On detect: switch to PursuitBehavior with a speed boost. The
 *   `awareness` field ramps to 1, making the lantern flicker red
 *   in the renderer so the player visually knows they've been
 *   spotted.
 * - Awareness decays smoothly over time when the player exits the
 *   cone — the pirate does NOT instantly drop back to patrol; it
 *   chases for a few more seconds, sells the "they saw me" beat.
 *
 * Yuka pieces used:
 *   Vehicle, SteeringManager (Wander + Pursuit + Separation +
 *   WrapPlayBand), Time-based awareness decay tracked on the brain
 *   itself (no full StateMachine since the binary patrol/pursue
 *   transition is trivial enough to express as a scalar).
 *
 * The lantern cone geometry mirrors what `entities.ts:drawPirate`
 * draws: forward-pointing wedge with `coneLength` reach and
 * `coneHalfAngle` spread. Detection inverts that test — is the
 * player inside MY cone — and is recomputed every tick.
 */
import {
  PursuitBehavior,
  SeparationBehavior,
  Vector3,
  Vehicle,
  WanderBehavior,
} from "yuka";
import { WrapPlayBandBehavior } from "@/sim/ai/steering";
import { perceives, type PerceptionContext, type PerceiverProfile } from "@/sim/ai/perception/perception";

/** Cone geometry — mirrors the renderer's lantern wedge. */
const CONE_LENGTH_PX = 220;
const CONE_HALF_ANGLE = Math.PI / 5; // ~36°
/** Pre-built profile so we don't allocate per cone-test. */
const PIRATE_CONE_PROFILE: PerceiverProfile = {
  radiusPx: CONE_LENGTH_PX,
  coneHalfAngleRad: CONE_HALF_ANGLE,
};
/** Awareness ramps up at this rate while the player is in cone. */
const AWARENESS_RAMP_PER_SECOND = 2.5;
/** Decay rate while player is OUT of cone. Asymmetric so pursuit
 *  has stickiness ("they saw me, they're still chasing"). */
const AWARENESS_DECAY_PER_SECOND = 0.6;
/** Once awareness exceeds this, the brain activates pursuit. */
const PURSUE_THRESHOLD = 0.4;
/** Below this, patrol resumes. The hysteresis gap stops a player
 *  hovering at the edge from rapidly toggling pursue. */
const PATROL_THRESHOLD = 0.15;

/** Multiplier on baseSpeed when pursuing. */
const PURSUIT_SPEED_BOOST = 1.55;

interface PirateSteeringSlots {
  wander: WanderBehavior;
  pursue: PursuitBehavior;
  separation: SeparationBehavior;
  wrap: WrapPlayBandBehavior;
}

const _toPlayer = new Vector3();

export class PirateBrain extends Vehicle {
  /** Reference to the shared player vehicle so pursuit can target it. */
  private playerRef: Vehicle | null = null;
  /** 0..1 awareness — drives renderer state + pursuit toggle. */
  public awareness = 0;
  /** True for exactly one tick when awareness crosses
   *  PURSUE_THRESHOLD on the rising edge. The AIManager surfaces
   *  this so the runtime can fire a one-shot pirate-alert SFX. */
  public justAlerted = false;
  /** Patrol baseline speed; pursue uses PURSUIT_SPEED_BOOST × this. */
  private baseSpeed: number;
  private slots: PirateSteeringSlots;

  constructor(id: string, baseSpeed: number, viewportWidth: number, noiseOffset: number) {
    super();
    this.name = id;
    this.baseSpeed = baseSpeed;
    this.maxSpeed = baseSpeed;
    this.maxForce = 600;

    const wander = new WanderBehavior(noiseOffset);
    wander.weight = 1;
    wander.active = true;

    // Placeholder evader — overwritten when attachPlayer wires the
    // real player vehicle. See PredatorBrain for the same pattern.
    const pursue = new PursuitBehavior(this);
    pursue.weight = 1.4;
    pursue.active = false;

    const separation = new SeparationBehavior();
    separation.weight = 0.6;
    separation.active = true;

    const wrap = new WrapPlayBandBehavior(viewportWidth);

    this.steering.add(wander);
    this.steering.add(pursue);
    this.steering.add(separation);
    this.steering.add(wrap);

    this.slots = { wander, pursue, separation, wrap };
  }

  attachPlayer(player: Vehicle): void {
    this.playerRef = player;
    this.slots.pursue.evader = player;
  }

  /**
   * Per-tick update. AIManager calls this BEFORE EntityManager
   * integrates positions so the steering weight toggle is in place
   * for the integration step.
   */
  tick(delta: number): void {
    const inCone = this._isPlayerInCone();
    const ramp = inCone ? AWARENESS_RAMP_PER_SECOND : -AWARENESS_DECAY_PER_SECOND;
    this.awareness = Math.max(0, Math.min(1, this.awareness + ramp * delta));

    // Reset justAlerted by default; only the rising-edge branch
    // below sets it true for one tick.
    this.justAlerted = false;

    // Hysteresis state machine in two scalar branches: above the
    // pursue threshold → pursue; below the patrol threshold → patrol;
    // in between → keep current behaviour. Avoids ping-pong on cone
    // edges.
    if (this.awareness > PURSUE_THRESHOLD && !this.slots.pursue.active) {
      this.slots.pursue.active = true;
      this.slots.wander.active = false;
      this.maxSpeed = this.baseSpeed * PURSUIT_SPEED_BOOST;
      this.justAlerted = true;
    } else if (this.awareness < PATROL_THRESHOLD && this.slots.pursue.active) {
      this.slots.pursue.active = false;
      this.slots.wander.active = true;
      this.maxSpeed = this.baseSpeed;
    }
  }

  /**
   * Perception context for the current tick. AIManager publishes this
   * via `attachPerception()` immediately before the brain ticks. Null
   * in unit tests that construct a brain without an AIManager; the
   * cone test then falls back to local geometry.
   */
  public perceptionContext: PerceptionContext | null = null;

  private _isPlayerInCone(): boolean {
    if (!this.playerRef) return false;
    if (this.perceptionContext) {
      // Same radius + cone profile, plus LoS through the shared
      // occluder set. A pirate cannot see the player through debris,
      // a leviathan, or a locked-room wall.
      return perceives(
        this.perceptionContext,
        {
          x: this.position.x,
          y: this.position.y,
          headingRad: Math.atan2(this.forward.y, this.forward.x),
        },
        PIRATE_CONE_PROFILE,
        { x: this.playerRef.position.x, y: this.playerRef.position.y },
      );
    }
    // Legacy fallback (unit tests without an AIManager).
    _toPlayer.copy(this.playerRef.position).sub(this.position);
    const distSq = _toPlayer.x * _toPlayer.x + _toPlayer.y * _toPlayer.y;
    if (distSq > CONE_LENGTH_PX * CONE_LENGTH_PX) return false;
    const dist = Math.sqrt(distSq);
    if (dist < 0.01) return true; // touching → in cone
    _toPlayer.divideScalar(dist);
    const dot = this.forward.dot(_toPlayer);
    return dot >= Math.cos(CONE_HALF_ANGLE);
  }
}
