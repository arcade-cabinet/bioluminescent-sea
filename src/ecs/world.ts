import { createWorld, type Entity, type World } from "koota";
import type { SceneState } from "@/sim/dive/types";
import {
  AnomalyEntity,
  CreatureEntity,
  DiveRoot,
  ParticleEntity,
  PirateEntity,
  PlayerAvatar,
  PredatorEntity,
} from "./traits";

/**
 * createDiveWorld(scene) — lift an initial scene into a Koota world.
 *
 * One DiveRoot entity holds scene-wide state. One PlayerAvatar. N
 * CreatureEntity rows, N PredatorEntity, N PirateEntity, N
 * ParticleEntity. Each entity stores its sim payload verbatim in a
 * `.value` field until PR F splits them into per-field traits.
 */
export interface DiveWorld {
  world: World;
  rootEntity: Entity;
  playerEntity: Entity;
  anomalyEntities: Entity[];
  creatureEntities: Entity[];
  predatorEntities: Entity[];
  pirateEntities: Entity[];
  particleEntities: Entity[];
  /**
   * Chunk indices currently live in the world. Updated each frame
   * as the sub descends — chunks that fall off the top retire,
   * chunks that enter the lookahead window below spawn new
   * creatures. Populated by advanceDiveFrame's chunk-lifecycle
   * step.
   */
  liveChunkIndices: Set<number>;
  /**
   * Master seed used to derive per-chunk seeds (and per-chunk
   * content) during lifecycle spawns. Frozen at world creation so
   * spawn results are reproducible across the dive.
   */
  masterSeed: number;
}

export function createDiveWorld(scene: SceneState, masterSeed = 0): DiveWorld {
  const world = createWorld();

  const rootEntity = world.spawn(
    DiveRoot({
      totalTime: 0,
      threatFlashAlpha: 0,
      objectiveQueueJson: JSON.stringify(scene.objectiveQueue),
    }),
  );
  const playerEntity = world.spawn(PlayerAvatar({ value: scene.player }));

  const creatureEntities = scene.creatures.map((c) =>
    world.spawn(CreatureEntity({ value: c }))
  );
  const predatorEntities = scene.predators.map((p) =>
    world.spawn(PredatorEntity({ value: p }))
  );
  const pirateEntities = scene.pirates.map((p) =>
    world.spawn(PirateEntity({ value: p }))
  );
  const anomalyEntities = scene.anomalies.map((a) =>
    world.spawn(AnomalyEntity({ value: a }))
  );
  const particleEntities = scene.particles.map((p) =>
    world.spawn(ParticleEntity({ value: p }))
  );

  return {
    world,
    rootEntity,
    playerEntity,
    anomalyEntities,
    creatureEntities,
    predatorEntities,
    pirateEntities,
    particleEntities,
    liveChunkIndices: new Set<number>(),
    masterSeed,
  };
}

/**
 * Reassemble a SceneState from the current world. The sim step
 * consumes a plain SceneState, so this bridges ECS → sim on each
 * frame. When PR E + F land, the sim will be reshaped to operate on
 * traits directly and this adapter will disappear.
 */
export function readSceneFromWorld(w: DiveWorld): SceneState {
  const player = w.playerEntity.get(PlayerAvatar)?.value;
  if (!player) throw new Error("readSceneFromWorld: player entity missing PlayerAvatar");
  const root = w.rootEntity.get(DiveRoot);
  return {
    anomalies: w.anomalyEntities.map((e) => {
      const t = e.get(AnomalyEntity);
      if (!t) throw new Error("Anomaly entity missing trait");
      return t.value;
    }),
    creatures: w.creatureEntities.map((e) => {
      const t = e.get(CreatureEntity);
      if (!t) throw new Error("Creature entity missing trait");
      return t.value;
    }),
    predators: w.predatorEntities.map((e) => {
      const t = e.get(PredatorEntity);
      if (!t) throw new Error("Predator entity missing trait");
      return t.value;
    }),
    pirates: w.pirateEntities.map((e) => {
      const t = e.get(PirateEntity);
      if (!t) throw new Error("Pirate entity missing trait");
      return t.value;
    }),
    particles: w.particleEntities.map((e) => {
      const t = e.get(ParticleEntity);
      if (!t) throw new Error("Particle entity missing trait");
      return t.value;
    }),
    player,
    depthTravelMeters: root?.depthTravelMeters ?? 0,
    objectiveQueue: root?.objectiveQueueJson
      ? (JSON.parse(root.objectiveQueueJson) as SceneState["objectiveQueue"])
      : [],
  };
}

/**
 * Write an advanced SceneState back to the world. Creatures may be
 * dropped during the frame (collected); dropped entities are
 * destroyed and the Entity[] is pruned.
 */
export function writeSceneToWorld(w: DiveWorld, scene: SceneState): DiveWorld {
  w.playerEntity.set(PlayerAvatar, { value: scene.player });
  w.rootEntity.set(DiveRoot, (prev) => ({
    ...prev,
    depthTravelMeters: scene.depthTravelMeters,
  }));

  const nextCreatures = syncEntities(
    w.creatureEntities,
    scene.creatures,
    CreatureEntity,
  );
  const nextPredators = syncEntities(
    w.predatorEntities,
    scene.predators,
    PredatorEntity,
  );
  const nextPirates = syncEntities(
    w.pirateEntities,
    scene.pirates,
    PirateEntity,
  );
  const nextAnomalies = syncEntities(
    w.anomalyEntities,
    scene.anomalies,
    AnomalyEntity,
  );
  const nextParticles = syncEntities(
    w.particleEntities,
    scene.particles,
    ParticleEntity,
  );

  return {
    ...w,
    anomalyEntities: nextAnomalies,
    creatureEntities: nextCreatures,
    predatorEntities: nextPredators,
    pirateEntities: nextPirates,
    particleEntities: nextParticles,
  };
}

// biome-ignore lint/suspicious/noExplicitAny: trait factories differ per trait; values are homogeneous
function syncEntities<T>(entities: Entity[], values: readonly T[], trait: any): Entity[] {
  const n = values.length;
  if (n === entities.length) {
    for (let i = 0; i < n; i++) {
      entities[i].set(trait, { value: values[i] });
    }
    return entities;
  }
  const next: Entity[] = [];
  const fit = Math.min(n, entities.length);
  for (let i = 0; i < fit; i++) {
    entities[i].set(trait, { value: values[i] });
    next.push(entities[i]);
  }
  for (let i = n; i < entities.length; i++) {
    entities[i].destroy();
  }
  return next;
}

/**
 * Append newly-spawned creatures (from a chunk that just entered
 * the camera window) into the world. Returns a new DiveWorld with
 * the extended `creatureEntities` list. The scene snapshot that
 * the sim steps over is rebuilt next frame via `readSceneFromWorld`.
 */
export function appendCreaturesToWorld(
  w: DiveWorld,
  creatures: readonly import("@/sim/entities/types").Creature[],
): DiveWorld {
  if (creatures.length === 0) return w;
  const newEntities = creatures.map((c) =>
    w.world.spawn(CreatureEntity({ value: c }))
  );
  return { ...w, creatureEntities: [...w.creatureEntities, ...newEntities] };
}

/**
 * Destroy every creature entity whose id was produced by a
 * retired chunk's spawner (`beacon-c${index}-...`). Returns a new
 * DiveWorld with the pruned list.
 */
export function retireChunkCreatures(
  w: DiveWorld,
  retiredIndices: readonly number[],
): DiveWorld {
  if (retiredIndices.length === 0) return w;
  const retiredSet = new Set(retiredIndices);
  const kept: Entity[] = [];
  for (const entity of w.creatureEntities) {
    const trait = entity.get(CreatureEntity);
    const id = trait?.value.id ?? "";
    // chunked-spawn ids are shaped `beacon-c<idx>-<n>`. Parse the
    // index out; non-chunked creatures (legacy seeded spawn) keep
    // their entities — the lifecycle only touches chunked ones.
    const match = id.match(/^beacon-c(\d+)-/);
    if (match && retiredSet.has(Number.parseInt(match[1], 10))) {
      entity.destroy();
      continue;
    }
    kept.push(entity);
  }
  return { ...w, creatureEntities: kept };
}

export function destroyDiveWorld(w: DiveWorld): void {
  // Koota caps worlds at 16 globally. Calling `world.destroy()`
  // releases the worldId back to the pool; without it, StrictMode +
  // HMR + dive restart exhaust the cap within a few interactions.
  w.world.destroy();
}

/** Append newly-spawned predators from chunks that just entered view. */
export function appendPredatorsToWorld(
  w: DiveWorld,
  predators: readonly import("@/sim/entities/types").Predator[],
): DiveWorld {
  if (predators.length === 0) return w;
  const newEntities = predators.map((p) =>
    w.world.spawn(PredatorEntity({ value: p }))
  );
  return { ...w, predatorEntities: [...w.predatorEntities, ...newEntities] };
}

/** Destroy every predator entity belonging to a retired chunk. */
export function retireChunkPredators(
  w: DiveWorld,
  retiredIndices: readonly number[],
): DiveWorld {
  if (retiredIndices.length === 0) return w;
  const retiredSet = new Set(retiredIndices);
  const kept: Entity[] = [];
  // chunked spawner ids for predators:
  //   predator-c<idx>-<n>
  //   marauder-sub-c<idx>-<n>   (bullet-hell enemy subs)
  //   leviathan-c<idx>          (stygian boss)
  const pattern = /^(?:predator|marauder-sub|leviathan)-c(\d+)(?:-\d+)?$/;
  for (const entity of w.predatorEntities) {
    const trait = entity.get(PredatorEntity);
    const id = trait?.value.id ?? "";
    const match = id.match(pattern);
    if (match && retiredSet.has(Number.parseInt(match[1], 10))) {
      entity.destroy();
      continue;
    }
    kept.push(entity);
  }
  return { ...w, predatorEntities: kept };
}

export function appendPiratesToWorld(
  w: DiveWorld,
  pirates: readonly import("@/sim/entities/types").Pirate[],
): DiveWorld {
  if (pirates.length === 0) return w;
  const newEntities = pirates.map((p) =>
    w.world.spawn(PirateEntity({ value: p }))
  );
  return { ...w, pirateEntities: [...w.pirateEntities, ...newEntities] };
}

export function retireChunkPirates(
  w: DiveWorld,
  retiredIndices: readonly number[],
): DiveWorld {
  if (retiredIndices.length === 0) return w;
  const retiredSet = new Set(retiredIndices);
  const kept: Entity[] = [];
  for (const entity of w.pirateEntities) {
    const trait = entity.get(PirateEntity);
    const id = trait?.value.id ?? "";
    const match = id.match(/^pirate-c(\d+)-/);
    if (match && retiredSet.has(Number.parseInt(match[1], 10))) {
      entity.destroy();
      continue;
    }
    kept.push(entity);
  }
  return { ...w, pirateEntities: kept };
}

export function appendAnomaliesToWorld(
  w: DiveWorld,
  anomalies: readonly import("@/sim/entities/types").Anomaly[],
): DiveWorld {
  if (anomalies.length === 0) return w;
  const newEntities = anomalies.map((a) =>
    w.world.spawn(AnomalyEntity({ value: a }))
  );
  return { ...w, anomalyEntities: [...w.anomalyEntities, ...newEntities] };
}

export function retireChunkAnomalies(
  w: DiveWorld,
  retiredIndices: readonly number[],
): DiveWorld {
  if (retiredIndices.length === 0) return w;
  const retiredSet = new Set(retiredIndices);
  const kept: Entity[] = [];
  for (const entity of w.anomalyEntities) {
    const trait = entity.get(AnomalyEntity);
    const id = trait?.value.id ?? "";
    const match = id.match(/^anomaly-c(\d+)$/);
    if (match && retiredSet.has(Number.parseInt(match[1], 10))) {
      entity.destroy();
      continue;
    }
    kept.push(entity);
  }
  return { ...w, anomalyEntities: kept };
}

