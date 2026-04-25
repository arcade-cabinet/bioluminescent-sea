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

const _scratch = new Vector3();

export class PredatorBrain extends Vehicle {
  public readonly profile: PredatorArchetypeProfile;
  public readonly stateMachine: StateMachine<PredatorBrain>; // eslint-disable-line @typescript-eslint/no-explicit-any
  public readonly memorySystem: MemorySystem;
  public readonly fuzzy: FuzzyModule;
  public readonly lastKnownPlayerPosition = new Vector3();

  /** Mirrored each tick from StateMachine for the renderer. */
  public currentAiState: PredatorAiState = "ambient";
  public currentStateProgress = 0;

  /** The shared player vehicle (reference, not copy). */
  private playerRef: Vehicle | null = null;

  /** Spawn anchor used by patrol-state to roam around. */
  private patrolAnchor = new Vector3();

  /** When the brain last took damage. Drives flee transitions + the
   *  fuzzy desirability "recent pain" axis. */
  private lastDamageTime = -Infinity;

  /** All packmates in the same chunk. Wired by AIManager so flank
   *  broadcasts don't have to walk the whole entity manager. */
  private packMates: PredatorBrain[] = [];

  /** Engage broadcast cooldown so we don't spam every tick. */
  private lastBroadcastTime = -Infinity;

  /** The simulation timestamp pushed in by AIManager each tick.
   *  Used by Memory + Fuzzy "recent damage" math. */
  public currentTime = 0;

  /** Most recent delta-time tick — read by states' tickElapsed(). */
  public lastDelta = 0;

  /** Steering slots — kept in this stable shape so state transitions
   *  flip `.active` rather than churning the steering list. */
  private slots: PredatorSteeringSlots;

  /** Allocated once + reused. Avoids per-frame allocation in `update`. */
  private readonly _toPlayer = new Vector3();

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
    this.lastDamageTime = currentTime;
    if (this.stateMachine.currentState !== this.stateMachine.states.get(STRIKE)) {
      this.stateMachine.changeTo(FLEE);
    }
  }

  // ---- Per-tick API ------------------------------------------------------

  tick(delta: number, currentTime: number): void {
    this.lastDelta = delta;
    this.currentTime = currentTime;
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
    this._setActive({ wander: true, separation: true });
  }
  deactivatePatrolBehaviour(): void {
    this._setActive({ wander: false });
  }

  activateStalkBehaviour(): void {
    this.maxSpeed = this.profile.stalkMaxSpeed;
    if (this.playerRef) this.slots.pursue.evader = this.playerRef;
    this._setActive({ pursue: true, separation: true });
  }
  deactivateStalkBehaviour(): void {
    this._setActive({ pursue: false });
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
    this.maxSpeed = this.profile.strikeMaxSpeed;
    // Project the strike target far enough that velocity points
    // through the player and out the other side.
    _scratch
      .copy(this.position)
      .add(_scratch.copy(direction).multiplyScalar(400));
    this.slots.seek.target.copy(_scratch);
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
    const distance = this.playerRef.position.distanceTo(this.position);
    if (distance > this.profile.detectionRadiusPx) return false;
    // Cone test: dot of forward vs to-player must exceed the half-angle
    this._toPlayer
      .copy(this.playerRef.position)
      .sub(this.position)
      .normalize();
    const dot = this.forward.dot(this._toPlayer);
    const halfAngle = this.profile.fovRadians * 0.5;
    return dot >= Math.cos(halfAngle);
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
    const timeSinceDamage = this.currentTime - this.lastDamageTime;
    const packCount = this.packMates.filter((p) => p.currentAiState === "stalk" || p.currentAiState === "charge").length;
    this.fuzzy.fuzzify("distance", Math.min(distance, 800));
    this.fuzzy.fuzzify("recentPain", Math.min(timeSinceDamage, 10));
    this.fuzzy.fuzzify("packCount", Math.min(packCount, 5));
    return this.fuzzy.defuzzify("desirability");
  }

  broadcastEngage(): void {
    if (this.currentTime - this.lastBroadcastTime < 1.5) return;
    this.lastBroadcastTime = this.currentTime;
    for (const mate of this.packMates) {
      if (mate === this) continue;
      const distance = this.position.distanceTo(mate.position);
      if (distance < this.profile.detectionRadiusPx * 1.5) {
        this.sendMessage(mate, TELEGRAM_FLANK, 0, { sourcePosition: this.position.clone() });
      }
    }
  }

  // Yuka calls this when a Telegram is delivered. The base
  // GameEntity.handleMessage takes a Yuka Telegram with message: string.
  override handleMessage(telegram: Telegram): boolean {
    if (telegram.message === TELEGRAM_FLANK) {
      // Pickup: assume a flanking position around the engager's target.
      // Force a transition into stalk if currently patrolling so the
      // pack visibly converges.
      if (this.currentAiState === "patrol" && this.playerRef) {
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

    // PursuitBehavior needs an evader Vehicle. Set to a placeholder
    // until attachPlayer wires the real one.
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
