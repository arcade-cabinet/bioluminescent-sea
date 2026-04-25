/**
 * Predator brain types.
 *
 * The brain is a Yuka Vehicle extended with a StateMachine, MemorySystem,
 * Vision, FuzzyModule, and Think (Goal evaluator). Each archetype
 * (`abyssal-predator`, `torpedo-eel`, `shadow-octopus`) plugs into the
 * same brain shape with archetype-specific tuning constants — the
 * states themselves stay shared.
 *
 * The shape lives in its own file so individual states can import the
 * type without introducing a circular dependency on the brain itself.
 */
import type { Vector3 } from "yuka";
import type { PredatorAiState } from "@/sim/entities/types";

/**
 * Per-archetype tuning. Authored once per predator id in
 * `src/sim/ai/predator-brain/archetype-profiles.ts` so a new species
 * adds a row, not a behaviour fork.
 */
export interface PredatorArchetypeProfile {
  id: string;
  /** Patrol radius around the spawn anchor (px). */
  patrolRadiusPx: number;
  /** When the player enters this radius the brain transitions
   *  patrol → stalk. */
  detectionRadiusPx: number;
  /** Hard cutoff: when the player is this close, brain transitions
   *  stalk → charge regardless of fuzzy desirability. */
  commitRadiusPx: number;
  /** Charge windup duration in seconds. The renderer reads
   *  stateProgress to drive the windup posture. */
  chargeWindupSeconds: number;
  /** Strike duration — the actual lunge motion. */
  strikeDurationSeconds: number;
  /** Recovery — post-strike daze. Predator is sluggish + vulnerable. */
  recoverDurationSeconds: number;
  /** Maximum cruising speed (steady patrol). */
  patrolMaxSpeed: number;
  /** Maximum stalking speed (closing on player). */
  stalkMaxSpeed: number;
  /** Strike speed — the actual lunge. Eel sprint-darts have huge
   *  strikeMaxSpeed; octopus grapplers have tiny strikeMaxSpeed but
   *  longer chargeWindupSeconds. */
  strikeMaxSpeed: number;
  /** Vision field-of-view in radians. */
  fovRadians: number;
  /** Memory retention in seconds — how long the predator chases the
   *  last known position after losing sight. */
  memorySpanSeconds: number;
  /** When a packmate broadcasts engage, this predator picks a flank
   *  offset this many radians off the engage angle. Per archetype
   *  because eels flank wider than octopi. */
  flankAngleOffset: number;
}

/**
 * Brain handle exposed by each predator-brain Vehicle. The renderer +
 * sim layer read these fields without needing to know about Yuka's
 * internals; the AIManager populates them every tick from the Vehicle's
 * StateMachine.
 *
 * The brain itself is a class that extends Yuka's Vehicle — see
 * `src/sim/ai/predator-brain/PredatorBrain.ts`.
 */
export interface PredatorBrainHandle {
  /** Stable id matching the Predator entity. */
  id: string;
  /** Last known player position. Used by stalk-state and the
   *  no-line-of-sight rotate-to-last-seen behaviour. */
  lastKnownPlayerPosition: Vector3;
  /** Current AI state name — transcribed from the StateMachine each
   *  tick. Matches PredatorAiState. */
  currentAiState: PredatorAiState;
  /** 0..1 elapsed-into-state progress used by the renderer. */
  currentStateProgress: number;
  /** Profile this brain was constructed with. */
  profile: PredatorArchetypeProfile;
}
