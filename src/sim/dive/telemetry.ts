import { clamp } from "@/sim/_shared/math";
import { TOTAL_BEACONS } from "@/sim/entities/creatures";
import { findNearestBeaconVector, findNearestThreatDistance } from "./collection";
import { GAME_DURATION } from "./constants";
import { describeDiveObjective, getPressureLabel } from "./objectives";
import type {
  DiveCompletionCelebration,
  DiveRunSummary,
  DiveTelemetry,
  SceneState,
} from "./types";

export const ROUTE_LANDMARKS = [
  { label: "Kelp Gate", threshold: 0, distanceOffset: 120 },
  { label: "Lantern Shelf", threshold: 0.24, distanceOffset: 98 },
  { label: "Whale-Fall Windows", threshold: 0.43, distanceOffset: 82 },
  { label: "Trench Choir", threshold: 0.61, distanceOffset: 64 },
  { label: "Abyss Orchard", threshold: 0.78, distanceOffset: 46 },
  { label: "Living Map", threshold: 0.94, distanceOffset: 24 },
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
  const routeLandmark = getDiveRouteLandmark(collectionRatio, nearestBeacon);

  return {
    beaconBearingRadians: nearestBeacon.bearingRadians,
    collectionRatio,
    depthMeters: Math.round(2200 + collectionRatio * 850 + (1 - oxygenRatio) * 350),
    nearestBeaconDistance: nearestBeacon.distance,
    nearestThreatDistance,
    objective: describeDiveObjective(
      scene.creatures.length,
      timeLeft,
      nearestThreatDistance,
      nearestBeacon.distance
    ),
    oxygenRatio,
    pressureLabel: getPressureLabel(oxygenRatio, nearestThreatDistance),
    routeLandmarkBearingRadians: routeLandmark.bearingRadians,
    routeLandmarkDistance: routeLandmark.distance,
    routeLandmarkLabel: routeLandmark.label,
  };
}

export function isDiveComplete(scene: SceneState): boolean {
  return scene.creatures.length === 0;
}

export function getDiveRunSummary(
  scene: SceneState,
  score: number,
  timeLeft: number,
  durationSeconds = GAME_DURATION
): DiveRunSummary {
  return {
    beaconsRemaining: scene.creatures.length,
    completionPercent: Math.round(((TOTAL_BEACONS - scene.creatures.length) / TOTAL_BEACONS) * 100),
    depthMeters: getDiveTelemetry(scene, timeLeft, durationSeconds).depthMeters,
    durationSeconds,
    elapsedSeconds: durationSeconds - timeLeft,
    score,
    timeLeft,
    totalBeacons: TOTAL_BEACONS,
  };
}

export function getDiveCompletionCelebration(summary: DiveRunSummary): DiveCompletionCelebration {
  const oxygenRatio = summary.durationSeconds > 0 ? summary.timeLeft / summary.durationSeconds : 0;
  const rating =
    summary.completionPercent >= 100 && oxygenRatio >= 0.34
      ? "Radiant Route"
      : summary.completionPercent >= 100 && oxygenRatio >= 0.18
        ? "Clean Living Map"
        : summary.completionPercent >= 100
          ? "Narrow Ascent"
          : "Partial Chart";
  const title = summary.completionPercent >= 100 ? "Living Map Complete" : "Dive Logged";
  const message =
    summary.completionPercent >= 100
      ? `${summary.totalBeacons} beacons recovered through ${ROUTE_LANDMARKS.at(-1)?.label}.`
      : `${summary.completionPercent}% of the route charted before ascent.`;
  const replayPrompt =
    oxygenRatio >= 0.34
      ? "Replay for faster chains and a calmer return."
      : "Replay to bank more oxygen before the final landmark.";

  return {
    landmarkSequence: ROUTE_LANDMARKS.map((landmark) => landmark.label),
    message,
    rating,
    replayPrompt,
    title,
  };
}

export function getDiveRouteLandmark(
  collectionRatio: number,
  nearestBeacon: { bearingRadians: number | null; distance: number }
) {
  const normalizedRatio = clamp(collectionRatio, 0, 1);
  let landmark: (typeof ROUTE_LANDMARKS)[number] = ROUTE_LANDMARKS[0];
  for (const entry of ROUTE_LANDMARKS) {
    if (normalizedRatio >= entry.threshold) {
      landmark = entry;
    }
  }

  return {
    bearingRadians: nearestBeacon.bearingRadians,
    distance: Math.round(nearestBeacon.distance + landmark.distanceOffset * (1 - normalizedRatio)),
    label: landmark.label,
  };
}
