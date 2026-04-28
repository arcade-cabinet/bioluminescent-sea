import type { DiveRunStats } from "@/sim/dive/types";
import { lastPassedLandmark } from "@/sim/factories/region/landmarks";

/**
 * Pure accumulators for cumulative dive statistics. Each function
 * takes the previous stats + the current frame's edge events and
 * returns a fresh stats object — no mutation of inputs so the engine
 * stays pure and snapshot-friendly.
 *
 * Called from advanceDiveFrame at the end of the frame so all edge
 * events have been resolved by the time we accumulate.
 */

export const ZERO_STATS: DiveRunStats = {
  predatorsKilled: 0,
  buffsCollected: 0,
  biomesTraversed: [],
  maxChain: 1,
  impactsTaken: 0,
  adrenalineTriggers: 0,
  landmarksPassed: [],
};

export function ensureRunStats(stats: DiveRunStats | undefined): DiveRunStats {
  // Older snapshots may have been written before `landmarksPassed`
  // joined the schema — coerce to an empty array so callers can
  // always read the field without a guard.
  if (!stats) return ZERO_STATS;
  if (stats.landmarksPassed) return stats;
  return { ...stats, landmarksPassed: [] };
}

export interface RunStatsFrameInput {
  predatorKillsThisFrame: number;
  anomalyPickupsThisFrame: number;
  currentBiomeId: string;
  currentDepthMeters: number;
  currentMultiplier: number;
  collidedThisFrame: boolean;
  adrenalineRisingEdge: boolean;
}

/**
 * Fold one frame's edge events into the cumulative stats. Returns a
 * NEW object — never mutates `previous`. Biome list dedupes via
 * Set; the returned array preserves insertion order so the player
 * can read "the order I went through" as a journey.
 */
export function advanceRunStats(
  previous: DiveRunStats,
  frame: RunStatsFrameInput,
): DiveRunStats {
  const biomesTraversed = previous.biomesTraversed.includes(frame.currentBiomeId)
    ? previous.biomesTraversed
    : [...previous.biomesTraversed, frame.currentBiomeId];

  // Landmarks-passed: deepest authored landmark whose depth is at or
  // shallower than `currentDepthMeters` is the "last passed" — append
  // to the dive's running list when it's a new entry. Naturally
  // descent-ordered because deeper landmarks become eligible later.
  const lastPassed = lastPassedLandmark(frame.currentDepthMeters);
  const landmarksPassed =
    lastPassed && !previous.landmarksPassed.includes(lastPassed.id)
      ? [...previous.landmarksPassed, lastPassed.id]
      : previous.landmarksPassed;

  return {
    predatorsKilled: previous.predatorsKilled + frame.predatorKillsThisFrame,
    buffsCollected: previous.buffsCollected + frame.anomalyPickupsThisFrame,
    biomesTraversed,
    maxChain: Math.max(previous.maxChain, frame.currentMultiplier),
    impactsTaken: previous.impactsTaken + (frame.collidedThisFrame ? 1 : 0),
    adrenalineTriggers:
      previous.adrenalineTriggers + (frame.adrenalineRisingEdge ? 1 : 0),
    landmarksPassed,
  };
}
