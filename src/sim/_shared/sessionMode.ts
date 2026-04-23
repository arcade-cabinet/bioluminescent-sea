export const SESSION_MODES = ["cozy", "standard", "challenge"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
export const DEFAULT_SESSION_MODE: SessionMode = "standard";

export function normalizeSessionMode(mode: string | null | undefined): SessionMode {
  if (mode === "cozy" || mode === "standard" || mode === "challenge") {
    return mode;
  }
  return DEFAULT_SESSION_MODE;
}

export interface SessionTuning {
  /** Multiplier on sources of pressure (threats, oxygen burn, etc.). */
  pressureScale: number;
  /** Multiplier on sources of recovery (oxygen pickups, safe havens). */
  recoveryScale: number;
}

export const DEFAULT_SESSION_TUNING: Record<SessionMode, SessionTuning> = {
  cozy: { pressureScale: 0.7, recoveryScale: 1.25 },
  standard: { pressureScale: 1.0, recoveryScale: 1.0 },
  challenge: { pressureScale: 1.3, recoveryScale: 0.85 },
};

export function getSessionPressureScale(mode: SessionMode): number {
  return DEFAULT_SESSION_TUNING[mode].pressureScale;
}

export function getSessionRecoveryScale(mode: SessionMode): number {
  return DEFAULT_SESSION_TUNING[mode].recoveryScale;
}
