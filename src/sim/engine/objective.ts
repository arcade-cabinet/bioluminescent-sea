import type { SceneState } from "@/sim/dive/types";
import {
  biomeAtDepth,
} from "@/sim/factories/region/biomes";
import type { ObjectiveProgress } from "@/sim/factories/dive";

/**
 * Per-frame objective advance. Given the new scene state + the chain
 * multiplier this frame + the biome/region the player is currently in,
 * update each in-queue objective's `current`. `completed` flips
 * latching true — an objective never "un-completes" if, say, the
 * player moves out of a region after hitting the target.
 *
 * Kind handlers live inline — this is the single file that reads
 * SceneState for progress, so each kind's semantics are trivially
 * auditable here.
 */
export function advanceObjectiveQueue(
  queue: readonly ObjectiveProgress[],
  scene: SceneState,
  multiplier: number,
  chunksCleared: number,
): ObjectiveProgress[] {
  const biome = biomeAtDepth(scene.depthTravelMeters);
  // Beacons collected so far = TOTAL - remaining. The engine already
  // knows this because creatures array shrinks as the player charts
  // them, but at the objective layer we want "how many did I just
  // chart" rolled up over time. Use a snapshot per-region: count the
  // *remaining* creatures whose region matches. This relies on the
  // fact that creature chunks inherit their region from biome mapping
  // at spawn time — a later change can attach regionId directly to
  // each creature for better accuracy.
  return queue.map((entry) => {
    if (entry.completed) return entry;
    const { objective } = entry;
    let next = entry.current;
    switch (objective.kind) {
      case "reach-depth": {
        next = scene.depthTravelMeters;
        break;
      }
      case "collect-beacons-in-region": {
        // Count charted creatures attributed to this region. Since
        // SceneState doesn't yet carry per-creature regionId, fall
        // back to: when the player is *in* that region, their current
        // creature count subtracted from a rolling max attributes
        // charts to it. Heuristic — acceptable until the creature
        // layer stores regionId.
        if (objective.regionId && biome.id === objective.regionId) {
          // Increment by +1 whenever the tracker is behind the raw
          // "creatures charted count" for this region window. A
          // better implementation piggybacks on collectCreatures'
          // return value; for now we conservatively treat the absence
          // of each tick's creature as progress.
          next = Math.min(objective.target, entry.current);
          // The engine calls this pass *after* collection resolves,
          // so the sim wires the actual "charted creature in region"
          // delta in through a future refactor. No mutation here
          // means this objective progresses only via explicit
          // increment in the collection pass.
        }
        break;
      }
      case "sustain-chain": {
        // Progress = the max multiplier observed this dive.
        if (multiplier > next) next = multiplier;
        break;
      }
      case "clear-regions": {
        // Progress = number of chunks cleared. The advance pass
        // upstream reports `chunksCleared` when a chunk's threats
        // drop to zero for the first time.
        next = chunksCleared;
        break;
      }
    }
    const completed = next >= objective.target;
    return { objective, current: next, completed };
  });
}

/**
 * Increment the "collect-beacons-in-region" objective current when a
 * creature is charted in the matching region. Called by the collection
 * pass with the scene's pre-collection biome.
 */
export function tallyBeaconCharted(
  queue: readonly ObjectiveProgress[],
  regionId: string,
): ObjectiveProgress[] {
  return queue.map((entry) => {
    if (entry.completed) return entry;
    const { objective } = entry;
    if (
      objective.kind === "collect-beacons-in-region" &&
      objective.regionId === regionId
    ) {
      const next = Math.min(objective.target, entry.current + 1);
      return { objective, current: next, completed: next >= objective.target };
    }
    return entry;
  });
}
