import { normalizeSessionMode, type SessionMode } from "@/sim/_shared/sessionMode";
import { GAME_DURATION } from "./constants";
import type { DiveModeTuning } from "./types";
import type { SubUpgrades } from "@/sim/meta/upgrades";

const DIVE_MODE_TUNING: Record<SessionMode, DiveModeTuning> = {
  exploration: {
    collectionOxygenScale: 1.5,
    collisionEndsDive: false,
    durationSeconds: 900, // Very long base
    impactGraceSeconds: 5,
    impactOxygenPenaltySeconds: 15, // Low penalty
    pirateSpeedScale: 0.7,
    predatorSpeedScale: 0.7,
    threatRadiusScale: 0.8,
    freeLateralMovement: true,
    freeVerticalMovement: true, // You control descent
    completionCondition: "infinite",
    respawnThreats: false, // More static world
    difficultyScaling: "none",
  },
  descent: {
    collectionOxygenScale: 1,
    collisionEndsDive: false,
    durationSeconds: GAME_DURATION,
    impactGraceSeconds: 4,
    impactOxygenPenaltySeconds: 45,
    pirateSpeedScale: 1,
    predatorSpeedScale: 1,
    threatRadiusScale: 1,
    freeLateralMovement: true,
    freeVerticalMovement: false, // Forced descent
    completionCondition: "infinite",
    respawnThreats: true,
    difficultyScaling: "logarithmic",
  },
  arena: {
    collectionOxygenScale: 0.75,
    collisionEndsDive: true, // Instant death in bullet hell
    durationSeconds: 480,
    impactGraceSeconds: 0,
    impactOxygenPenaltySeconds: 0,
    pirateSpeedScale: 1.25,
    predatorSpeedScale: 1.25,
    threatRadiusScale: 1.3,
    freeLateralMovement: true,
    freeVerticalMovement: true, // Maneuver inside the room
    completionCondition: "clear_room", // Halts descent per chunk until enemies cleared
    respawnThreats: true,
    difficultyScaling: "linear",
  },
};

export function getDiveModeTuning(mode: string | null | undefined, upgrades?: SubUpgrades): DiveModeTuning {
  const base = DIVE_MODE_TUNING[normalizeSessionMode(mode)];
  if (!upgrades) return base;
  
  return {
    ...base,
    durationSeconds: base.durationSeconds + (upgrades.battery * 60), // +60s per level
    impactOxygenPenaltySeconds: Math.max(0, base.impactOxygenPenaltySeconds - (upgrades.hull * 10)), // -10s per level
  };
}

export function getDiveDurationSeconds(mode: string | null | undefined, upgrades?: SubUpgrades): number {
  return getDiveModeTuning(mode, upgrades).durationSeconds;
}
