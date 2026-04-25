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

export interface SceneState {
  anomalies: Anomaly[];
  creatures: Creature[];
  particles: Particle[];
  pirates: Pirate[];
  player: Player;
  predators: Predator[];
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
}

export interface DiveThreatImpactResult {
  graceUntilSeconds: number;
  oxygenPenaltySeconds: number;
  timeLeft: number;
  type: "none" | "oxygen-penalty" | "dive-failed";
}
