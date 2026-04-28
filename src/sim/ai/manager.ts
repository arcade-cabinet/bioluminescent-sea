import { EntityManager, Time, AlignmentBehavior, CohesionBehavior, SeparationBehavior } from "yuka";
import type { Player, Predator, Pirate, Creature } from "@/sim/entities/types";
import { getArchetype } from "@/sim/factories/actor";
import {
  EnemySubHuntBehavior,
  FleeFromPlayerBehavior,
  GameVehicle,
  WrapPlayBandBehavior,
} from "./steering";
import { PredatorBrain } from "./predator-brain/PredatorBrain";
import { profileForPredatorId } from "./predator-brain/archetype-profiles";
import { PirateBrain } from "./pirate-brain/PirateBrain";
import type { SceneState, ViewportDimensions } from "@/sim/dive/types";
import { resolveNumeric } from "@/sim/_shared/variance";
import { collectOccluders } from "./perception/occluders";
import type { PerceptionContext } from "./perception/perception";

const MARAUDER_SUB_ARCHETYPE = getArchetype("marauder-sub");

/**
 * Per-species per-dive flock parameter rolls. Each call uses
 * resolveNumeric with a unique tag so adding a new param doesn't
 * shift the seed-derived values for existing ones.
 *
 * skittishWeight upper bound (0.7) is intentionally below the
 * cohesion upper bound (1.0) so a high flee + low cohesion roll
 * cannot prevent the school from re-forming after the player passes
 * through (quality review #5).
 */
function resolveFlockParams(type: string, diveSeed: number) {
  return {
    alignmentWeight: resolveNumeric([0.4, 1.1], diveSeed, `flock:${type}:alignment`),
    cohesionWeight: resolveNumeric([0.3, 1.0], diveSeed, `flock:${type}:cohesion`),
    separationWeight: resolveNumeric([0.6, 1.4], diveSeed, `flock:${type}:separation`),
    skittishRadius: resolveNumeric([80, 220], diveSeed, `flock:${type}:skittishRadius`),
    skittishWeight: resolveNumeric([0.0, 0.7], diveSeed, `flock:${type}:skittishWeight`),
  };
}

export class AIManager {
  public entityManager: EntityManager;
  public time: Time;
  private playerVehicle: GameVehicle;
  private vehicleMap: Map<string, GameVehicle>;
  /** Predator brains keyed by entity id. Held separately from
   *  vehicleMap because PredatorBrain has the StateMachine + memory
   *  + pack messaging surface that AIManager needs to tick + read. */
  private predatorBrainMap: Map<string, PredatorBrain> = new Map();
  /** Pirate brains keyed by entity id. Same reason as
   *  predatorBrainMap — the brain owns awareness + lantern-cone
   *  detection that the renderer reads. */
  private pirateBrainMap: Map<string, PirateBrain> = new Map();
  /** Wall-clock seconds since AIManager construction; pushed into
   *  every brain's tick() so memory + fuzzy "recent damage" maths
   *  work without each brain tracking its own clock. */
  private currentTime = 0;
  private viewportWidth: number;
  private viewportHeight: number;
  private diveSeed: number;
  /**
   * Perception context for the current tick. Rebuilt by
   * `rebuildPerception(scene, lockedRoom)` once per frame from the
   * runtime, before any GOAP provider's `next()` runs. Public so
   * callers can pass it into `PlayerSubObservation.perception`.
   *
   * Empty until the first `rebuildPerception` call — production
   * runtime always rebuilds before the first GOAP tick. Tests that
   * skip rebuild see helpers fall back to direct scene reads.
   */
  public perception: PerceptionContext = { occluders: [] };
  private flockingBehaviors: Map<string, {
    alignment: AlignmentBehavior;
    cohesion: CohesionBehavior;
    separation: SeparationBehavior;
    /** May be null when the rolled skittishWeight is below threshold
     *  (gated registration — see syncCreatures comment). */
    fleeFromPlayer: FleeFromPlayerBehavior | null;
  }>;

  /**
   * @param viewport viewport dimensions in pixels
   * @param diveSeed dive seed; per-dive flocking weights are sampled
   *   from authored ranges so two dives with different seeds produce
   *   visually distinct flocking behaviour. Default 0 keeps tests
   *   deterministic without forcing every existing call site to
   *   thread a seed in this PR.
   */
  constructor(viewport: ViewportDimensions, diveSeed = 0) {
    this.entityManager = new EntityManager();
    this.time = new Time();
    this.vehicleMap = new Map();
    this.flockingBehaviors = new Map();
    this.viewportWidth = viewport.width;
    this.viewportHeight = viewport.height;
    this.diveSeed = diveSeed;

    this.playerVehicle = new GameVehicle("player");
    this.playerVehicle.position.set(0, 0, 0);
    this.entityManager.add(this.playerVehicle);
  }

  updatePlayer(player: Player) {
    // NaN guard — a bad player position would poison the
    // playerVehicle reference, propagating through every
    // FleeFromPlayerBehavior and predator perception path.
    if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) return;
    this.playerVehicle.position.set(player.x, player.y, 0);
  }

  /**
   * Push the current biome's aggression multiplier into every
   * predator brain. Called once per tick from the runtime with the
   * player's depth-derived multiplier:
   *   - epipelagic    1.0 (baseline)
   *   - mesopelagic   1.15
   *   - bathypelagic  1.3
   *   - abyssopelagic 1.45
   *   - hadopelagic   1.6
   * Each brain then uses its `effective*` accessors so detection
   * radius, charge windup, and strike speed scale together.
   */
  setBiomeAggression(multiplier: number): void {
    for (const brain of this.predatorBrainMap.values()) {
      brain.biomeAggression = multiplier;
    }
  }

  syncPredators(predators: Predator[]) {
    for (const p of predators) {
      // Marauder-subs run on their own EnemySubHuntBehavior pipeline.
      // The full PredatorBrain (StateMachine, MemorySystem, FuzzyModule)
      // covers organic predators; subs are mechanical and use a
      // different aesthetic.
      if (p.id.startsWith("marauder-sub")) {
        let vehicle = this.vehicleMap.get(p.id);
        if (!vehicle) {
          vehicle = new GameVehicle(p.id);
          vehicle.position.set(p.x, p.y, 0);
          const baseSpeed = p.speed * 60;
          vehicle.maxSpeed = baseSpeed;
          const seed =
            Math.floor(p.x * 1000) + Math.floor(p.y * 1000) + Math.floor(p.speed * 1000);
          const hunt = new EnemySubHuntBehavior(
            this.playerVehicle.position,
            baseSpeed,
            MARAUDER_SUB_ARCHETYPE.detectionRadius,
            seed,
          );
          vehicle.steering.add(hunt);
          const wrap = new WrapPlayBandBehavior(this.viewportWidth);
          vehicle.steering.add(wrap);
          this.entityManager.add(vehicle);
          this.vehicleMap.set(p.id, vehicle);
        }
        continue;
      }

      let brain = this.predatorBrainMap.get(p.id);
      if (!brain) {
        const profile = profileForPredatorId(p.id);
        brain = new PredatorBrain(p.id, profile, p.x, p.y);
        if (p.isLeviathan) {
          brain.pinAsLeviathan();
        } else {
          brain.attachPlayer(this.playerVehicle);
        }
        // Spawned predators start neutral (hunger factor 1) — the
        // ramp begins from spawn, not from t=0. Without this a fresh
        // chunk's predators would arrive pre-starved and feel
        // artificially aggressive.
        brain.lastStrikeAttemptTime = this.currentTime;
        this.entityManager.add(brain);
        this.predatorBrainMap.set(p.id, brain);
      }
    }

    // Prune predators (both organic brains and marauder-sub vehicles)
    // whose entity is no longer in the live list. Without this, old
    // entities pile up in the entity manager and keep updating
    // off-screen forever — costing CPU and producing ghost steering
    // forces. CodeRabbit caught the missing marauder-sub branch on
    // PR #134's first review.
    const liveIds = new Set(predators.map((p) => p.id));
    for (const [id, brain] of this.predatorBrainMap.entries()) {
      if (!liveIds.has(id)) {
        this.entityManager.remove(brain);
        this.predatorBrainMap.delete(id);
      }
    }
    for (const [id, vehicle] of this.vehicleMap.entries()) {
      if (id.startsWith("marauder-sub") && !liveIds.has(id)) {
        this.entityManager.remove(vehicle);
        this.vehicleMap.delete(id);
      }
    }

    // Pack-mate wiring is bucketed by archetype id so the inner
    // distance check only walks same-archetype brains. With the
    // typical predator population (<50 brains across 3 archetypes)
    // each bucket is small and the work-per-frame is bounded by
    // bucket-size² rather than total-population². The threshold
    // (1.5× detection radius) matches broadcastEngage's filter so
    // the pack-mate list is valid for the same set of telegrams.
    const archetypeBuckets = new Map<string, PredatorBrain[]>();
    for (const brain of this.predatorBrainMap.values()) {
      let bucket = archetypeBuckets.get(brain.profile.id);
      if (!bucket) {
        bucket = [];
        archetypeBuckets.set(brain.profile.id, bucket);
      }
      bucket.push(brain);
    }
    for (const bucket of archetypeBuckets.values()) {
      for (const brain of bucket) {
        const radius = brain.profile.detectionRadiusPx * 1.5;
        const mates = bucket.filter(
          (m) => m !== brain && m.position.distanceTo(brain.position) < radius,
        );
        brain.attachPackMates(mates);
      }
    }
  }

  syncPirates(pirates: Pirate[]) {
    for (const p of pirates) {
      let brain = this.pirateBrainMap.get(p.id);
      if (!brain) {
        brain = new PirateBrain(p.id, p.speed * 60, this.viewportWidth, p.noiseOffset);
        brain.position.set(p.x, p.y, 0);
        brain.attachPlayer(this.playerVehicle);
        this.entityManager.add(brain);
        this.pirateBrainMap.set(p.id, brain);
      }
    }
    // Prune brains for retired pirates so the entity manager doesn't
    // accumulate ghost vehicles patrolling chunks the player has long
    // since left.
    const liveIds = new Set(pirates.map((p) => p.id));
    for (const [id, brain] of this.pirateBrainMap.entries()) {
      if (!liveIds.has(id)) {
        this.entityManager.remove(brain);
        this.pirateBrainMap.delete(id);
      }
    }
  }

  syncCreatures(creatures: Creature[]) {
    const flockers = creatures.filter(c => c.type !== "plankton");

    for (const type of ["fish", "jellyfish"]) {
      if (!this.flockingBehaviors.has(type)) {
        // Per-dive, per-species flocking weights. Each species draws
        // independent weights from the authored ranges, and each dive's
        // seed picks a different blend — one dive's fish might be
        // tightly cohesive (cohesion=0.9) and loosely aligned (0.3),
        // the next dive's fish might fan out and align like a school.
        const params = resolveFlockParams(type, this.diveSeed);
        const alignment = new AlignmentBehavior();
        const cohesion = new CohesionBehavior();
        const separation = new SeparationBehavior();
        alignment.weight = params.alignmentWeight;
        cohesion.weight = params.cohesionWeight;
        separation.weight = params.separationWeight;

        // Gated registration: when the rolled skittishWeight is
        // below 0.1, this species is "fearless" — don't wire the
        // behavior at all. Avoids paying the per-frame cost for
        // a no-op force contribution.
        let fleeFromPlayer: FleeFromPlayerBehavior | null = null;
        if (params.skittishWeight >= 0.1) {
          fleeFromPlayer = new FleeFromPlayerBehavior(params.skittishRadius);
          fleeFromPlayer.weight = params.skittishWeight;
          fleeFromPlayer.playerRef = this.playerVehicle;
        }
        this.flockingBehaviors.set(type, {
          alignment,
          cohesion,
          separation,
          fleeFromPlayer,
        });
      }
    }

    for (const c of flockers) {
      let vehicle = this.vehicleMap.get(c.id);
      if (!vehicle) {
        vehicle = new GameVehicle(c.id);
        vehicle.position.set(c.x, c.y, 0);
        vehicle.maxSpeed = c.speed * 60;

        const behaviors = this.flockingBehaviors.get(c.type);
        if (behaviors) {
          vehicle.steering.add(behaviors.alignment);
          vehicle.steering.add(behaviors.cohesion);
          vehicle.steering.add(behaviors.separation);
          if (behaviors.fleeFromPlayer) {
            vehicle.steering.add(behaviors.fleeFromPlayer);
          }
        }

        const wrap = new WrapPlayBandBehavior(this.viewportWidth);
        vehicle.steering.add(wrap);

        this.entityManager.add(vehicle);
        this.vehicleMap.set(c.id, vehicle);
      }
    }

    // Prune vehicles whose creature has retired off-screen. The
    // previous predicate was inverted (only beacons were pruned —
    // fish/jellyfish leaked indefinitely). Now we prune any vehicle
    // that is not the player and has no matching creature this frame.
    const activeIds = new Set(creatures.map(c => c.id));
    for (const [id, vehicle] of this.vehicleMap.entries()) {
      if (id === "player") continue;
      if (activeIds.has(id)) continue;
      this.entityManager.remove(vehicle);
      this.vehicleMap.delete(id);
    }
  }

  update(deltaTime: number) {
    this.currentTime += deltaTime;
    // Publish the current-tick perception context onto every brain
    // BEFORE it ticks, so canSeePlayer and the pirate cone test see
    // a consistent occluder list. AIManager built this in
    // `rebuildPerception` (called by advanceScene before update).
    for (const brain of this.predatorBrainMap.values()) {
      brain.perceptionContext = this.perception;
      brain.tick(deltaTime, this.currentTime);
    }
    for (const brain of this.pirateBrainMap.values()) {
      brain.perceptionContext = this.perception;
      brain.tick(deltaTime);
    }
    this.entityManager.update(deltaTime);
  }

  /**
   * Rebuild the perception context for the current tick from the
   * scene state and chunk-travel hint.
   *
   * Called once per frame by `advanceScene` BEFORE any per-entity
   * detection check (predator canSeePlayer, pirate cone, GOAP bot).
   * The result is published on `this.perception` for any caller to
   * read — `advanceScene` forwards it onto the GOAP observation,
   * predator + pirate brains read it through accessors below.
   *
   * `lockedRoom = true` adds the four viewport-edge wall segments;
   * `false` leaves perception unbounded by walls (open / corridor
   * chunks). The chunk lifecycle pushes the current chunk's travel
   * slot in via this argument.
   *
   * `perceiverEntityId` excludes that entity's own leviathan entry
   * from the occluder list — prevents a leviathan from occluding
   * its own line-of-sight. Default: undefined (no exclusion).
   */
  rebuildPerception(scene: SceneState, lockedRoom = false, perceiverEntityId?: string): void {
    this.perception = {
      occluders: collectOccluders(
        scene,
        { width: this.viewportWidth, height: this.viewportHeight },
        perceiverEntityId,
        lockedRoom,
      ),
    };
  }

  /**
   * Last lamp-scatter event positions captured by applyLampPressure.
   * Each entry is a {x, y} pair where a predator was inside the
   * lamp cone this frame. The runtime surfaces these to the
   * renderer's FX layer for spark-scatter particles. Cleared at the
   * start of each lamp pressure pass.
   */
  public lastLampScatterPoints: { x: number; y: number }[] = [];

  /**
   * Bump every predator's MemorySystem record of the player when the
   * player cavitates within audible range. Sound bypasses LoS — a
   * cavitation event is heard even through debris, leviathans, or
   * locked-room walls.
   *
   * The Yuka MemorySystem requires a live Vehicle reference (not
   * coords); this method holds that reference (`this.playerVehicle`)
   * and is the only code path that writes player-memory from non-
   * perception sources. The emitter already guards NaN inputs and
   * only emits when all inputs are finite, so callers are trusted.
   *
   * Creates the memory record on first contact — predators that
   * have never seen the player still gain awareness from cavitation,
   * matching the "sound bypasses LoS" intent.
   *
   * Returns the number of predator records bumped, for SFX gain.
   */
  applyCavitationBump(
    eventX: number,
    eventY: number,
    audibleRadiusPx: number,
    simTime: number,
  ): number {
    const radiusSq = audibleRadiusPx * audibleRadiusPx;
    let bumped = 0;
    for (const brain of this.predatorBrainMap.values()) {
      const dx = brain.position.x - eventX;
      const dy = brain.position.y - eventY;
      if (dx * dx + dy * dy > radiusSq) continue;
      // Create-or-update: predators that haven't sensed the player
      // before still get awareness from cavitation.
      if (!brain.memorySystem.hasRecord(this.playerVehicle)) {
        brain.memorySystem.createRecord(this.playerVehicle);
      }
      const record = brain.memorySystem.getRecord(this.playerVehicle);
      if (!record) continue;
      record.timeLastSensed = simTime;
      record.lastSensedPosition.copy(this.playerVehicle.position);
      bumped += 1;
    }
    return bumped;
  }

  /**
   * Push the player's lamp cone against every predator brain. Any
   * brain whose centre falls inside the cone takes damage — its
   * StateMachine flips to FleeState (unless mid-strike) and its
   * fuzzy "recentPain" axis lights up, so the predator visibly
   * recoils, dims, and turns tail. Called once per frame from the
   * sim's advance step.
   *
   * The lamp cone is the same geometry the renderer draws:
   *   - origin: player position
   *   - forward: player.angle
   *   - length: 180 * lampScale * lampBoost
   *   - half-spread (radians): atan(80*lampScale*lampBoost / length)
   *
   * Predators take damage at most once per
   * `predatorLampDamageCooldownSeconds` so a stationary lamp doesn't
   * spam the brain into a flee-loop forever.
   */
  applyLampPressure(
    playerX: number,
    playerY: number,
    playerAngle: number,
    lampScale: number,
    lampBoost: number,
  ): void {
    // Reset the scatter buffer at the start of every pressure pass —
    // the renderer reads it after this returns.
    this.lastLampScatterPoints.length = 0;
    const length = 180 * lampScale * lampBoost;
    const halfSpread = 80 * lampScale * lampBoost;
    const halfAngle = Math.atan2(halfSpread, length);
    const lengthSq = length * length;
    for (const brain of this.predatorBrainMap.values()) {
      if (brain.currentAiState === "ambient") continue; // leviathans ignore lamp
      const dx = brain.position.x - playerX;
      const dy = brain.position.y - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > lengthSq) continue;
      // Cone test: angle from player-forward to brain must be within
      // halfAngle. Use atan2 of the rotated coordinates.
      const cos = Math.cos(-playerAngle);
      const sin = Math.sin(-playerAngle);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      if (localX <= 0) continue; // behind the lamp
      const angleFromAxis = Math.atan2(Math.abs(localY), localX);
      if (angleFromAxis > halfAngle) continue;
      // Predator IS in the cone — emit scatter regardless of damage
      // cooldown so the visual "lamp is hitting them" plays continuously
      // while the player holds the cone steady, even though damage
      // ticks at most once per 1.2s.
      this.lastLampScatterPoints.push({
        x: brain.position.x,
        y: brain.position.y,
      });
      // Damage cooldown: skip the actual hit if we recently damaged
      // this brain so the cone doesn't lock it into permanent flee.
      if (this.currentTime - brain.lastDamageReceivedTime < 1.2) continue;
      brain.receiveDamage(this.currentTime);
    }
  }

  /**
   * IDs of predator brains whose death animation has fully elapsed.
   * The sim's advance() filters these out of the next scene tick;
   * the next syncPredators call prunes the brain map. Dying brains
   * (HP=0 but mid-animation) are NOT included so the renderer can
   * continue drawing the sink-and-fade.
   */
  getDeadPredatorIds(): Set<string> {
    const dead = new Set<string>();
    for (const [id, brain] of this.predatorBrainMap) {
      if (brain.isDead()) dead.add(id);
    }
    return dead;
  }

  /**
   * IDs of predator brains that just transitioned from alive to
   * dying THIS frame. Used by the loot-drop pass so a kill spawns
   * exactly one breath anomaly at death-start, not one per frame
   * across the animation. Tracked via a per-frame flag the brain
   * arms in receiveDamage and the manager consumes here.
   */
  getJustKilledPredatorIds(): Set<string> {
    const killed = new Set<string>();
    for (const [id, brain] of this.predatorBrainMap) {
      if (brain.isDying() && !brain.lootDropped) {
        killed.add(id);
        brain.lootDropped = true;
      }
    }
    return killed;
  }

  /**
   * True if any pirate's awareness crossed the pursuit threshold
   * THIS tick. Drives a one-shot pirate-alert SFX so the player
   * has an audio tell that a pirate just locked on, even if they
   * weren't watching the lantern color/cone widen.
   */
  anyPirateAlertedThisFrame(): boolean {
    for (const brain of this.pirateBrainMap.values()) {
      if (brain.justAlerted) return true;
    }
    return false;
  }

  /**
   * Threat intensity in 0..1, computed from the count of predator
   * brains currently in stalk/charge/strike near the given point.
   * Used by the audio layer to ramp the ambient rumble + filter Q
   * — the music thickens as predators close in.
   *
   * Each archetype's detection radius defines "near". A single
   * stalking predator returns ~0.3, a full pack converging returns
   * ~1.0. Saturates at 4 active threats so a swarm chunk doesn't
   * pin the rumble at max forever.
   */
  computeThreatIntensity(x: number, y: number): number {
    let active = 0;
    for (const brain of this.predatorBrainMap.values()) {
      const state = brain.currentAiState;
      if (state !== "stalk" && state !== "charge" && state !== "strike") continue;
      const dx = brain.position.x - x;
      const dy = brain.position.y - y;
      const distSq = dx * dx + dy * dy;
      const radius = brain.profile.detectionRadiusPx;
      if (distSq > radius * radius) continue;
      const weight = state === "strike" ? 1.5 : state === "charge" ? 1.2 : 1;
      active += weight;
    }
    return Math.min(1, active / 4);
  }

  /**
   * True if any predator brain broadcast a flank engage this frame.
   * The runtime reads this on the rising edge to play the
   * `pack-call` SFX once per broadcast — without this, the SFX
   * would spam every frame the cooldown was satisfied.
   */
  /**
   * Pairs of {fromX, fromY, toX, toY, ageSeconds, lifetimeSeconds}
   * for every active flank broadcast within `lifetimeSeconds`. The
   * FX layer draws fading arcs between the engager and each
   * packmate it called — the player gets a brief visualisation of
   * the pack's convergence vectors at the moment a swarm tightens.
   *
   * Each broadcast lasts ~1.2s in render time so the arc has a
   * readable beat — long enough to register, short enough to
   * not clutter the screen during sustained press scenarios.
   */
  recentFlankPairs(lifetimeSeconds = 1.2): {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    age: number;
    lifetime: number;
  }[] {
    const out: {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      age: number;
      lifetime: number;
    }[] = [];
    for (const brain of this.predatorBrainMap.values()) {
      const age = this.currentTime - brain.lastEngageBroadcastAt;
      if (age < 0 || age > lifetimeSeconds) continue;
      if (brain.lastBroadcastedToIds.length === 0) continue;
      for (const targetId of brain.lastBroadcastedToIds) {
        const target = this.predatorBrainMap.get(targetId);
        if (!target) continue;
        out.push({
          fromX: brain.position.x,
          fromY: brain.position.y,
          toX: target.position.x,
          toY: target.position.y,
          age,
          lifetime: lifetimeSeconds,
        });
      }
    }
    return out;
  }

  anyEngageBroadcastSince(threshold: number): boolean {
    for (const brain of this.predatorBrainMap.values()) {
      if (brain.lastEngageBroadcastAt > threshold) return true;
    }
    return false;
  }

  /**
   * Returns true if any predator brain is currently inside its
   * StrikeState within `radiusPx` of the given point. Used by the
   * sim to trigger a screen-shake/flash burst when a lunge lands
   * close — readable feedback that the strike happened, even if it
   * missed the collision check by a hair.
   *
   * One-frame edge detection is the caller's job: pass the previous
   * frame's value alongside this and only fire on the rising edge.
   */
  /**
   * Bearings (radians) + intensity (0..1) of every active threat
   * within `range` of the given point. Returns one entry per
   * stalk/charge/strike predator brain. Used by the FX layer's
   * sonar ring to paint directional arcs that warn the player about
   * threats outside the current viewport — the trench is wider than
   * the visible play band so packs often press in from off-screen.
   *
   * - bearing: atan2(dy, dx) so 0 = +x axis, +π/2 = +y (down)
   * - intensity: 1.0 for striking, 0.7 for charging, 0.4 for stalking
   * - distance: 0..1 normalised inside `range` so far threats produce
   *   a thinner arc than near ones
   */
  threatBearings(
    x: number,
    y: number,
    range: number,
  ): { bearing: number; intensity: number; nearness: number }[] {
    const out: { bearing: number; intensity: number; nearness: number }[] = [];
    const rangeSq = range * range;
    for (const brain of this.predatorBrainMap.values()) {
      const state = brain.currentAiState;
      if (state !== "stalk" && state !== "charge" && state !== "strike") continue;
      if (brain.isDying()) continue;
      const dx = brain.position.x - x;
      const dy = brain.position.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq > rangeSq) continue;
      const dist = Math.sqrt(distSq);
      const intensity =
        state === "strike" ? 1 : state === "charge" ? 0.7 : 0.4;
      out.push({
        bearing: Math.atan2(dy, dx),
        intensity,
        nearness: 1 - dist / range,
      });
    }
    return out;
  }

  /**
   * 0..1 leviathan-proximity intensity, computed from how close any
   * leviathan brain is to the player. Returns 0 if no leviathan is
   * spawned. Saturates at 1 when a leviathan is within 200px and
   * decays linearly to 0 by 1200px.
   *
   * Drives the audio layer's sub-bass drone (`leviathan-rumble`) and
   * the renderer's edge-vignette pulse so the player gets a
   * cinematic "something is here, something is enormous, you do
   * NOT want it to find you" cue without needing to spot the
   * silhouette in the darkness.
   *
   * Detection uses `isLeviathan` predator entries (the Predator
   * type's existing flag) — they're tracked through the same
   * brain map as organic predators but pinned to AmbientState by
   * `pinAsLeviathan()` so they don't pursue.
   */
  leviathanProximity(x: number, y: number): number {
    let nearest = Infinity;
    for (const brain of this.predatorBrainMap.values()) {
      if (brain.currentAiState !== "ambient") continue;
      const dx = brain.position.x - x;
      const dy = brain.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearest) nearest = dist;
    }
    if (nearest === Infinity) return 0;
    if (nearest <= 200) return 1;
    if (nearest >= 1200) return 0;
    return 1 - (nearest - 200) / 1000;
  }

  anyPredatorStrikingNear(x: number, y: number, radiusPx: number): boolean {
    const radiusSq = radiusPx * radiusPx;
    for (const brain of this.predatorBrainMap.values()) {
      if (brain.currentAiState !== "strike") continue;
      const dx = brain.position.x - x;
      const dy = brain.position.y - y;
      if (dx * dx + dy * dy < radiusSq) return true;
    }
    return false;
  }

  readPredator(p: Predator): Predator {
    const brain = this.predatorBrainMap.get(p.id);
    if (brain) {
      return {
        ...p,
        x: brain.position.x,
        y: brain.position.y,
        angle: Math.atan2(brain.velocity.y, brain.velocity.x),
        aiState: brain.currentAiState,
        stateProgress: brain.currentStateProgress,
        damageFraction: 1 - brain.hp,
        deathProgress: brain.deathProgress(),
        hungerLevel: brain.hungerLevel(),
      };
    }
    const vehicle = this.vehicleMap.get(p.id);
    if (!vehicle) return p;

    return {
      ...p,
      x: vehicle.position.x,
      y: vehicle.position.y,
      angle: Math.atan2(vehicle.velocity.y, vehicle.velocity.x),
    };
  }

  readPirate(p: Pirate): Pirate {
    const brain = this.pirateBrainMap.get(p.id);
    if (brain) {
      return {
        ...p,
        x: brain.position.x,
        y: brain.position.y,
        angle: Math.atan2(brain.velocity.y, brain.velocity.x),
        awareness: brain.awareness,
      };
    }
    const vehicle = this.vehicleMap.get(p.id);
    if (!vehicle) return p;

    return {
      ...p,
      x: vehicle.position.x,
      y: vehicle.position.y,
      angle: Math.atan2(vehicle.velocity.y, vehicle.velocity.x),
    };
  }

  readCreature(c: Creature): Creature {
    if (c.type === "plankton") return c;
    
    const vehicle = this.vehicleMap.get(c.id);
    if (!vehicle) return c;
    
    return {
      ...c,
      x: vehicle.position.x,
      y: vehicle.position.y,
    };
  }
}
