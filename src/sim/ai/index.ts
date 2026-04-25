/**
 * AI surface — Yuka steering for actors plus the GOAP layer that governs
 * any decision-making controller (player sub, enemy sub, future bots).
 *
 * Steering remains owned by `AIManager` (it holds Yuka Vehicles and ticks
 * them every frame). The GOAP layer is engine-agnostic — its `Think` brain
 * picks among `GoalEvaluator`s and the resulting `Goal` writes a per-frame
 * action onto the controller's output buffer.
 */

export { AIManager } from "./manager";
export {
  GoapInputProvider,
  IdleInputProvider,
  type GoapBrainOwner,
  type PlayerInputProvider,
  type PlayerSubObservation,
  createGoapBrainOwner,
} from "./PlayerSubController";
export {
  CompositeGoal,
  Goal,
  GoalEvaluator,
  type GoalStatus,
  Think,
} from "./goap";
export {
  createCollectBeaconsProfile,
  createIdleHoverProfile,
  createRamPredatorProfile,
} from "./goap/profiles";
