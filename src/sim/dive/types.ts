import type { BiomeId } from "@/sim/factories/region/types";
import type {
  Anomaly,
  Creature,
  Particle,
  Pirate,
  Player,
  Predator,
} from "@/sim/entities/types";

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface DiveInput {
  x: number;
  y: number;
  isActive: boolean;
}

/**
 * Cumulative run statistics tracked across the dive. Accumulated by
 * `advanceDiveStats` once per frame from edge events on
 * SceneAdvanceResult. Surfaced on the run summary so the post-dive
 * screen can celebrate the *full* run, not just score + depth.
 *
 * All fields are simple scalars / sets of strings so the value is
 * snapshot-friendly and trivially serializable.
 */
export interface DiveRunStats {
  /** Predators killed by lamp pressure across the dive. */
  predatorsKilled: number;
  /** Anomaly buffs collected (any type). */
  buffsCollected: number;
  /** Biome IDs the player has descended through (deduped). Reads as
   *  "you traversed N biomes" in the summary. */
  biomesTraversed: string[];
  /** Peak chain multiplier reached during the dive. Starts at 1. */
  maxChain: number;
  /** Impacts taken (predator/pirate collision, NOT counting strike-near
   *  graces). Drives a "you took N hits" stat. */
  impactsTaken: number;
  /** Adrenaline auto-engage events — how many times the player was
   *  saved from saturation. */
  adrenalineTriggers: number;
}

export interface SceneState {
  anomalies: Anomaly[];
  creatures: Creature[];
  particles: Particle[];
  pirates: Pirate[];
  player: Player;
  predators: Predator[];
  /**
   * Cumulative dive statistics. Optional so test fixtures and
   * legacy snapshots can omit it; advance() defaults to zeros if
   * absent and accumulates from there.
   */
  runStats?: DiveRunStats;
  /**
   * Cumulative descent in world-meters. Starts at 0 (surface) and grows
   * monotonically as the dive advances. This is the real depth — the
   * sub is actually *moving downward* through the column. Renderer
   * camera and audio ambient filter both read this directly.
   */
  depthTravelMeters: number;
  /**
   * Per-mode objective queue with live progress. The active objective
   * is the first entry with `completed === false`; entries before it
   * are complete, entries after are queued. The engine's
   * `advanceObjectiveQueue` rebuilds this every frame; the HUD panel
   * reads it to render the progress list. Seeded from
   * `createObjectiveQueue(mode)` at dive start.
   */
  objectiveQueue: import("@/sim/factories/dive").ObjectiveProgress[];
  /**
   * Arena pocket-clear set. Once a chunk's threats are thinned to
   * zero in pocket mode, the engine adds the chunk index here and
   * the gate stays dropped — even if respawnThreats re-seeds new
   * predators for the chunk later, the player can swim through.
   * Empty/missing for non-pocket modes.
   */
  clearedChunks?: number[];
}

export interface CreatureCollectionResult {
  collected: Creature[];
  creatures: Creature[];
  lastCollectTime: number;
  multiplier: number;
  oxygenBonusSeconds: number;
  scoreDelta: number;
}

export interface DiveTelemetry {
  beaconBearingRadians: number | null;
  biomeId: BiomeId;
  biomeLabel: string;
  biomeTintHex: string;
  collectionRatio: number;
  depthMeters: number;
  nearestBeaconDistance: number;
  nearestThreatDistance: number;
  objective: string;
  oxygenRatio: number;
  pressureLabel: string;
  routeLandmarkBearingRadians: number | null;
  routeLandmarkDistance: number;
  routeLandmarkLabel: string;
}

export interface DiveRunSummary {
  beaconsRemaining: number;
  completionPercent: number;
  depthMeters: number;
  durationSeconds: number;
  elapsedSeconds: number;
  score: number;
  timeLeft: number;
  totalBeacons: number;
  /**
   * Cumulative dive statistics tallied during the run. Optional so
   * legacy snapshots (saved before stats tracking) load cleanly.
   */
  stats?: DiveRunStats;
}

export interface DiveCompletionCelebration {
  landmarkSequence: string[];
  message: string;
  rating: string;
  replayPrompt: string;
  title: string;
}

export interface SceneAdvanceResult {
  collection: CreatureCollectionResult;
  collidedWithPredator: boolean;
  scene: SceneState;
  telemetry: DiveTelemetry;
  /**
   * Oxygen seconds added by `breath` anomaly pickups this frame.
   * The runtime adds these to its `timeModifier` so the HUD shows a
   * positive jump and the dive duration extends. Sim itself stays
   * pure — no localStorage / React calls. 0 most frames.
   */
  oxygenBonusSeconds: number;
  /**
   * True if any predator entered StrikeState near the player this
   * frame. Drives a brief screen-shake + flash burst even when the
   * strike misses the collision check — the *attempt* is the
   * feedback. Decays to false naturally as the predator transitions
   * to RecoverState.
   */
  predatorStrikeNearPlayer: boolean;
  /**
   * 0..1 active-threat intensity. Counts stalking/charging/striking
   * predator brains within their own detection radius of the player,
   * weighted by state. Consumed by the ambient audio layer to ramp
   * a low rumble + tighten the pad filter Q so the music thickens
   * with predator pressure.
   */
  threatIntensity: number;
  /**
   * True if a predator broadcast a pack-flank engage this frame.
   * Edge-detected by the runtime to play `pack-call` SFX once per
   * broadcast.
   */
  predatorPackCallThisFrame: boolean;
  /**
   * True for exactly one frame when any pirate's awareness crosses
   * the pursuit threshold. Drives a one-shot pirate-alert SFX so
   * the player has an audible tell that a pirate just locked on.
   */
  pirateAlertThisFrame: boolean;
  /**
   * Count of predator brains that transitioned from alive→dying
   * THIS frame. Runtime plays `predator-kill` SFX once per kill.
   */
  predatorKillsThisFrame: number;
  /**
   * Positions where the lamp cone hit a predator THIS frame. Used
   * by the renderer's FX layer to emit spark-scatter particles at
   * each contact point — visible "the lamp is working" feedback
   * even before damage cooldown allows another HP tick.
   */
  lampScatterPoints: readonly { x: number; y: number }[];
  /**
   * Bearings + intensities of every active threat within radar
   * range of the player. Drives the FX-layer sonar ring's
   * directional warning arcs so the player sees threats pressing
   * in from off-screen before they cross the viewport edge.
   */
  threatBearings: readonly {
    bearing: number;
    intensity: number;
    nearness: number;
  }[];
  /**
   * Position of the predator collision impact this frame, or null
   * if no impact occurred. Drives the FX layer's expanding-ring
   * shockwave at the contact point. Edge-detected by the runtime
   * so a single hit produces a single ring (not a ring per frame
   * during the impact's grace window).
   */
  impactRippleAt: { x: number; y: number } | null;
  /**
   * 0..1 leviathan proximity. 0 = no leviathan in scene, 1 = one
   * is within 200px of the player. Drives ambient sub-bass drone +
   * a cinematic edge-vignette pulse so the player feels the
   * presence even when the silhouette is hidden in the abyss tint.
   */
  leviathanProximity: number;
  /**
   * Active flank broadcast pairs — engager → packmate line
   * endpoints with age. The FX layer renders a fading arc per
   * pair so the player sees the pack converging the moment the
   * call goes out, not just when the predators arrive.
   */
  flankBroadcasts: readonly {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    age: number;
    lifetime: number;
  }[];
  /**
   * True if Adrenaline is currently active. The runtime scales
   * game-loop deltaTime to 0.7× while this is set, so the world
   * runs in slow-mo and the player input gain is effectively 1.4×.
   * Renderer reads it for a chromatic-pulse vignette + sonar
   * acceleration — visually clear that time has changed.
   */
  adrenalineActive: boolean;
  /**
   * 0..1 readiness — 1 means adrenaline is OFF cooldown and ready
   * to trigger. Drives the renderer's cyan ready-ring (a thin
   * mint pulse around the player) so the player can see when
   * the safety net is armed without hunting through the HUD.
   */
  adrenalineReadiness: number;
  /**
   * One pickup event per anomaly collected this frame. The FX layer
   * paints an expanding pickup ring at each location, color-keyed
   * to the anomaly type so a player learns "cyan ring = lure,
   * golden = lamp-flare, blue = repel" over time.
   */
  anomalyPickups: readonly {
    x: number;
    y: number;
    type: "repel" | "overdrive" | "lure" | "lamp-flare" | "breath";
  }[];
}

export interface DiveModeTuning {
  collectionOxygenScale: number;
  collisionEndsDive: boolean;
  durationSeconds: number;
  impactGraceSeconds: number;
  impactOxygenPenaltySeconds: number;
  pirateSpeedScale: number;
  predatorSpeedScale: number;
  threatRadiusScale: number;
  
  // Modular Game Mechanics Slots
  /** If true, the player can move laterally as well as vertically. If false, lateral movement is constrained. */
  freeLateralMovement: boolean;
  /** If true, the player dictates descent speed. If false, the game scrolls continuously. */
  freeVerticalMovement: boolean;
  /** The type of objective to complete the dive. */
  completionCondition: "infinite" | "depth_goal" | "clear_room";
  /** Target depth if condition is depth_goal */
  targetDepthMeters?: number;
  /** If true, enemies will continuously respawn as chunks load. */
  respawnThreats: boolean;
  /** How much harder the game gets as depth increases. */
  difficultyScaling: "none" | "logarithmic" | "linear";
  /**
   * What happens at `OCEAN_FLOOR_METERS`. `free-roam` = clamp depth and
   * keep moving laterally (the seafloor mirrors the surface). `win` =
   * reaching the floor counts as completing the dive. Descent ends on
   * its own `targetDepthMeters` first, so this only matters for
   * infinite modes today.
   */
  seafloorBehavior: "win" | "free-roam";
}

export interface DiveThreatImpactResult {
  graceUntilSeconds: number;
  oxygenPenaltySeconds: number;
  timeLeft: number;
  type: "none" | "oxygen-penalty" | "dive-failed";
}
