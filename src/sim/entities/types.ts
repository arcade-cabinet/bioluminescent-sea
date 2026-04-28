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
  /**
   * 0 = uninjured, 1 = fully damaged (about to die). Drives the
   * renderer's crack overlay and stroke dimming so the player sees
   * the lamp working before the predator actually breaks off.
   */
  damageFraction?: number;
  /**
   * 0..1 death-animation progress. >0 means the predator is in its
   * sink-and-fade dying state — the renderer dims, drops the body
   * downward, and emits bubbles. The sim treats dying predators as
   * non-collidable so they can't spook the player on the way down.
   * Loot dropped on the frame `deathProgress` first crossed 0.
   */
  deathProgress?: number;
  /**
   * Hex tint of the biome this predator was spawned into. Drives the
   * renderer's accent stroke (gills, fins, eye glow halo) so a
   * mesopelagic predator carries cool teal accents while a
   * hadopelagic predator carries warm-red. Pure visual — does
   * not affect AI. Optional so tests / fixtures can omit it.
   */
  biomeTintHex?: string;
  /**
   * 0..1 hunger level. 0 = recently struck (well-fed), 1 = at the
   * 30 s starvation cap. Drives renderer tint shifts (cooler/sharper
   * for hungry predators) so the player can read which predators
   * are pressing harder. Optional so tests / fixtures can omit it.
   */
  hungerLevel?: number;
}

export interface Pirate {
  id: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  noiseOffset: number;
  lanternPhase: number;
  /**
   * 0 = patrolling, 1 = aware of player + pursuing. Drives the
   * renderer's lantern color (blue → red), pursuit speed boost,
   * and tells the player visually that they've been spotted.
   * Decays back to 0 over `awarenessDecaySeconds` after the player
   * leaves the cone.
   */
  awareness?: number;
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
    /**
     * Adrenaline active window — when totalTime < this, the world
     * runs in 0.7× time-scale and player input gain is boosted to
     * 1.4× so the player can dodge a flank press. Triggered
     * automatically when threat intensity hits 1.0 (4+ active
     * threats), gated by `adrenalineCooldownUntil` so it can't
     * trigger again until 8s after the previous burst ended.
     */
    adrenalineUntil: number;
    adrenalineCooldownUntil: number;
  };
  /**
   * Wall-time seconds when the player last took an impact. Drives
   * a hull flicker + warm-stroke flash in the renderer for ~0.6s
   * after a hit so impacts feel decisive instead of "I think I
   * lost oxygen?". -Infinity = no recent impact.
   */
  lastImpactSeconds?: number;
  /**
   * Bearing (radians, world-space) from the player to the nearest
   * colliding threat at the moment of `lastImpactSeconds`. Used by
   * the renderer to paint a directional damage arc on the hull ring
   * so the player can read *where* the hit came from. Sticky — only
   * updates when a fresh impact lands.
   */
  lastImpactBearing?: number;
}

import { COMPILED_CREATURES } from "../../../config/compiled/content";

/**
 * Creature gameplay tables derived from authored content under
 * `config/raw/creatures/*.json` (compiled into `COMPILED_CREATURES`).
 * Editing the JSON drives gameplay; do not hand-edit the maps below.
 *
 * Only the canonical archetype entries (those whose `id` matches the
 * `type`, e.g. `fish.json` → `id: "fish"`) populate the profile maps.
 * Additional named species (lanternfish, anglerfish, etc.) author
 * presence in the catalogue without clobbering the visual archetype
 * tables — chunk-spawn pulls those by name from biome ecology arrays.
 */
const CREATURE_PROFILES: Record<
  CreatureType,
  { color: string; glow: string; points: number; oxygenBonusSeconds: number }
> = COMPILED_CREATURES.filter((entry) => entry.id === entry.type).reduce(
  (acc, entry) => {
    acc[entry.type as CreatureType] = {
      color: entry.color,
      glow: entry.glowColor,
      points: entry.baseScore,
      oxygenBonusSeconds: entry.oxygenBonusSeconds,
    };
    return acc;
  },
  {} as Record<
    CreatureType,
    { color: string; glow: string; points: number; oxygenBonusSeconds: number }
  >,
);

export const CREATURE_TYPES: CreatureType[] = COMPILED_CREATURES.filter(
  (c) => c.id === c.type,
).map((c) => c.type as CreatureType);

export const CREATURE_COLORS: Record<CreatureType, { color: string; glow: string }> =
  Object.fromEntries(
    (Object.entries(CREATURE_PROFILES) as [CreatureType, (typeof CREATURE_PROFILES)[CreatureType]][]).map(
      ([type, profile]) => [type, { color: profile.color, glow: profile.glow }],
    ),
  ) as Record<CreatureType, { color: string; glow: string }>;

export const CREATURE_POINTS: Record<CreatureType, number> = Object.fromEntries(
  (Object.entries(CREATURE_PROFILES) as [CreatureType, (typeof CREATURE_PROFILES)[CreatureType]][]).map(
    ([type, profile]) => [type, profile.points],
  ),
) as Record<CreatureType, number>;

export const CREATURE_OXYGEN_BONUS_SECONDS: Record<CreatureType, number> = Object.fromEntries(
  (Object.entries(CREATURE_PROFILES) as [CreatureType, (typeof CREATURE_PROFILES)[CreatureType]][]).map(
    ([type, profile]) => [type, profile.oxygenBonusSeconds],
  ),
) as Record<CreatureType, number>;
