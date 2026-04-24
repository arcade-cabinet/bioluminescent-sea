export type CreatureType = "jellyfish" | "plankton" | "fish";

export interface Creature {
  id: string;
  type: CreatureType;
  x: number;
  y: number;
  size: number;
  color: string;
  glowColor: string;
  glowIntensity: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
  speed: number;
  pulsePhase: number;
  /**
   * World-space depth of the creature in meters. Populated by the
   * chunk-aware `createChunkedScene` factory; omitted by the legacy
   * `createSeededScene` path (18 fixed creatures in a single
   * viewport). Renderer F.4e will project through
   * `camera.project({ x, y: worldYMeters, z })` when present and
   * fall back to the screen-space `y` otherwise.
   */
  worldYMeters?: number;
}

export interface Predator {
  id: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  noiseOffset: number;
  angle: number;
}

export interface Pirate {
  id: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  noiseOffset: number;
  lanternPhase: number;
}

export interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  drift: number;
  seed: number;
}

export interface Player {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  glowIntensity: number;
}

export const CREATURE_TYPES: CreatureType[] = ["jellyfish", "plankton", "fish"];

export const CREATURE_COLORS: Record<CreatureType, { color: string; glow: string }> = {
  fish: { color: "#c4b5fd", glow: "#8b5cf6" },
  jellyfish: { color: "#7dd3fc", glow: "#0ea5e9" },
  plankton: { color: "#a5f3fc", glow: "#22d3ee" },
};

export const CREATURE_POINTS: Record<CreatureType, number> = {
  fish: 50,
  jellyfish: 30,
  plankton: 10,
};

export const CREATURE_OXYGEN_BONUS_SECONDS: Record<CreatureType, number> = {
  fish: 6,
  jellyfish: 8,
  plankton: 4,
};
