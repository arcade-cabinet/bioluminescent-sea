import { EntityManager, Time, AlignmentBehavior, CohesionBehavior, SeparationBehavior } from "yuka";
import type { Player, Predator, Pirate, Creature } from "@/sim/entities/types";
import { getArchetype } from "@/sim/factories/actor";
import {
  EnemySubHuntBehavior,
  GameVehicle,
  StalkAndDashBehavior,
  WanderBehavior,
  WrapPlayBandBehavior,
} from "./steering";
import type { ViewportDimensions } from "@/sim/dive/types";
import { resolveNumeric } from "@/sim/_shared/variance";

const MARAUDER_SUB_ARCHETYPE = getArchetype("marauder-sub");

export class AIManager {
  public entityManager: EntityManager;
  public time: Time;
  private playerVehicle: GameVehicle;
  private vehicleMap: Map<string, GameVehicle>;
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
      let vehicle = this.vehicleMap.get(p.id);
      if (!vehicle) {
        vehicle = new GameVehicle(p.id);
        vehicle.position.set(p.x, p.y, 0);
        const baseSpeed = p.speed * 60;
        vehicle.maxSpeed = baseSpeed;

        // Route by archetype id prefix. The chunked spawner tags
        // marauder-sub entities with the `marauder-sub-` prefix so
        // we can wire the archetype-specific hunting behaviour here
        // without a second ECS trait for enemy subs.
        if (p.id.startsWith("marauder-sub")) {
          const seed =
            Math.floor(p.x * 1000) + Math.floor(p.y * 1000) + Math.floor(p.speed * 1000);
          const hunt = new EnemySubHuntBehavior(
            this.playerVehicle.position,
            baseSpeed,
            MARAUDER_SUB_ARCHETYPE.detectionRadius,
            seed,
          );
          vehicle.steering.add(hunt);
        } else {
          // Per-predator subseed so two predators in the same dive
          // don't share commit/cooldown/dash cadence. Mixing position
          // + speed gives a stable but uncorrelated seed across the
          // population.
          const stalkSeed =
            Math.floor(p.x * 1000) +
            Math.floor(p.y * 1000) * 31 +
            Math.floor(p.speed * 1000) * 1009;
          const stalk = new StalkAndDashBehavior(
            this.playerVehicle.position,
            baseSpeed,
            stalkSeed,
          );
          vehicle.steering.add(stalk);
        }

        const wrap = new WrapPlayBandBehavior(this.viewportWidth);
        vehicle.steering.add(wrap);

        this.entityManager.add(vehicle);
        this.vehicleMap.set(p.id, vehicle);
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
    this.entityManager.update(deltaTime);
  }

  readPredator(p: Predator): Predator {
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
