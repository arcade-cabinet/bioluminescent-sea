import { createWorld, type Entity, type World } from "koota";
import type { SceneState } from "@/sim/dive/types";
import {
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

  const rootEntity = world.spawn(DiveRoot({ totalTime: 0, threatFlashAlpha: 0 }));
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
  const particleEntities = scene.particles.map((p) =>
    world.spawn(ParticleEntity({ value: p }))
  );

  return {
    world,
    rootEntity,
    playerEntity,
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

  // Creatures: indexed by order; a shorter list means some were collected.
  const nextCreatures: Entity[] = [];
  for (let i = 0; i < scene.creatures.length; i++) {
    const entity = w.creatureEntities[i];
    if (!entity) break;
    entity.set(CreatureEntity, { value: scene.creatures[i] });
    nextCreatures.push(entity);
  }
  // Destroy any entities beyond the new length (collected this frame).
  for (let i = scene.creatures.length; i < w.creatureEntities.length; i++) {
    w.creatureEntities[i].destroy();
  }

  for (let i = 0; i < scene.predators.length; i++) {
    w.predatorEntities[i].set(PredatorEntity, { value: scene.predators[i] });
  }
  for (let i = 0; i < scene.pirates.length; i++) {
    w.pirateEntities[i].set(PirateEntity, { value: scene.pirates[i] });
  }
  for (let i = 0; i < scene.particles.length; i++) {
    w.particleEntities[i].set(ParticleEntity, { value: scene.particles[i] });
  }

  return { ...w, creatureEntities: nextCreatures };
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

