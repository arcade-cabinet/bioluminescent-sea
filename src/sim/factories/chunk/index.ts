export {
  CHUNK_HEIGHT_METERS,
  chunkAt,
  chunkIndexAtDepth,
  chunksInWindow,
} from "./chunk";

export {
  chunkLifecycleDelta,
  type ChunkLifecycleDelta,
} from "./lifecycle";

export {
  type ChunkArchetype,
  type ChunkArchetypeId,
  CHUNK_ARCHETYPE_CATALOGUE,
  getChunkArchetype,
  OPEN_DRIFT,
  BEACON_GROVE,
  ARENA_ROOM,
  DESCENT_CORRIDOR,
} from "./archetypes";

export {
  type ChunkSlots,
  type ChunkTravel,
} from "./slots";
