import { clamp } from "@/sim/_shared/math";
import { TOTAL_BEACONS } from "@/sim/entities/creatures";
import { biomeAtDepth } from "@/sim/factories/region/biomes";
import { lastPassedLandmark, nextLandmarkAtDepth } from "@/sim/factories/region/landmarks";
import { findNearestBeaconVector, findNearestThreatDistance } from "./collection";
import { GAME_DURATION, OCEAN_FLOOR_METERS, TRENCH_FLOOR_METERS } from "@/sim/dive/constants";
import { describeDiveObjective, getPressureLabel } from "@/sim/dive/objectives";
import { getDiveModeTuning } from "./mode";
import type {
  DiveCompletionCelebration,
  DiveRunSummary,
  DiveTelemetry,
  SceneState,
} from "@/sim/dive/types";

// Progress milestones surfaced in the HUD as "you've reached X." Plain
// labels — the player should glance and know how deep they are without
// translating any lore. Open-ended at the bottom: descent has no floor,
// so the deepest milestone names the abyss as a region the player
// continues into rather than a terminus.
export const ROUTE_LANDMARKS = [
  { label: "Surface", threshold: 0, distanceOffset: 120 },
  { label: "Sunlight zone", threshold: 0.24, distanceOffset: 98 },
  { label: "Twilight zone", threshold: 0.43, distanceOffset: 82 },
  { label: "Midnight zone", threshold: 0.61, distanceOffset: 64 },
  { label: "Deep ocean", threshold: 0.78, distanceOffset: 46 },
  { label: "The abyss", threshold: 0.94, distanceOffset: 24 },
] as const;

export function getDiveTelemetry(
  scene: SceneState,
  timeLeft: number,
  durationSeconds = GAME_DURATION
): DiveTelemetry {
  const nearestThreatDistance = findNearestThreatDistance(
    scene.player,
    scene.predators,
    scene.pirates
  );
  const nearestBeacon = findNearestBeaconVector(scene.player, scene.creatures);
  const collectionRatio = clamp((TOTAL_BEACONS - scene.creatures.length) / TOTAL_BEACONS, 0, 1);
  const oxygenRatio = clamp(timeLeft / durationSeconds, 0, 1);
  const depthMeters = Math.round(scene.depthTravelMeters);
  const routeLandmark = getDiveRouteLandmark(depthMeters);
  const biome = biomeAtDepth(depthMeters);

  return {
    beaconBearingRadians: nearestBeacon.bearingRadians,
    biomeId: biome.id,
    biomeLabel: biome.label,
    biomeTintHex: biome.tintHex,
    collectionRatio,
    depthMeters,
    nearestBeaconDistance: nearestBeacon.distance,
    nearestThreatDistance,
    objective: describeDiveObjective(
      scene.creatures.length,
      timeLeft,
      nearestThreatDistance,
      nearestBeacon.distance,
      biome.id,
      depthMeters >= OCEAN_FLOOR_METERS - 1,
    ),
    oxygenRatio,
    pressureLabel: getPressureLabel(oxygenRatio, nearestThreatDistance),
    routeLandmarkBearingRadians: routeLandmark.bearingRadians,
    routeLandmarkDistance: routeLandmark.distance,
    routeLandmarkLabel: routeLandmark.label,
  };
}

export function isDiveComplete(
  scene: SceneState,
  mode: string | null | undefined,
  seed: number,
): boolean {
  const tuning = getDiveModeTuning(mode, seed);
  if (tuning.completionCondition === "infinite") return false;
  return scene.depthTravelMeters >= (tuning.targetDepthMeters ?? TRENCH_FLOOR_METERS);
}

export function getDiveRunSummary(
  scene: SceneState,
  score: number,
  timeLeft: number,
  durationSeconds = GAME_DURATION
): DiveRunSummary {
  const completionPercent = clamp(scene.depthTravelMeters / TRENCH_FLOOR_METERS, 0, 1);
  return {
    beaconsRemaining: scene.creatures.length,
    completionPercent: Math.round(completionPercent * 100),
    depthMeters: Math.round(scene.depthTravelMeters),
    durationSeconds,
    elapsedSeconds: durationSeconds - timeLeft,
    score,
    timeLeft,
    totalBeacons: TOTAL_BEACONS,
    stats: scene.runStats,
  };
}

export function getDiveCompletionCelebration(summary: DiveRunSummary): DiveCompletionCelebration {
  const oxygenRatio = summary.durationSeconds > 0 ? summary.timeLeft / summary.durationSeconds : 0;
  const rating =
    summary.completionPercent >= 100 && oxygenRatio >= 0.34
      ? "Clean dive"
      : summary.completionPercent >= 100 && oxygenRatio >= 0.18
        ? "Made it"
        : summary.completionPercent >= 100
          ? "Just made it"
          : "Surfaced early";
  const title = summary.completionPercent >= 100 ? "Target depth reached" : "Dive logged";
  const message =
    summary.completionPercent >= 100
      ? `You hit your target depth of ${summary.depthMeters}m and surfaced safely.`
      : `You made it to ${summary.depthMeters}m before having to surface.`;
  const replayPrompt =
    oxygenRatio >= 0.34
      ? "Replay for faster chains and a deeper run."
      : "Replay to bank more oxygen before the final stretch.";

  return {
    landmarkSequence: ROUTE_LANDMARKS.map((landmark) => landmark.label),
    message,
    rating,
    replayPrompt,
    title,
  };
}

/**
 * Surface the *next* authored landmark below the sub as a HUD beat
 * (label + distance-in-metres). The HUD uses this to give the player
 * a sense of "I'm approaching the Anglerfish Grove, 200 m below"
 * instead of a generic biome-name pinned to a creature-collection
 * ratio.
 *
 * Past the deepest authored landmark the function falls back to the
 * last passed landmark so the HUD still has a name to render — at
 * that point the dive's objective banner is doing the work of saying
 * "the seafloor" via `describeDiveObjective`.
 *
 * Bearing is null because the route landmark is *below* — the HUD
 * already uses depth-meters as the directional cue (depth ticker +
 * downward-falling parallax).
 */
export function getDiveRouteLandmark(depthMeters: number) {
  const next = nextLandmarkAtDepth(depthMeters);
  if (next) {
    return {
      bearingRadians: null,
      distance: Math.max(0, Math.round(next.depthMeters - depthMeters)),
      label: next.label,
    };
  }
  const last = lastPassedLandmark(depthMeters);
  return {
    bearingRadians: null,
    distance: 0,
    label: last?.label ?? "Surface",
  };
}
