import type {
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
   *
   * Groundwork for PR F.2 chunking. Entity world-Y + chunk spawn/retire
   * lands in the follow-up.
   */
  depthTravelMeters: number;
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
  biomeId: "photic-gate" | "twilight-shelf" | "midnight-column" | "abyssal-trench";
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
}

export interface DiveThreatImpactResult {
  graceUntilSeconds: number;
  oxygenPenaltySeconds: number;
  timeLeft: number;
  type: "none" | "oxygen-penalty" | "dive-failed";
}
