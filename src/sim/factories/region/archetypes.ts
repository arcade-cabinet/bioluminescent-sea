import type { RegionSlots } from "./slots";

/**
 * Authored region catalogue. Each entry is a named recipe the dive
 * factory can pull into its region sequence.
 *
 * Most regions map 1:1 to a biome + a default chunk pool. Arena halls
 * are a distinct region type that reuses the biome for palette but
 * overrides the chunk pool to be entirely locked rooms.
 */
export interface RegionArchetype {
  id: string;
  label: string;
  slots: RegionSlots;
}

export const PHOTIC_GATE: RegionArchetype = {
  id: "photic-gate",
  label: "Photic Gate",
  slots: {
    biome: "photic-gate",
    traversal: "open",
    chunkPool: [
      { archetype: "open-drift", weight: 4 },
      { archetype: "beacon-grove", weight: 2 },
    ],
    depthSpanMeters: { start: 0, end: 300 },
  },
};

export const TWILIGHT_SHELF: RegionArchetype = {
  id: "twilight-shelf",
  label: "Twilight Shelf",
  slots: {
    biome: "twilight-shelf",
    traversal: "open",
    chunkPool: [
      { archetype: "open-drift", weight: 5 },
      { archetype: "beacon-grove", weight: 1 },
    ],
    depthSpanMeters: { start: 300, end: 600 },
  },
};

export const MIDNIGHT_COLUMN: RegionArchetype = {
  id: "midnight-column",
  label: "Midnight Column",
  slots: {
    biome: "midnight-column",
    traversal: "open",
    chunkPool: [
      { archetype: "open-drift", weight: 4 },
      { archetype: "descent-corridor", weight: 2 },
    ],
    depthSpanMeters: { start: 600, end: 900 },
  },
};

export const ABYSSAL_TRENCH: RegionArchetype = {
  id: "abyssal-trench",
  label: "Abyssal Trench",
  slots: {
    biome: "abyssal-trench",
    traversal: "open",
    chunkPool: [
      { archetype: "descent-corridor", weight: 3 },
      { archetype: "open-drift", weight: 1 },
    ],
    depthSpanMeters: { start: 900, end: 1500 },
  },
};

/**
 * The arena hall — a gated region of locked rooms. Biome paint still
 * photic-gate for the palette (arena is not a descent experience) but
 * the chunk pool is entirely locked rooms.
 */
export const ARENA_HALL: RegionArchetype = {
  id: "arena-hall",
  label: "Arena Hall",
  slots: {
    biome: "photic-gate",
    traversal: "gated",
    chunkPool: [{ archetype: "arena-room", weight: 1 }],
    depthSpanMeters: { start: 0, end: 600 },
  },
};

export const REGION_ARCHETYPE_CATALOGUE = {
  "photic-gate": PHOTIC_GATE,
  "twilight-shelf": TWILIGHT_SHELF,
  "midnight-column": MIDNIGHT_COLUMN,
  "abyssal-trench": ABYSSAL_TRENCH,
  "arena-hall": ARENA_HALL,
} as const satisfies Record<string, RegionArchetype>;

export type RegionArchetypeId = keyof typeof REGION_ARCHETYPE_CATALOGUE;

export function getRegionArchetype(id: RegionArchetypeId): RegionArchetype {
  return REGION_ARCHETYPE_CATALOGUE[id];
}
