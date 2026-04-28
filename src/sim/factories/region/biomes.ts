import { COMPILED_BIOMES } from "../../../../config/compiled/content";
import type { Biome, BiomeId } from "./types";

/**
 * The five proper pelagic depth zones. Authored in
 * `config/raw/biomes/*.json` and compiled via `scripts/compile-content.mjs`
 * (runs as prebuild/predev). Editing biome properties means editing
 * the JSON — no TypeScript edit needed.
 *
 * Order is surface → hadal: epipelagic, mesopelagic, bathypelagic,
 * abyssopelagic, hadopelagic. The taxonomy is open-ended — benthic
 * features (continental-shelf, abyssal-plain, hydrothermal-vent,
 * whale-fall, hadal-trench) layer on top in a follow-up expansion.
 */
export const BIOMES: readonly Biome[] = COMPILED_BIOMES as readonly Biome[];

/**
 * Pick the biome containing this depth. Past the deepest authored
 * zone (hadopelagic ends at 11000m — the deepest known point in any
 * real ocean) the function falls through to the deepest zone, so
 * extreme overshoots still get a defined biome rather than null.
 */
export function biomeAtDepth(depthMeters: number): Biome {
  for (const biome of BIOMES) {
    if (depthMeters < biome.depthEndMeters) return biome;
  }
  return BIOMES[BIOMES.length - 1];
}

export function biomeById(id: BiomeId): Biome {
  const hit = BIOMES.find((b) => b.id === id);
  if (!hit) throw new Error(`biomeById: unknown biome '${id}'`);
  return hit;
}

export function nextBiome(id: BiomeId): Biome | null {
  const idx = BIOMES.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  if (idx >= BIOMES.length - 1) return null;
  return BIOMES[idx + 1];
}
