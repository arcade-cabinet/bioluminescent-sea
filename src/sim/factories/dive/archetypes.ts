import type { SessionMode } from "@/sim/_shared/sessionMode";
import type { RegionArchetypeId } from "@/sim/factories/region/archetypes";

/**
 * A dive archetype is the top of the factory pyramid. It picks:
 *   - which mode's slot record governs (DiveSlots),
 *   - the ordered sequence of region archetypes the player descends
 *     through (regions resolve into chunks, chunks resolve into
 *     actors).
 *
 * Adding a new dive variant (e.g. a "night arena" mode, a "chase"
 * exploration variant) is a new archetype here and a matching
 * DiveSlots entry in slots.ts. No branching on `mode === ...` anywhere
 * in the engine.
 */
export interface DiveArchetype {
  id: string;
  label: string;
  mode: SessionMode;
  /** Top-down region sequence the dive descends through. The last
   * region loops forever for infinite-depth modes (exploration, descent)
   * and is the final gated hall for arena. */
  regionSequence: readonly RegionArchetypeId[];
}

export const EXPLORATION_DEFAULT: DiveArchetype = {
  id: "exploration-default",
  label: "Exploration",
  mode: "exploration",
  regionSequence: [
    "photic-gate",
    "twilight-shelf",
    "midnight-column",
    "abyssal-trench",
  ],
};

export const DESCENT_DEFAULT: DiveArchetype = {
  id: "descent-default",
  label: "Descent",
  mode: "descent",
  regionSequence: [
    "photic-gate",
    "twilight-shelf",
    "midnight-column",
    "abyssal-trench",
  ],
};

export const ARENA_DEFAULT: DiveArchetype = {
  id: "arena-default",
  label: "Arena",
  mode: "arena",
  regionSequence: ["arena-hall"],
};

export const DIVE_ARCHETYPE_CATALOGUE = {
  "exploration-default": EXPLORATION_DEFAULT,
  "descent-default": DESCENT_DEFAULT,
  "arena-default": ARENA_DEFAULT,
} as const satisfies Record<string, DiveArchetype>;

export type DiveArchetypeId = keyof typeof DIVE_ARCHETYPE_CATALOGUE;

export function getDiveArchetype(id: DiveArchetypeId): DiveArchetype {
  return DIVE_ARCHETYPE_CATALOGUE[id];
}

/** Pick the default dive archetype for a mode — used by the landing's
 * mode triptych when the player picks a mode but hasn't chosen a
 * specific variant. */
export function getDefaultDiveArchetype(mode: SessionMode): DiveArchetype {
  for (const archetype of Object.values(DIVE_ARCHETYPE_CATALOGUE)) {
    if (archetype.mode === mode) return archetype;
  }
  throw new Error(`No default DiveArchetype registered for mode "${mode}"`);
}
