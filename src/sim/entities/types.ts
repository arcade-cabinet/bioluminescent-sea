export type CreatureType = "jellyfish" | "plankton" | "fish";

export type AnomalyType = "repel" | "overdrive";

export interface Anomaly {
  id: string;
  type: AnomalyType;
  x: number;
  y: number;
  size: number;
  pulsePhase: number;
  worldYMeters?: number;
}

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
   * World-space depth of the creature in meters.
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
  isLeviathan?: boolean;
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
  zDepth: number; // 0 = mid, >0 = deep (slower), <0 = foreground (faster, blurry)
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
  speedScale: number;
  lampScale: number;
  activeBuffs: {
    repelUntil: number;
    overdriveUntil: number;
  };
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
