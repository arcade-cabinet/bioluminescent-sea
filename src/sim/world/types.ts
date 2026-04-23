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

export type BiomeId =
  | "photic-gate"
  | "twilight-shelf"
  | "midnight-column"
  | "abyssal-trench";

export interface Biome {
  id: BiomeId;
  label: string;
  description: string;
  depthStartMeters: number;
  depthEndMeters: number;
  tintHex: string;
  /** 0..1 — relative density of beacon creatures */
  creatureDensity: number;
  /** 0..1 — relative density of predators */
  predatorDensity: number;
  /** 0..1 — relative density of pirate lanterns */
  pirateDensity: number;
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
