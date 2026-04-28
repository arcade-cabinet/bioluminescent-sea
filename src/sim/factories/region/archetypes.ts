import type { RegionSlots } from "./slots";

/**
 * Authored region catalogue. Each entry is a named recipe the dive
 * factory can pull into its region sequence.
 *
 * One region per pelagic depth zone — the regions inherit their
 * biome paint, density, and ecology from the JSON-authored biome
 * catalogue. Arena halls are a separate region type that reuses a
 * biome for palette but overrides the chunk pool to be locked rooms.
 */
export interface RegionArchetype {
  id: string;
  label: string;
  slots: RegionSlots;
}

export const EPIPELAGIC_REGION: RegionArchetype = {
  id: "epipelagic",
  label: "Sunlight Zone",
  slots: {
    biome: "epipelagic",
    traversal: "open",
    chunkPool: [
      { archetype: "open-drift", weight: 4 },
      { archetype: "beacon-grove", weight: 2 },
    ],
    depthSpanMeters: { start: 0, end: 500 },
  },
};

export const MESOPELAGIC_REGION: RegionArchetype = {
  id: "mesopelagic",
  label: "Twilight Zone",
  slots: {
    biome: "mesopelagic",
    traversal: "open",
    chunkPool: [
      { archetype: "open-drift", weight: 5 },
      { archetype: "beacon-grove", weight: 1 },
    ],
    depthSpanMeters: { start: 500, end: 1500 },
  },
};

export const BATHYPELAGIC_REGION: RegionArchetype = {
  id: "bathypelagic",
  label: "Midnight Zone",
  slots: {
    biome: "bathypelagic",
    traversal: "open",
    chunkPool: [
      { archetype: "open-drift", weight: 4 },
      { archetype: "descent-corridor", weight: 2 },
    ],
    depthSpanMeters: { start: 1500, end: 3000 },
  },
};

export const ABYSSOPELAGIC_REGION: RegionArchetype = {
  id: "abyssopelagic",
  label: "The Abyss",
  slots: {
    biome: "abyssopelagic",
    traversal: "open",
    chunkPool: [
      { archetype: "descent-corridor", weight: 3 },
      { archetype: "open-drift", weight: 1 },
    ],
    depthSpanMeters: { start: 3000, end: 5000 },
  },
};

export const HADOPELAGIC_REGION: RegionArchetype = {
  id: "hadopelagic",
  label: "The Hadal",
  slots: {
    biome: "hadopelagic",
    traversal: "open",
    chunkPool: [
      { archetype: "descent-corridor", weight: 4 },
      { archetype: "open-drift", weight: 1 },
    ],
    depthSpanMeters: { start: 5000, end: 11000 },
  },
};

/**
 * The arena hall — a gated region of locked rooms. Biome paint
 * inherits epipelagic for the palette (arena is not a descent
 * experience) but the chunk pool is entirely locked rooms.
 */
export const ARENA_HALL: RegionArchetype = {
  id: "arena-hall",
  label: "Arena Hall",
  slots: {
    biome: "epipelagic",
    traversal: "gated",
    chunkPool: [{ archetype: "arena-room", weight: 1 }],
    depthSpanMeters: { start: 0, end: 600 },
  },
};

export const REGION_ARCHETYPE_CATALOGUE = {
  epipelagic: EPIPELAGIC_REGION,
  mesopelagic: MESOPELAGIC_REGION,
  bathypelagic: BATHYPELAGIC_REGION,
  abyssopelagic: ABYSSOPELAGIC_REGION,
  hadopelagic: HADOPELAGIC_REGION,
  "arena-hall": ARENA_HALL,
} as const satisfies Record<string, RegionArchetype>;

export type RegionArchetypeId = keyof typeof REGION_ARCHETYPE_CATALOGUE;

export function getRegionArchetype(id: RegionArchetypeId): RegionArchetype {
  return REGION_ARCHETYPE_CATALOGUE[id];
}
