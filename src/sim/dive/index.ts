/**
 * Dive lifecycle — the top-level public API.
 *
 * Re-exports from the runtime (engine/), the slot factory
 * (factories/dive/), and the dive-local types/constants/objective copy.
 * Other layers import from here so the refactor seam stays in one
 * place.
 */

export * from "./types";
export { GAME_DURATION, MAX_CHAIN_MULTIPLIER, STREAK_WINDOW_SECONDS } from "./constants";
export { getDiveDurationSeconds, getDiveModeTuning } from "@/sim/engine/mode";
export {
  MODE_TEMPLATES,
  getModeSlots,
  resolveModeSlots,
  type ModeSlots,
} from "@/sim/factories/dive/slots";
export { advanceScene, createInitialScene, resetAIManager } from "@/sim/engine/advance";
export {
  calculateMultiplier,
  collectCreatures,
  findNearestBeaconVector,
  findNearestThreatDistance,
  hasPredatorCollision,
} from "@/sim/engine/collection";
export {
  ROUTE_LANDMARKS,
  getDiveCompletionCelebration,
  getDiveRouteLandmark,
  getDiveRunSummary,
  getDiveTelemetry,
  isDiveComplete,
} from "@/sim/engine/telemetry";
export { describeDiveObjective, getPressureLabel } from "./objectives";
export { resolveDiveThreatImpact } from "@/sim/engine/impact";
