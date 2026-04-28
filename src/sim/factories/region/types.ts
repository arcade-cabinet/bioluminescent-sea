/**
 * World-space primitives.
 *
 * Bioluminescent Sea is a 3D world rendered to a 2D canvas. Positions
 * are authored in world-meters (x horizontal, y vertical with +y down
 * into the trench, z depth-into-scene used for parallax layering).
 * A camera projects (x, y, z) → screen pixels; see src/render/camera.
 *
 * The engine never touches pixels. The renderer never touches meters.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Depth-zone IDs use proper oceanographic terminology so the taxonomy
 * scales naturally past five stages — every real ocean has these
 * pelagic zones, and the benthic features that live below
 * (continental-shelf, abyssal-plain, hydrothermal-vent, hadal-trench…)
 * follow the same naming convention when added.
 *
 * Surface to seafloor:
 *   epipelagic    0–500m   — sunlit, kelp + photosynthesis active
 *   mesopelagic   500–1500 — twilight, marine snow, first lanternfish
 *   bathypelagic  1500–3k  — midnight, anglers + dragonfish, all bioluminescence
 *   abyssopelagic 3k–5k    — sparse abyss, ancient + rare life
 *   hadopelagic   5k–11k+  — hadal trench, alien adaptations, vent-glow
 */
export type BiomeId =
  | "epipelagic"
  | "mesopelagic"
  | "bathypelagic"
  | "abyssopelagic"
  | "hadopelagic";

export interface BiomeEcology {
  /** Actor archetype IDs eligible to spawn as collectible creatures
   *  in this zone. The chunk factory weights its creature pool against
   *  this list. */
  collectibles: readonly string[];
  /** Actor archetype IDs eligible to spawn as predators in this zone. */
  predators: readonly string[];
  /** Non-actor visual ambience — kelp, marine snow, drift debris. */
  ambient: readonly string[];
  /** Human-readable light source description — drives the renderer's
   *  god-ray + caustic + bioluminescence weighting. */
  lightSources: string;
}

export interface Biome {
  id: BiomeId;
  /** Human-friendly label shown in the HUD (e.g. "Twilight Zone"). */
  label: string;
  /** Real oceanographic name (e.g. "Mesopelagic"). Surfaces in the
   *  Drydock biome browser and in the depth chip subtitle. */
  scientificName: string;
  description: string;
  depthStartMeters: number;
  depthEndMeters: number;
  tintHex: string;
  /** 0..1 — sunlight reaching this zone. Renderer scales god rays
   *  and caustic alpha against this. */
  lightLevel: number;
  /** 0..1 — water clarity / how far the player can see. */
  waterClarity: number;
  /** 0..1 — relative density of beacon creatures. */
  creatureDensity: number;
  /** 0..1 — relative density of predators. */
  predatorDensity: number;
  /** 0..1 — relative density of pirate lanterns. */
  pirateDensity: number;
  /** Real-world ecology atlas — drives actor selection per zone. */
  ecology: BiomeEcology;
}

export interface WorldBounds {
  /** Inclusive lower bound of dive depth, always 0 (surface). */
  depthStartMeters: 0;
  /** Target trench floor for the run; controls the "complete" condition. */
  depthTargetMeters: number;
  /** Horizontal extent in meters; the player drifts inside [-w/2, +w/2]. */
  widthMeters: number;
  /** Vertical band of the visible viewport in meters. */
  viewportHeightMeters: number;
}

export interface Chunk {
  /** 0 = topmost (near surface). */
  index: number;
  biome: BiomeId;
  yTopMeters: number;
  yBottomMeters: number;
  /** Seed used to generate this chunk's content. */
  seed: number;
}
