/**
 * PredatorBrain — the core Yuka-driven AI for every predator in the
 * trench.
 *
 * This class composes the full Yuka stack the codebase needs to feel
 * emergent rather than scripted:
 *
 * - **Vehicle** base — gives us position, velocity, maxSpeed, maxForce,
 *   a SteeringManager, and integration with EntityManager.
 *
 * - **StateMachine** with seven concrete states (patrol, stalk, charge,
 *   strike, recover, flee, ambient). Each State extends Yuka's State
 *   and reads/writes the brain's steering weights so a state change
 *   produces a visible behaviour change.
 *
 * - **MemorySystem** — records the player's last sensed position so the
 *   brain can chase out of line-of-sight. Memory expires per
 *   `profile.memorySpanSeconds`, mimicking real predator persistence.
 *
 * - **Vision** — gates "did I see the player this tick" via the
 *   archetype's `fovRadians` cone + distance check.
 *
 * - **FuzzyModule** — combines distance, recent damage taken, and
 *   pack-mate count into a single 0..1 "should I commit to attack"
 *   desirability. The stalk state polls this each frame, charge fires
 *   when desirability crosses 0.65.
 *
 * - **MessageDispatcher (via sendMessage)** — when one brain enters
 *   stalk it broadcasts an `ENGAGE` telegram. Other brains within
 *   1.5× detection radius react by entering stalk a tick later from a
 *   flank angle. The renderer sees a synchronised pack press, not three
 *   independent predators all going at the player from the same vector.
 *
 * - **SteeringBehaviors**: Pursuit (charge target), Seek (last known
 *   position), Wander (patrol), Flee (escape from player), Separation
 *   (don't bunch up with packmates), ObstacleAvoidance (skip the
 *   player sub bounds while in patrol).
 *
 * The single behaviour-toggle pattern keeps the code readable: each
 * State's enter()/exit() calls the brain's activateXxxBehaviour /
 * deactivateXxxBehaviour, and the brain owns a stable list of all
 * SteeringBehavior instances. Toggling `.active` on each is cheaper
 * than churning the list every transition.
 */
import {
  AlignmentBehavior,
  ArriveBehavior,
  FleeBehavior,
  FuzzyAND,
  FuzzyModule,
  FuzzyRule,
  FuzzyVariable,
  LeftShoulderFuzzySet,
  MemorySystem,
  PursuitBehavior,
  RightShoulderFuzzySet,
  SeekBehavior,
  SeparationBehavior,
  StateMachine,
  type Telegram,
  TriangularFuzzySet,
  Vector3,
  Vehicle,
  WanderBehavior,
} from "yuka";
import type { PredatorAiState } from "@/sim/entities/types";
import {
  AmbientState,
  ChargeState,
  FleeState,
  PatrolState,
  RecoverState,
  StalkState,
  StrikeState,
  AMBIENT,
  CHARGE,
  FLEE,
  PATROL,
  RECOVER,
  STALK,
  STRIKE,
} from "./states";
import type { PredatorArchetypeProfile } from "./types";
import { perceives, predatorProfile, type PerceptionContext } from "../perception/perception";

const TELEGRAM_FLANK = "flank";

/**
 * Steering behaviour catalogue per brain. We hold strong refs so the
 * states can flip `.active` without rebuilding the steering list.
 */
interface PredatorSteeringSlots {
  wander: WanderBehavior;
  arrive: ArriveBehavior;
  pursue: PursuitBehavior;
  seek: SeekBehavior;
  flee: FleeBehavior;
  separation: SeparationBehavior;
  alignment: AlignmentBehavior;
}

export class PredatorBrain extends Vehicle {
  public readonly profile: PredatorArchetypeProfile;
  public readonly stateMachine: StateMachine<PredatorBrain>;
  public readonly memorySystem: MemorySystem;
  public readonly fuzzy: FuzzyModule;
  public readonly lastKnownPlayerPosition = new Vector3();

  /** Mirrored each tick from StateMachine for the renderer. */
  public currentAiState: PredatorAiState = "ambient";
  public currentStateProgress = 0;
  /**
   * Perception context for the current tick. Set by AIManager
   * immediately before this brain ticks. Defaults to an empty context
   * so a brain constructed in a unit test (no AIManager) still has
   * a valid context to read from — the empty occluder list means
   * `perceives()` runs the radius + cone test only, matching the
   * pre-perception semantics of `canSeePlayer`.
   */
  public perceptionContext: PerceptionContext = { occluders: [] };

  /** The shared player vehicle (reference, not copy). */
  private playerRef: Vehicle | null = null;

  /** Spawn anchor used by patrol-state to roam around. */
  private patrolAnchor = new Vector3();

  /** When the brain last took damage. Drives flee transitions + the
   *  fuzzy desirability "recent pain" axis. Also read by the lamp-
   *  pressure pass in AIManager to avoid spamming damage every frame
   *  while the cone overlaps. */
  public lastDamageReceivedTime = -Infinity;

  /**
   * Hull integrity 0..1. Lamp pressure deducts a fixed amount per
   * hit; reaching 0 retires the brain (caller checks `isDead()`).
   * The renderer reads this via the Predator entity's `aiState` +
   * a future `damage` field — for now, falling HP just steepens the
   * fuzzy "recentPain" weight so a damaged predator gets visibly
   * less aggressive before it finally breaks off.
   */
  public hp = 1;

  /**
   * How much HP the lamp removes per damage pulse. Tuned so a player
   * holding the lamp on a single predator for ~1.5 cone-cooldowns
   * (≈ 1.8s of focused pressure) breaks it. Wider archetypes have
   * thicker hides so they take longer.
   */
  public readonly lampDamagePerHit = 0.34;

  /**
   * Total seconds the death animation should run for after HP hits
   * 0. The brain stops responding to inputs (no state transitions,
   * no pursuit) and the renderer drives the sink-and-fade. After
   * this elapses, AIManager prunes the brain.
   */
  public readonly deathAnimationSeconds = 0.7;

  /** Wall time when HP hit 0. POSITIVE_INFINITY = still alive. */
  public deathStartTime = Number.POSITIVE_INFINITY;

  /**
   * Biome aggression multiplier (1.0 baseline at photic-gate, scales
   * up with depth). Applied to detectionRadius, charge windup
   * (inverted — deeper = shorter telegraph), strike speed, and
   * fuzzy desirability. Set every tick by AIManager from the
   * current player depth.
   *
   * 1.0 = surface (epipelagic), 1.6 = the hadal. Tuned so a player
   * descending notices a sharp tonal shift — the deeper biomes don't
   * just look more dangerous, they ACT more dangerous.
   */
  public biomeAggression = 1;

  /** Set true once AIManager has issued the loot drop for this brain;
   *  prevents the drop from re-firing each frame the brain is dying. */
  public lootDropped = false;

  /** Wall time of the most recent broadcastEngage. AIManager reads
   *  this to schedule the pack-call SFX once per broadcast. */
  public lastEngageBroadcastAt = -Infinity;

  /**
   * When set, StalkState seeks this position instead of pursuing the
   * player directly. Cleared on transition out of stalk. Used by the
   * pack-flank telegram so recipients close from an offset angle
   * rather than mirroring the engager's vector.
   */
  private flankPosition: Vector3 | null = null;

  /** All packmates in the same chunk. Wired by AIManager so flank
   *  broadcasts don't have to walk the whole entity manager. */
  private packMates: PredatorBrain[] = [];

  /** Snapshot of the IDs the most recent broadcastEngage messaged.
   *  Read once by AIManager.recentFlankPairs to draw the converging
   *  arcs in the FX layer. */
  public lastBroadcastedToIds: string[] = [];

  /** Engage broadcast cooldown so we don't spam every tick. */
  private lastBroadcastTime = -Infinity;

  /** The simulation timestamp pushed in by AIManager each tick.
   *  Used by Memory + Fuzzy "recent damage" math. */
  public currentTime = 0;

  /**
   * Hunger model — the predator gets hungrier the longer it goes
   * without committing a strike. `lastStrikeAttemptTime` is stamped
   * by StrikeState.exit; `hungerFactor()` returns the multiplier
   * applied to detection + commit radii. Spawned predators start
   * neutral (factor 1) so a fresh chunk doesn't feel artificially
   * aggressive.
   */
  public lastStrikeAttemptTime = 0;

  /** Time-since-strike at which hunger plateaus at HUNGER_MAX. */
  private static readonly HUNGER_RAMP_SECONDS = 30;
  /** Cap on the hunger multiplier — limits how much harder a long-
   *  starved predator can hit. Tuned so a 30s lull produces a
   *  noticeable but not unfair difficulty bump. */
  private static readonly HUNGER_MAX = 1.5;

  /**
   * 1.0 (well-fed) → HUNGER_MAX (starved). Linear ramp from
   * lastStrikeAttemptTime over HUNGER_RAMP_SECONDS. The renderer
   * reads this via `getHungerFactor()` to draw a faint gaunt/cold
   * tint on starved predators.
   */
  hungerFactor(): number {
    const elapsed = this.currentTime - this.lastStrikeAttemptTime;
    if (elapsed <= 0) return 1;
    const t = Math.min(1, elapsed / PredatorBrain.HUNGER_RAMP_SECONDS);
    return 1 + (PredatorBrain.HUNGER_MAX - 1) * t;
  }

  /** 0..1 normalized hunger — convenient for the renderer's tint
   *  blend. 0 = fed, 1 = max starved. */
  hungerLevel(): number {
    return (this.hungerFactor() - 1) / (PredatorBrain.HUNGER_MAX - 1);
  }

  /** Most recent delta-time tick — read by states' tickElapsed(). */
  public lastDelta = 0;

  /** Steering slots — kept in this stable shape so state transitions
   *  flip `.active` rather than churning the steering list. */
  private slots: PredatorSteeringSlots;

  /** Allocated once + reused. Avoids per-frame allocation in `update`. */

  constructor(
    id: string,
    profile: PredatorArchetypeProfile,
    spawnX: number,
    spawnY: number,
  ) {
    super();
    this.name = id;
    this.position.set(spawnX, spawnY, 0);
    this.patrolAnchor.set(spawnX, spawnY, 0);
    this.profile = profile;
    this.maxSpeed = profile.patrolMaxSpeed;
    this.maxForce = 800; // generous so steering can change direction sharply

    // ---- Memory ----
    this.memorySystem = new MemorySystem();
    this.memorySystem.memorySpan = profile.memorySpanSeconds;

    // ---- Fuzzy module ----
    this.fuzzy = new FuzzyModule();
    this._initFuzzyModule();

    // ---- Steering ----
    this.slots = this._initSteering();

    // ---- StateMachine ----
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add(PATROL, new PatrolState());
    this.stateMachine.add(STALK, new StalkState());
    this.stateMachine.add(CHARGE, new ChargeState());
    this.stateMachine.add(STRIKE, new StrikeState());
    this.stateMachine.add(RECOVER, new RecoverState());
    this.stateMachine.add(FLEE, new FleeState());
    this.stateMachine.add(AMBIENT, new AmbientState());
    this.stateMachine.changeTo(PATROL);
  }

  // ---- Wiring exposed to AIManager ---------------------------------------

  attachPlayer(playerVehicle: Vehicle): void {
    this.playerRef = playerVehicle;
    if (this.memorySystem.hasRecord(playerVehicle) === false) {
      this.memorySystem.createRecord(playerVehicle);
    }
  }

  attachPackMates(packMates: PredatorBrain[]): void {
    this.packMates = packMates;
  }

  pinAsLeviathan(): void {
    this.stateMachine.changeTo(AMBIENT);
  }

  receiveDamage(currentTime: number): void {
    if (this.isDying()) return; // already in death animation
    this.lastDamageReceivedTime = currentTime;
    this.hp = Math.max(0, this.hp - this.lampDamagePerHit);
    if (this.hp <= 0 && this.deathStartTime === Number.POSITIVE_INFINITY) {
      this.deathStartTime = currentTime;
      // Park the brain in flee on death so steering produces a brief
      // backward slide as the body drops. The death animation
      // overrides rendering so the renderer doesn't read the state.
      this.stateMachine.changeTo(FLEE);
    } else if (this.stateMachine.currentState !== this.stateMachine.states.get(STRIKE)) {
      this.stateMachine.changeTo(FLEE);
    }
  }

  /** True the moment HP hits 0; false again after the death
   *  animation window elapses (caller should prune the brain). */
  isDying(): boolean {
    return this.deathStartTime !== Number.POSITIVE_INFINITY;
  }

  /** Prune-eligible: dying long enough that the sink-and-fade is
   *  visually done. */
  isDead(): boolean {
    if (!this.isDying()) return false;
    return this.currentTime - this.deathStartTime > this.deathAnimationSeconds;
  }

  /** 0..1 death progress used by the renderer for sink + fade. */
  deathProgress(): number {
    if (!this.isDying()) return 0;
    return Math.min(1, (this.currentTime - this.deathStartTime) / this.deathAnimationSeconds);
  }

  // ---- Biome-scaled profile accessors ----------------------------------
  // Each one applies `biomeAggression` to its corresponding profile knob
  // so deeper biomes feel meaningfully more dangerous without authoring
  // multiple profiles per archetype × biome.

  /** Detection radius scales LINEARLY with aggression — deeper biomes
   *  see the player from farther away. Multiplied by hungerFactor so
   *  starved predators sense the player from even farther. */
  effectiveDetectionRadius(): number {
    return this.profile.detectionRadiusPx * this.biomeAggression * this.hungerFactor();
  }

  /** Commit radius scales similarly so the predator commits earlier
   *  when stalking from the deep. Hunger pushes commit even earlier
   *  — a starved predator can't afford patience. */
  effectiveCommitRadius(): number {
    return this.profile.commitRadiusPx * this.biomeAggression * this.hungerFactor();
  }

  /** Charge windup INVERSELY scales: deeper biomes shorten the
   *  telegraph, making strikes harder to read. Floored at 0.18s so
   *  the windup is still readable at max aggression. */
  effectiveChargeWindup(): number {
    return Math.max(0.18, this.profile.chargeWindupSeconds / this.biomeAggression);
  }

  /** Strike speed scales LINEARLY — deeper biomes lunge faster. */
  effectiveStrikeSpeed(): number {
    return this.profile.strikeMaxSpeed * this.biomeAggression;
  }

  // ---- Per-tick API ------------------------------------------------------

  tick(delta: number, currentTime: number): void {
    this.lastDelta = delta;
    this.currentTime = currentTime;
    if (this.isDying()) {
      // Dying brains don't update memory or run states — they coast
      // on residual velocity while the renderer animates the
      // sink-and-fade. The body slows continuously so it doesn't
      // skim out of frame at strike speed.
      this.maxSpeed = Math.max(8, this.maxSpeed * 0.92);
      return;
    }
    this._updateMemory();
    this.stateMachine.update();
  }

  // ---- Renderer-bridge publishers — called by states --------------------

  publishAiState(state: PredatorAiState): void {
    this.currentAiState = state;
  }

  publishStateProgress(progress: number): void {
    this.currentStateProgress = progress;
  }

  // ---- Behaviour activation methods called by states -------------------

  activatePatrolBehaviour(): void {
    this.maxSpeed = this.profile.patrolMaxSpeed;
    // If the brain has wandered past its patrol radius, swap to an
    // arrive-back behaviour so it returns to the anchor instead of
    // drifting indefinitely. The next tick's _maybeRecenterPatrol
    // will handle the toggle as the brain moves.
    this._setActive({ wander: true, separation: true });
  }
  deactivatePatrolBehaviour(): void {
    this._setActive({ wander: false, arrive: false });
  }

  /**
   * Called inside PatrolState.execute via the brain's tick loop —
   * swaps wander↔arrive based on whether the brain has strayed past
   * the archetype's patrol radius. Keeps predators rooted to their
   * spawn region so the player can build a mental map of "where they
   * live."
   */
  maintainPatrolAnchor(): void {
    if (this.currentAiState !== "patrol") return;
    const distFromAnchor = this.position.distanceTo(this.patrolAnchor);
    if (distFromAnchor > this.profile.patrolRadiusPx) {
      this.slots.arrive.target.copy(this.patrolAnchor);
      this._setActive({ arrive: true, wander: false });
    } else if (this.slots.arrive.active && distFromAnchor < this.profile.patrolRadiusPx * 0.4) {
      // Reached anchor — resume wandering.
      this._setActive({ arrive: false, wander: true });
    }
  }

  activateStalkBehaviour(): void {
    this.maxSpeed = this.profile.stalkMaxSpeed;
    if (this.flankPosition) {
      // Flanker: seek the pre-computed offset position so the pack
      // closes from multiple angles instead of mirroring one vector.
      // Once arrived (handled by tick logic), the brain falls back to
      // direct pursuit — the flank gets you in position, then the
      // commit comes from there.
      this.slots.seek.target.copy(this.flankPosition);
      this._setActive({ seek: true, separation: true, alignment: true });
    } else {
      if (this.playerRef) this.slots.pursue.evader = this.playerRef;
      // Alignment lets a pack converge with shared heading — packmates
      // visibly orient toward the player together rather than each
      // independently corkscrewing in.
      this._setActive({ pursue: true, separation: true, alignment: true });
    }
  }
  deactivateStalkBehaviour(): void {
    this._setActive({ pursue: false, seek: false, alignment: false });
    // Clear flank target on exit — next stalk entry decides afresh
    // whether it's pursuing directly or flanking.
    this.flankPosition = null;
  }

  /**
   * Called by StalkState.execute each tick. If the brain is flanking
   * and has reached the flank position, swap to direct pursuit so it
   * can actually engage rather than holding the offset forever.
   */
  maintainFlankApproach(): void {
    if (!this.flankPosition || !this.playerRef) return;
    const distToFlank = this.position.distanceTo(this.flankPosition);
    if (distToFlank < this.profile.commitRadiusPx * 0.8) {
      // Reached flank; drop offset and switch to direct pursuit.
      this.flankPosition = null;
      this.slots.pursue.evader = this.playerRef;
      this._setActive({ seek: false, pursue: true });
    }
  }

  activateChargeBehaviour(target: Vector3): void {
    // Charge stays mostly still — speed drops to 30% of stalk while
    // the body coils. Renderer's chargeProgress drives the windup.
    this.maxSpeed = this.profile.stalkMaxSpeed * 0.3;
    this.slots.seek.target.copy(target);
    this._setActive({ seek: true });
  }
  deactivateChargeBehaviour(): void {
    this._setActive({ seek: false });
  }

  activateStrikeBehaviour(direction: Vector3): void {
    this.maxSpeed = this.effectiveStrikeSpeed();
    // Project the strike target far enough that velocity points
    // through the player and out the other side. Use a dedicated
    // local Vector3 — the previous code aliased `_scratch` as both
    // receiver and argument of `.add()`, which doubled the offset
    // (CodeRabbit caught this on the first review).
    this.slots.seek.target
      .copy(direction)
      .multiplyScalar(400)
      .add(this.position);
    this._setActive({ seek: true });
  }
  deactivateStrikeBehaviour(): void {
    this._setActive({ seek: false });
  }

  activateRecoverBehaviour(): void {
    this.maxSpeed = this.profile.patrolMaxSpeed * 0.4;
    this._setActive({ wander: true });
  }
  deactivateRecoverBehaviour(): void {
    this._setActive({ wander: false });
  }

  activateFleeBehaviour(): void {
    this.maxSpeed = this.profile.strikeMaxSpeed * 0.7;
    if (this.playerRef) this.slots.flee.target = this.playerRef.position;
    this._setActive({ flee: true });
  }
  deactivateFleeBehaviour(): void {
    this._setActive({ flee: false });
  }

  activateAmbientBehaviour(): void {
    this.maxSpeed = this.profile.patrolMaxSpeed * 0.5;
    this._setActive({ wander: true });
  }
  deactivateAmbientBehaviour(): void {
    this._setActive({ wander: false });
  }

  // ---- Reads called by states -------------------------------------------

  canSeePlayer(): boolean {
    if (!this.playerRef) return false;
    // Delegates to the unified perception module. Radius + cone +
    // LoS through the occluder set (debris, leviathans, locked-room
    // walls). The perception context is published by AIManager every
    // tick BEFORE this brain ticks; in unit tests with no AIManager,
    // the default empty context skips the LoS pass — same answer the
    // pre-perception inline math would have produced.
    return perceives(
      this.perceptionContext,
      {
        x: this.position.x,
        y: this.position.y,
        headingRad: Math.atan2(this.forward.y, this.forward.x),
      },
      predatorProfile(this.effectiveDetectionRadius(), this.profile.fovRadians),
      { x: this.playerRef.position.x, y: this.playerRef.position.y },
    );
  }

  hasMemoryOfPlayer(): boolean {
    if (!this.playerRef) return false;
    const record = this.memorySystem.getRecord(this.playerRef);
    if (!record) return false;
    if (record.timeLastSensed < 0) return false;
    return this.currentTime - record.timeLastSensed < this.profile.memorySpanSeconds;
  }

  distanceToPlayer(): number {
    if (!this.playerRef) return Infinity;
    return this.playerRef.position.distanceTo(this.position);
  }

  fuzzyAttackDesirability(): number {
    const distance = this.distanceToPlayer();
    const timeSinceDamage = this.currentTime - this.lastDamageReceivedTime;
    const packCount = this.packMates.filter((p) => p.currentAiState === "stalk" || p.currentAiState === "charge").length;
    this.fuzzy.fuzzify("distance", Math.min(distance, 800));
    this.fuzzy.fuzzify("recentPain", Math.min(timeSinceDamage, 10));
    this.fuzzy.fuzzify("packCount", Math.min(packCount, 5));
    return this.fuzzy.defuzzify("desirability");
  }

  broadcastEngage(): void {
    if (this.currentTime - this.lastBroadcastTime < 1.5) return;
    this.lastBroadcastTime = this.currentTime;
    this.lastEngageBroadcastAt = this.currentTime;
    this.lastBroadcastedToIds = [];
    if (!this.playerRef) return;
    // Compute the flank vector once: from player to this brain. Each
    // packmate rotates this vector by ±flankAngleOffset so they pinch
    // in from different sides instead of stacking on the engager's
    // approach line.
    const playerPos = this.playerRef.position;
    const baseDx = this.position.x - playerPos.x;
    const baseDy = this.position.y - playerPos.y;
    const baseAngle = Math.atan2(baseDy, baseDx);
    const baseDist = Math.hypot(baseDx, baseDy);
    let mateIndex = 0;
    for (const mate of this.packMates) {
      if (mate === this) continue;
      const distance = this.position.distanceTo(mate.position);
      if (distance < this.profile.detectionRadiusPx * 1.5) {
        // Alternate sides per mate so a pack of 3 splits into ±offset.
        const sign = mateIndex % 2 === 0 ? 1 : -1;
        const ringIndex = Math.floor(mateIndex / 2) + 1;
        const flankAngle = baseAngle + sign * mate.profile.flankAngleOffset * ringIndex;
        const flankX = playerPos.x + Math.cos(flankAngle) * baseDist;
        const flankY = playerPos.y + Math.sin(flankAngle) * baseDist;
        const flankTarget = new Vector3(flankX, flankY, 0);
        this.sendMessage(mate, TELEGRAM_FLANK, 0, { flankTarget });
        this.lastBroadcastedToIds.push(mate.name);
        mateIndex++;
      }
    }
  }

  // Yuka calls this when a Telegram is delivered. The base
  // GameEntity.handleMessage takes a Yuka Telegram with message: string.
  override handleMessage(telegram: Telegram): boolean {
    if (telegram.message === TELEGRAM_FLANK) {
      const data = telegram.data as { flankTarget?: Vector3 } | null;
      const flankTarget = data?.flankTarget;
      // Pickup: assume a flanking position. Set the flankPosition so
      // StalkState's enter() activates seek toward that offset rather
      // than direct pursuit.
      if (this.currentAiState === "patrol" && this.playerRef && flankTarget) {
        this.flankPosition = flankTarget.clone();
        // Refresh memory so canSeePlayer-or-memory checks pass and
        // stalk-state can run.
        const record = this.memorySystem.getRecord(this.playerRef);
        if (record) {
          record.timeLastSensed = this.currentTime;
          record.lastSensedPosition.copy(this.playerRef.position);
        }
        this.stateMachine.changeTo(STALK);
        return true;
      }
    }
    return false;
  }

  // ---- Internals --------------------------------------------------------

  private _updateMemory(): void {
    if (!this.playerRef) return;
    const record = this.memorySystem.getRecord(this.playerRef);
    if (!record) return;
    if (this.canSeePlayer()) {
      record.timeLastSensed = this.currentTime;
      record.lastSensedPosition.copy(this.playerRef.position);
      record.visible = true;
      this.lastKnownPlayerPosition.copy(this.playerRef.position);
    } else {
      record.visible = false;
      if (record.timeLastSensed >= 0) {
        this.lastKnownPlayerPosition.copy(record.lastSensedPosition);
      }
    }
  }

  private _setActive(flags: Partial<Record<keyof PredatorSteeringSlots, boolean>>): void {
    for (const [key, value] of Object.entries(flags)) {
      const behaviour = this.slots[key as keyof PredatorSteeringSlots];
      if (behaviour && typeof value === "boolean") behaviour.active = value;
    }
  }

  private _initSteering(): PredatorSteeringSlots {
    const wander = new WanderBehavior();
    wander.weight = 1;
    wander.active = true;

    const arrive = new ArriveBehavior(new Vector3());
    arrive.weight = 1.4;
    arrive.active = false;

    // PursuitBehavior's constructor demands a non-null `evader`
    // Vehicle, so we pass `this` as a *placeholder* — the brain is a
    // valid Vehicle, satisfying Yuka's invariant. Pursuit is
    // immediately set inactive on the next line, so this self-
    // referential evader is never consulted; activateStalkBehaviour()
    // overwrites `pursue.evader` to the real player Vehicle before
    // flipping `.active = true`. This is the cleanest pattern given
    // Yuka's API; the alternative would be to construct the brain
    // *after* the player vehicle, which couples spawn order in a way
    // that breaks the EntityManager pattern.
    const pursue = new PursuitBehavior(this);
    pursue.weight = 1.4;
    pursue.active = false;

    const seek = new SeekBehavior(new Vector3());
    seek.weight = 1.6;
    seek.active = false;

    const flee = new FleeBehavior(new Vector3());
    flee.weight = 1.4;
    flee.active = false;

    const separation = new SeparationBehavior();
    separation.weight = 0.7;
    separation.active = true;

    const alignment = new AlignmentBehavior();
    alignment.weight = 0.3;
    alignment.active = false;

    this.steering.add(wander);
    this.steering.add(arrive);
    this.steering.add(pursue);
    this.steering.add(seek);
    this.steering.add(flee);
    this.steering.add(separation);
    this.steering.add(alignment);

    return { wander, arrive, pursue, seek, flee, separation, alignment };
  }

  private _initFuzzyModule(): void {
    // Distance variable: small (<200), medium (200-450), far (>450)
    const distance = new FuzzyVariable();
    const distSmall = new LeftShoulderFuzzySet(0, 100, 200);
    const distMedium = new TriangularFuzzySet(150, 300, 450);
    const distFar = new RightShoulderFuzzySet(400, 600, 800);
    distance.add(distSmall).add(distMedium).add(distFar);
    this.fuzzy.addFLV("distance", distance);

    // RecentPain variable: just-hit (<1.5s), settling (1.5-5s), forgotten (>5s)
    const recentPain = new FuzzyVariable();
    const justHit = new LeftShoulderFuzzySet(0, 0.5, 1.5);
    const settling = new TriangularFuzzySet(1, 3, 5);
    const forgotten = new RightShoulderFuzzySet(4, 6, 10);
    recentPain.add(justHit).add(settling).add(forgotten);
    this.fuzzy.addFLV("recentPain", recentPain);

    // PackCount variable: solo, paired, swarm
    const packCount = new FuzzyVariable();
    const solo = new LeftShoulderFuzzySet(0, 0.5, 1);
    const paired = new TriangularFuzzySet(0.5, 1.5, 2.5);
    const swarm = new RightShoulderFuzzySet(2, 3, 5);
    packCount.add(solo).add(paired).add(swarm);
    this.fuzzy.addFLV("packCount", packCount);

    // Desirability output
    const desirability = new FuzzyVariable();
    const lowDesire = new LeftShoulderFuzzySet(0, 0.15, 0.35);
    const medDesire = new TriangularFuzzySet(0.25, 0.5, 0.75);
    const highDesire = new RightShoulderFuzzySet(0.65, 0.85, 1);
    desirability.add(lowDesire).add(medDesire).add(highDesire);
    this.fuzzy.addFLV("desirability", desirability);

    // Rules — encode predator decision logic.
    // Close + forgotten pain + any pack → high desire to attack
    this.fuzzy.addRule(
      new FuzzyRule(new FuzzyAND(distSmall, forgotten), highDesire),
    );
    // Close + just hit → low desire (back off)
    this.fuzzy.addRule(
      new FuzzyRule(new FuzzyAND(distSmall, justHit), lowDesire),
    );
    // Medium distance with swarm support → high desire (gang up)
    this.fuzzy.addRule(
      new FuzzyRule(new FuzzyAND(distMedium, swarm), highDesire),
    );
    // Medium + solo + settling pain → medium desire
    this.fuzzy.addRule(
      new FuzzyRule(new FuzzyAND(distMedium, settling), medDesire),
    );
    // Far → always low desire
    this.fuzzy.addRule(new FuzzyRule(distFar, lowDesire));
  }
}
