import { createRng } from "@/sim/rng";
import type { Chunk } from "@/sim/factories/region/types";
import {
  getRegionArchetype,
  type RegionArchetypeId,
} from "@/sim/factories/region/archetypes";
import type { RegionSlots } from "@/sim/factories/region/slots";
import {
  type ChunkArchetype,
  getChunkArchetype,
} from "./archetypes";

/**
 * Given a dive's region sequence and the chunk's depth, pick the
 * region archetype that contains it. Regions are ordered top-down;
 * chunks past the last region's depth loop the last region (infinite
 * abyss for exploration/descent). Arena dives have a single region.
 */
export function resolveRegionForChunk(
  chunk: Chunk,
  regionSequence: readonly RegionArchetypeId[],
): { id: RegionArchetypeId; slots: RegionSlots } {
  // Resolve by the chunk's vertical midpoint so a boundary-straddling
  // chunk inherits the region that contains most of it. Using the
  // shallow edge would pull a 400m-tall chunk spanning 500m-900m into
  // the 300m-600m twilight-shelf region even though 300m of it is in
  // the midnight column.
  const midpoint = (chunk.yTopMeters + chunk.yBottomMeters) * 0.5;
  for (const id of regionSequence) {
    const archetype = getRegionArchetype(id);
    const { start, end } = archetype.slots.depthSpanMeters;
    if (midpoint >= start && midpoint < end) {
      return { id, slots: archetype.slots };
    }
  }
  const fallbackId = regionSequence[regionSequence.length - 1];
  return { id: fallbackId, slots: getRegionArchetype(fallbackId).slots };
}

/**
 * Pick a chunk archetype from the region's pool, weighted by each
 * entry's `weight`. The chunk's `seed` + `index` make the pick
 * deterministic — the same dive always resolves each chunk to the
 * same archetype.
 */
export function pickChunkArchetype(
  chunk: Chunk,
  regionSlots: RegionSlots,
): ChunkArchetype {
  const { chunkPool } = regionSlots;
  if (chunkPool.length === 0) {
    throw new Error("Region chunk pool is empty");
  }
  if (chunkPool.length === 1) {
    return getChunkArchetype(chunkPool[0].archetype);
  }
  const totalWeight = chunkPool.reduce((sum, entry) => sum + entry.weight, 0);
  const rng = createRng(chunk.seed ^ (chunk.index * 2654435761) | 0);
  let roll = rng.next() * totalWeight;
  for (const entry of chunkPool) {
    roll -= entry.weight;
    if (roll <= 0) {
      return getChunkArchetype(entry.archetype);
    }
  }
  return getChunkArchetype(chunkPool[chunkPool.length - 1].archetype);
}
