import type { DiveRunStats } from "@/sim/dive/types";

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
};

export function ensureRunStats(stats: DiveRunStats | undefined): DiveRunStats {
  return stats ?? ZERO_STATS;
}

export interface RunStatsFrameInput {
  predatorKillsThisFrame: number;
  anomalyPickupsThisFrame: number;
  currentBiomeId: string;
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

  return {
    predatorsKilled: previous.predatorsKilled + frame.predatorKillsThisFrame,
    buffsCollected: previous.buffsCollected + frame.anomalyPickupsThisFrame,
    biomesTraversed,
    maxChain: Math.max(previous.maxChain, frame.currentMultiplier),
    impactsTaken: previous.impactsTaken + (frame.collidedThisFrame ? 1 : 0),
    adrenalineTriggers:
      previous.adrenalineTriggers + (frame.adrenalineRisingEdge ? 1 : 0),
  };
}
