import { EntityManager, Time, AlignmentBehavior, CohesionBehavior, SeparationBehavior } from "yuka";
import type { Player, Predator, Pirate, Creature } from "@/sim/entities/types";
import { getArchetype } from "@/sim/factories/actor";
import {
  EnemySubHuntBehavior,
  GameVehicle,
  WanderBehavior,
  WrapPlayBandBehavior,
} from "./steering";
import { PredatorBrain } from "./predator-brain/PredatorBrain";
import { profileForPredatorId } from "./predator-brain/archetype-profiles";
import type { ViewportDimensions } from "@/sim/dive/types";
import { resolveNumeric } from "@/sim/_shared/variance";

const MARAUDER_SUB_ARCHETYPE = getArchetype("marauder-sub");

export class AIManager {
  public entityManager: EntityManager;
  public time: Time;
  private playerVehicle: GameVehicle;
  private vehicleMap: Map<string, GameVehicle>;
  /** Predator brains keyed by entity id. Held separately from
   *  vehicleMap because PredatorBrain has the StateMachine + memory
   *  + pack messaging surface that AIManager needs to tick + read. */
  private predatorBrainMap: Map<string, PredatorBrain> = new Map();
  /** Wall-clock seconds since AIManager construction; pushed into
   *  every brain's tick() so memory + fuzzy "recent damage" maths
   *  work without each brain tracking its own clock. */
  private currentTime = 0;
  private viewportWidth: number;
  private diveSeed: number;
  private flockingBehaviors: Map<string, {
    alignment: AlignmentBehavior;
    cohesion: CohesionBehavior;
    separation: SeparationBehavior;
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
    this.diveSeed = diveSeed;

    this.playerVehicle = new GameVehicle("player");
    this.playerVehicle.position.set(0, 0, 0);
    this.entityManager.add(this.playerVehicle);
  }

  updatePlayer(player: Player) {
    this.playerVehicle.position.set(player.x, player.y, 0);
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
      let vehicle = this.vehicleMap.get(p.id);
      if (!vehicle) {
        vehicle = new GameVehicle(p.id);
        vehicle.position.set(p.x, p.y, 0);
        vehicle.maxSpeed = p.speed * 60;
        
        const wander = new WanderBehavior(p.noiseOffset);
        vehicle.steering.add(wander);
        
        const wrap = new WrapPlayBandBehavior(this.viewportWidth);
        vehicle.steering.add(wrap);
        
        this.entityManager.add(vehicle);
        this.vehicleMap.set(p.id, vehicle);
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
        const alignment = new AlignmentBehavior();
        const cohesion = new CohesionBehavior();
        const separation = new SeparationBehavior();
        alignment.weight = resolveNumeric(
          [0.4, 1.1],
          this.diveSeed,
          `flock:${type}:alignment`,
        );
        cohesion.weight = resolveNumeric(
          [0.3, 1.0],
          this.diveSeed,
          `flock:${type}:cohesion`,
        );
        separation.weight = resolveNumeric(
          [0.6, 1.4],
          this.diveSeed,
          `flock:${type}:separation`,
        );
        this.flockingBehaviors.set(type, { alignment, cohesion, separation });
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
        }
        
        const wrap = new WrapPlayBandBehavior(this.viewportWidth);
        vehicle.steering.add(wrap);
        
        this.entityManager.add(vehicle);
        this.vehicleMap.set(c.id, vehicle);
      }
    }
    
    const activeIds = new Set(creatures.map(c => c.id));
    for (const [id, vehicle] of this.vehicleMap.entries()) {
      if (id !== "player" && !activeIds.has(id) && id.startsWith("beacon-")) {
        this.entityManager.remove(vehicle);
        this.vehicleMap.delete(id);
      }
    }
  }

  update(deltaTime: number) {
    this.currentTime += deltaTime;
    // Tick every PredatorBrain so the StateMachine + memory advance
    // before EntityManager integrates positions. Doing the brain tick
    // first ensures any state-induced steering toggle is in place
    // when the integration step runs.
    for (const brain of this.predatorBrainMap.values()) {
      brain.tick(deltaTime, this.currentTime);
    }
    this.entityManager.update(deltaTime);
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
    const length = 180 * lampScale * lampBoost;
    const halfSpread = 80 * lampScale * lampBoost;
    const halfAngle = Math.atan2(halfSpread, length);
    const lengthSq = length * length;
    for (const brain of this.predatorBrainMap.values()) {
      if (brain.currentAiState === "ambient") continue; // leviathans ignore lamp
      // Skip brains we recently damaged so the cone doesn't lock a
      // predator into permanent flee.
      if (this.currentTime - brain.lastDamageReceivedTime < 1.2) continue;
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
      brain.receiveDamage(this.currentTime);
    }
  }

  /**
   * IDs of predator brains whose HP has fallen to zero. The sim's
   * advance() filters these out of the next scene tick, then
   * syncPredators on the next call will prune them from the brain
   * map. Returning a set keeps the lookup O(1) on the caller side.
   */
  getDeadPredatorIds(): Set<string> {
    const dead = new Set<string>();
    for (const [id, brain] of this.predatorBrainMap) {
      if (brain.isDead()) dead.add(id);
    }
    return dead;
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
