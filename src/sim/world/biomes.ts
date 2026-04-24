import type { Biome, BiomeId } from "./types";

/**
 * The four biomes, top-down. Depth ranges are chosen so the dive
 * target (~3200m) produces ~60–180s of descent at the tuned scroll
 * rate, matching the DESIGN.md player-journey target.
 */
export const BIOMES: readonly Biome[] = [
  {
    id: "photic-gate",
    label: "Photic Gate",
    description:
      "Surface light still reaches here. Plankton drift, a first taste of the trench.",
    depthStartMeters: 0,
    depthEndMeters: 400,
    // Warm kelp-green — the surface's last gift before the dark.
    tintHex: "#2a8a68",
    creatureDensity: 0.55,
    predatorDensity: 0,
    pirateDensity: 0,
  },
  {
    id: "twilight-shelf",
    label: "Twilight Shelf",
    description: "The water starts listening back. A slow predator paces the shelf.",
    depthStartMeters: 400,
    depthEndMeters: 1200,
    // Cool teal — the shelf is still readable but the sun is gone.
    tintHex: "#1e6a78",
    creatureDensity: 0.8,
    predatorDensity: 0.35,
    pirateDensity: 0.15,
  },
  {
    id: "midnight-column",
    label: "Midnight Column",
    description: "Bioluminescent bloom. Anglers and eels work the column together.",
    depthStartMeters: 1200,
    depthEndMeters: 2400,
    // Indigo bruise — the column's own color, a deep violet that
    // makes the mint creatures pop.
    tintHex: "#3a1d5a",
    creatureDensity: 1,
    predatorDensity: 0.7,
    pirateDensity: 0.5,
  },
  {
    id: "abyssal-trench",
    label: "Abyssal Trench",
    description: "Sparse, rare, cold. Lanterns from a wrecked flotilla sweep the dark.",
    depthStartMeters: 2400,
    depthEndMeters: 3600,
    // Ember warn — the trench floor smells of the warn-red palette,
    // because this is where the pirate lanterns and the rare red
    // alerts live.
    tintHex: "#6a1a2a",
    creatureDensity: 0.4,
    predatorDensity: 0.55,
    pirateDensity: 0.85,
  },
];

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
