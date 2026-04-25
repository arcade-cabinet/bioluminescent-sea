export type CreatureType = "jellyfish" | "plankton" | "fish";

export type AnomalyType =
  | "repel"        // ward predators away from the sub for N seconds
  | "overdrive"    // 2.5× sub speed scale for N seconds
  | "breath"       // instant +30s oxygen burst (no duration)
  | "lure"         // pulls collectibles toward the sub for N seconds
  | "lamp-flare";  // 2× lamp scale + extends collection radius for N seconds

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
  /**
   * Atmospheric fish — small, dim, drift through the chunk to give a
   * sense of life. Skipped by collection (no Lux, no oxygen, no chain
   * impact) and rendered without bloom; their job is to keep the
   * water from feeling empty between scoring beacons.
   */
  ambient?: boolean;
}

/**
 * Predator AI state identifiers — drive both behaviour selection in
 * the Yuka StateMachine and the renderer's posture cues. The full
 * state catalogue lives in src/sim/ai/predator-brain/states.ts; this
 * type is the publishable contract that crosses the AI/render seam.
 */
export type PredatorAiState =
  | "patrol"   // Wandering loose box, low arousal
  | "stalk"    // Aware of player, closing in low-key
  | "charge"   // Windup before strike — visible telegraph
  | "strike"   // Active lunge attack
  | "recover"  // Post-strike disorientation, vulnerable
  | "flee"     // Damaged or outmatched, retreating
  | "ambient"; // Leviathans + idle-state default

export interface Predator {
  id: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  noiseOffset: number;
  angle: number;
  isLeviathan?: boolean;
  /**
   * Current AI state — mirrored from the Yuka StateMachine each frame
   * so the renderer can read it without coupling to the AI layer.
   * Defaults to "ambient" until a brain is attached.
   */
  aiState?: PredatorAiState;
  /**
   * Fraction of the current state that has elapsed (0..1). Useful for
   * blending posture animations across enter/exit boundaries — e.g.
   * the maw opens linearly across charge, strike fires at chargeProgress=1.
   */
  stateProgress?: number;
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
    /** Pulls collectibles toward the sub while > totalTime. */
    lureUntil: number;
    /** Doubles lampScale + collection radius while > totalTime. */
    lampFlareUntil: number;
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
