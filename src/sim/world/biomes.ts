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
  
  const lastBiome = BIOMES[BIOMES.length - 1];
  
  // Infinite scaling beyond the trench floor into the Stygian Abyss
  const overflowMeters = Math.max(0, depthMeters - lastBiome.depthEndMeters);
  const layer = Math.floor(overflowMeters / 2000);
  
  // Degrade light to pure black, increase threats, drop normal creatures
  const densityMultiplier = Math.max(0, 1 - layer * 0.2); 
  const threatMultiplier = 1 + Math.log10(1 + layer);

  return {
    id: "stygian-abyss" as BiomeId,
    label: `Stygian Depth (Layer ${layer + 1})`,
    description: "Inky blackness. Only the largest, oldest things drift here.",
    depthStartMeters: lastBiome.depthEndMeters + layer * 2000,
    depthEndMeters: lastBiome.depthEndMeters + (layer + 1) * 2000,
    tintHex: "#000000",
    creatureDensity: lastBiome.creatureDensity * densityMultiplier,
    predatorDensity: lastBiome.predatorDensity * threatMultiplier,
    pirateDensity: 0, // Pirates don't go this deep
  };
}

export function biomeById(id: BiomeId): Biome {
  if (id === "stygian-abyss") {
    return biomeAtDepth(BIOMES[BIOMES.length - 1].depthEndMeters + 1);
  }
  const hit = BIOMES.find((b) => b.id === id);
  if (!hit) throw new Error(`biomeById: unknown biome '${id}'`);
  return hit;
}

export function nextBiome(id: BiomeId): Biome | null {
  if (id === "stygian-abyss") return null;
  const idx = BIOMES.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  if (idx >= BIOMES.length - 1) return biomeAtDepth(BIOMES[BIOMES.length - 1].depthEndMeters + 1);
  return BIOMES[idx + 1];
}
