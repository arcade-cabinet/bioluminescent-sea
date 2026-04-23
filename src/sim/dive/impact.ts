import { getDiveModeTuning } from "./mode";
import type { DiveThreatImpactResult } from "./types";

export function resolveDiveThreatImpact({
  collided,
  lastImpactTimeSeconds,
  mode,
  timeLeft,
  totalTimeSeconds,
}: {
  collided: boolean;
  lastImpactTimeSeconds: number;
  mode: string | null | undefined;
  timeLeft: number;
  totalTimeSeconds: number;
}): DiveThreatImpactResult {
  if (!collided) {
    return {
      graceUntilSeconds: lastImpactTimeSeconds,
      oxygenPenaltySeconds: 0,
      timeLeft,
      type: "none",
    };
  }

  const tuning = getDiveModeTuning(mode);
  if (
    tuning.impactGraceSeconds > 0 &&
    totalTimeSeconds - lastImpactTimeSeconds < tuning.impactGraceSeconds
  ) {
    return {
      graceUntilSeconds: lastImpactTimeSeconds + tuning.impactGraceSeconds,
      oxygenPenaltySeconds: 0,
      timeLeft,
      type: "none",
    };
  }

  if (tuning.collisionEndsDive) {
    return {
      graceUntilSeconds: totalTimeSeconds,
      oxygenPenaltySeconds: timeLeft,
      timeLeft: 0,
      type: "dive-failed",
    };
  }

  const oxygenPenaltySeconds = Math.min(timeLeft, tuning.impactOxygenPenaltySeconds);
  const nextTimeLeft = Math.max(0, timeLeft - oxygenPenaltySeconds);

  return {
    graceUntilSeconds: totalTimeSeconds + tuning.impactGraceSeconds,
    oxygenPenaltySeconds,
    timeLeft: nextTimeLeft,
    type: nextTimeLeft <= 0 ? "dive-failed" : "oxygen-penalty",
  };
}
