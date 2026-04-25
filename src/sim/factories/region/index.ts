export type { Biome, BiomeId, Chunk, Vec2, Vec3, WorldBounds } from "./types";
export { BIOMES, biomeAtDepth, biomeById, nextBiome } from "./biomes";

export {
  type RegionArchetype,
  type RegionArchetypeId,
  REGION_ARCHETYPE_CATALOGUE,
  getRegionArchetype,
  PHOTIC_GATE,
  TWILIGHT_SHELF,
  MIDNIGHT_COLUMN,
  ABYSSAL_TRENCH,
  ARENA_HALL,
} from "./archetypes";

export { type RegionSlots } from "./slots";
