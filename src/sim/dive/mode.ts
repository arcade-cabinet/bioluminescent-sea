import { normalizeSessionMode } from "@/sim/_shared/sessionMode";
import { getModeSlots, type ModeSlots } from "./modeSlots";
import type { DiveModeTuning } from "./types";
import type { SubUpgrades } from "@/sim/meta/upgrades";

/**
 * Adapts the canonical `ModeSlots` record into the legacy `DiveModeTuning`
 * shape that older callers (`advanceScene`, `resolveDiveThreatImpact`) read.
 * The slot record is the single source of truth; this is just a projection.
 */
function tuningFromSlots(slots: ModeSlots): DiveModeTuning {
  return {
    collectionOxygenScale: slots.collectionOxygenScale,
    collisionEndsDive: slots.collisionEndsDive,
    durationSeconds: slots.durationSeconds,
    impactGraceSeconds: slots.impactGraceSeconds,
    impactOxygenPenaltySeconds: slots.impactOxygenPenaltySeconds,
    pirateSpeedScale: slots.pirateSpeedScale,
    predatorSpeedScale: slots.predatorSpeedScale,
    threatRadiusScale: slots.threatRadiusScale,
    freeLateralMovement: slots.lateralMovement === "free",
    freeVerticalMovement: slots.verticalMovement === "free",
    completionCondition: slots.completionCondition,
    targetDepthMeters: slots.targetDepthMeters ?? undefined,
    respawnThreats: slots.respawnThreats,
    difficultyScaling: slots.difficultyScaling,
  };
}

export function getDiveModeTuning(
  mode: string | null | undefined,
  upgrades?: SubUpgrades,
): DiveModeTuning {
  const sessionMode = normalizeSessionMode(mode);
  const slots = getModeSlots(sessionMode);
  const base = tuningFromSlots(slots);
  if (!upgrades) return base;

  return {
    ...base,
    // +60s base oxygen per battery level
    durationSeconds: base.durationSeconds + upgrades.battery * 60,
    // -10s impact penalty per hull level (floor 0)
    impactOxygenPenaltySeconds: Math.max(
      0,
      base.impactOxygenPenaltySeconds - upgrades.hull * 10,
    ),
  };
}

export function getDiveDurationSeconds(
  mode: string | null | undefined,
  upgrades?: SubUpgrades,
): number {
  return getDiveModeTuning(mode, upgrades).durationSeconds;
}
