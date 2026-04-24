/**
 * Dive lifecycle — the top-level engine API.
 *
 * Public surface: types, constants, mode tuning, scene advance,
 * collection mechanics, telemetry, objective copy, impact resolution.
 *
 * PRs E + F add `createDive(seed, config)` / `advanceDive(state, …)`
 * as the seeded, chunked replacement for the current viewport-scoped
 * `createInitialScene` / `advanceScene`. Both APIs coexist during
 * the transition.
 */

export * from "./types";
export { GAME_DURATION, MAX_CHAIN_MULTIPLIER, STREAK_WINDOW_SECONDS } from "./constants";
export { getDiveDurationSeconds, getDiveModeTuning } from "./mode";
export { advanceScene, createInitialScene } from "./advance";
export { createSeededScene } from "./seeded";
export {
  calculateMultiplier,
  collectCreatures,
  findNearestBeaconVector,
  findNearestThreatDistance,
  hasPredatorCollision,
} from "./collection";
export {
  ROUTE_LANDMARKS,
  getDiveCompletionCelebration,
  getDiveRouteLandmark,
  getDiveRunSummary,
  getDiveTelemetry,
  isDiveComplete,
} from "./telemetry";
export { describeDiveObjective, getPressureLabel } from "./objectives";
export { resolveDiveThreatImpact } from "./impact";
