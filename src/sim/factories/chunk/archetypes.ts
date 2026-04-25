import type { ChunkSlots } from "./slots";

/**
 * The authored catalogue of chunk archetypes. Each archetype is a
 * ChunkSlots record with an id + player-facing label. The chunk factory
 * (createChunk) picks an archetype from this catalogue based on the
 * region's permitted-archetype list and the seeded RNG.
 *
 * Regions (biomes) declare which archetypes they can spawn; dives
 * (modes) declare the default travel type. A chunk inherits its slots
 * from its archetype, with optional region-level overrides.
 */
export interface ChunkArchetype {
  /** Stable id. Tests + save files key off this. */
  id: string;
  /** Player-facing label. Shown on the HUD objective panel when the
   * active chunk is the anchor of an objective. */
  label: string;
  /** Slot values. Inherits the DiveSlots defaults for unspecified fields. */
  slots: ChunkSlots;
}

/**
 * The baseline open-travel chunk — the default across exploration and
 * descent. Viewport follows the player; threats are scattered.
 */
export const OPEN_DRIFT: ChunkArchetype = {
  id: "open-drift",
  label: "Open Drift",
  slots: {
    travel: "open",
    threatPattern: "scattered",
    creatureDensity: 1,
    predatorDensity: 1,
    anomaliesAllowed: true,
    piratesAllowed: true,
    respawnOnReEnter: true,
  },
};

/**
 * A high-density bioluminescent pocket — more beacons, no threats. Used
 * by exploration-mode chunks that reward pure collection. Still open
 * travel.
 */
export const BEACON_GROVE: ChunkArchetype = {
  id: "beacon-grove",
  label: "Beacon Grove",
  slots: {
    travel: "open",
    threatPattern: "scattered",
    creatureDensity: 2.4,
    predatorDensity: 0,
    anomaliesAllowed: true,
    piratesAllowed: false,
    respawnOnReEnter: false,
  },
};

/**
 * Arena room — viewport clamps to the chunk, dense bullet-hell swarm,
 * clear-to-unlock adjacents. The spawn.ts pattern dispatch already
 * produces the right swarm for "bullet-hell"; the travel = locked-room
 * slot is what drives the camera.
 */
export const ARENA_ROOM: ChunkArchetype = {
  id: "arena-room",
  label: "Arena Room",
  slots: {
    travel: "locked-room",
    threatPattern: "bullet-hell",
    creatureDensity: 0.5,
    predatorDensity: 2,
    anomaliesAllowed: true,
    piratesAllowed: false,
    respawnOnReEnter: false,
  },
};

/**
 * Descent corridor — forced-vertical traversal inside a narrow lateral
 * band. Mirrors descent-mode's threatPattern default.
 */
export const DESCENT_CORRIDOR: ChunkArchetype = {
  id: "descent-corridor",
  label: "Descent Corridor",
  slots: {
    travel: "corridor",
    threatPattern: "scattered",
    creatureDensity: 1,
    predatorDensity: 1.2,
    anomaliesAllowed: true,
    piratesAllowed: true,
    respawnOnReEnter: true,
  },
};

export const CHUNK_ARCHETYPE_CATALOGUE = {
  "open-drift": OPEN_DRIFT,
  "beacon-grove": BEACON_GROVE,
  "arena-room": ARENA_ROOM,
  "descent-corridor": DESCENT_CORRIDOR,
} as const satisfies Record<string, ChunkArchetype>;

export type ChunkArchetypeId = keyof typeof CHUNK_ARCHETYPE_CATALOGUE;

export function getChunkArchetype(id: ChunkArchetypeId): ChunkArchetype {
  return CHUNK_ARCHETYPE_CATALOGUE[id];
}
