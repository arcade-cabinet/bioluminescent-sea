/**
 * Pure entity factories + advance functions — no React, no DOM, no pixi.
 *
 * Each entity type owns one file: types live in types.ts; spawn +
 * advance live together in the type-specific module (creatures.ts,
 * predators.ts, pirates.ts, particles.ts, player.ts).
 *
 * PRs E + F replace the hardcoded `CREATURE_ANCHORS` table with
 * seed-driven chunked spawning. The advance functions stay intact.
 */

export * from "./types";
export * from "./factory";
export {
  CREATURE_ANCHORS,
  TOTAL_BEACONS,
  advanceCreature,
} from "./creatures";
export { advancePredator } from "./predators";
export { advancePirate } from "./pirates";
export {
  PARTICLE_COUNT,
  advanceParticle,
  getDeterministicWrapX,
} from "./particles";
export { advancePlayer, createInitialPlayer } from "./player";
