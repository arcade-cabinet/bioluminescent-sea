import { COMPILED_BIOMES } from "../../../config/compiled/content";
import type { Biome, BiomeId } from "./types";

/**
 * The four biomes. Authored in `config/raw/biomes/*.json` and compiled
 * via `scripts/compile-content.mjs` (runs as prebuild/predev). Editing
 * biome properties means editing the JSON — no TypeScript edit needed.
 */
export const BIOMES: readonly Biome[] = COMPILED_BIOMES as readonly Biome[];

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
  if (idx < 0 || idx >= BIOMES.length - 1) return null;
  return BIOMES[idx + 1];
}
