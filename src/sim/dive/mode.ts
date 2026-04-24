import { normalizeSessionMode, type SessionMode } from "@/sim/_shared/sessionMode";
import { GAME_DURATION } from "./constants";
import type { DiveModeTuning } from "./types";

const DIVE_MODE_TUNING: Record<SessionMode, DiveModeTuning> = {
  challenge: {
    collectionOxygenScale: 0.55,
    collisionEndsDive: true,
    durationSeconds: 480,
    impactGraceSeconds: 0,
    impactOxygenPenaltySeconds: 0,
    pirateSpeedScale: 1.1,
    predatorSpeedScale: 1.16,
    threatRadiusScale: 1.22,
    freeLateralMovement: true,
    freeVerticalMovement: false,
    completionCondition: "infinite",
    respawnThreats: true,
    difficultyScaling: "logarithmic",
  },
  cozy: {
    collectionOxygenScale: 1.35,
    collisionEndsDive: false,
    durationSeconds: 780,
    impactGraceSeconds: 5,
    impactOxygenPenaltySeconds: 25,
    pirateSpeedScale: 0.8,
    predatorSpeedScale: 0.78,
    threatRadiusScale: 0.72,
    freeLateralMovement: true,
    freeVerticalMovement: true,
    completionCondition: "infinite",
    respawnThreats: true,
    difficultyScaling: "none",
  },
  standard: {
    collectionOxygenScale: 1,
    collisionEndsDive: false,
    durationSeconds: GAME_DURATION,
    impactGraceSeconds: 4,
    impactOxygenPenaltySeconds: 45,
    pirateSpeedScale: 1,
    predatorSpeedScale: 1,
    threatRadiusScale: 1,
    freeLateralMovement: true,
    freeVerticalMovement: false,
    completionCondition: "infinite",
    respawnThreats: true,
    difficultyScaling: "linear",
  },
};

export function getDiveModeTuning(mode: string | null | undefined): DiveModeTuning {
  return DIVE_MODE_TUNING[normalizeSessionMode(mode)];
}

export function getDiveDurationSeconds(mode: string | null | undefined): number {
  return getDiveModeTuning(mode).durationSeconds;
}
