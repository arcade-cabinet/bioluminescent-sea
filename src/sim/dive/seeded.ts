import {
  spawnSeededCreatures,
  spawnSeededParticles,
  spawnSeededPirates,
  spawnSeededPlayer,
  spawnSeededPredators,
} from "@/sim/entities/seeded-spawn";
import { createRng, hashSeed } from "@/sim/rng";
import type { SceneState, ViewportDimensions } from "./types";

/**
 * Seed-driven dive initialization.
 *
 * `createSeededScene(seed, viewport)` is the production path: every
 * creature / predator / pirate / particle placement derives from
 * `createRng(seed)`. Coexists with `createInitialScene(viewport)` so
 * the legacy/test path stays available.
 *
 * Hashes are applied per-category so adding a new entity kind (e.g.
 * PR F's chunked creatures) doesn't shift existing entity positions
 * for a given seed.
 */
export function createSeededScene(seed: number, viewport: ViewportDimensions): SceneState {
  const creatureRng = createRng(hashSeed(seed, 0x1001));
  const predatorRng = createRng(hashSeed(seed, 0x1002));
  const pirateRng = createRng(hashSeed(seed, 0x1003));
  const particleRng = createRng(hashSeed(seed, 0x1004));

  return {
    creatures: spawnSeededCreatures(creatureRng, viewport),
    particles: spawnSeededParticles(particleRng, viewport),
    pirates: spawnSeededPirates(pirateRng, viewport),
    player: spawnSeededPlayer(viewport),
    predators: spawnSeededPredators(predatorRng, viewport),
    depthTravelMeters: 0,
  };
}
