import type { ChunkArchetypeId } from "@/sim/factories/chunk/archetypes";
import type { BiomeId } from "./types";

/**
 * Slot record for a region — the meso layer between a chunk and a
 * dive. A region is a biome-scoped sequence of chunks. Authored content
 * at this layer: which chunk archetypes appear, in what relative
 * weights, and whether the region is freely traversable (the player
 * swims through at will) or gated (the region locks the player inside
 * until some condition clears).
 */
export interface RegionSlots {
  /** The BiomeId this region paints with. Drives palette + ambient
   * audio + creature catalogue (via the existing biome table). */
  biome: BiomeId;
  /**
   * The chunk archetype pool for this region. The chunk factory picks
   * from this pool weighted by each entry's `weight`. Populating this
   * per-region is how we author "the twilight shelf is mostly open
   * drift with occasional beacon groves" vs "the arena hall is all
   * locked rooms."
   */
  chunkPool: readonly { archetype: ChunkArchetypeId; weight: number }[];
  /**
   * Whether the region as a whole allows free traversal. When `locked`,
   * the player cannot leave the region until the region-level objective
   * resolves — used by the arena-hall region where you must clear every
   * room before the hall opens back up.
   */
  traversal: "open" | "gated";
  /**
   * The dive's depth window this region occupies. Used by the dive
   * factory to sequence regions in a downward chain.
   */
  depthSpanMeters: { start: number; end: number };
}
