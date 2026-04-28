export type { Biome, BiomeId, Chunk, Vec2, Vec3, WorldBounds } from "./types";
export { BIOMES, biomeAtDepth, biomeById, nextBiome } from "./biomes";

export {
  type RegionArchetype,
  type RegionArchetypeId,
  REGION_ARCHETYPE_CATALOGUE,
  getRegionArchetype,
  EPIPELAGIC_REGION,
  MESOPELAGIC_REGION,
  BATHYPELAGIC_REGION,
  ABYSSOPELAGIC_REGION,
  HADOPELAGIC_REGION,
  ARENA_HALL,
} from "./archetypes";

export { type RegionSlots } from "./slots";
