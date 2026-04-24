export const SESSION_MODES = ["exploration", "descent", "arena"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
export const DEFAULT_SESSION_MODE: SessionMode = "descent";

export function normalizeSessionMode(mode: string | null | undefined): SessionMode {
  if (mode === "exploration" || mode === "descent" || mode === "arena") {
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
  exploration: { pressureScale: 0.7, recoveryScale: 1.25 },
  descent: { pressureScale: 1.0, recoveryScale: 1.0 },
  arena: { pressureScale: 1.5, recoveryScale: 0.75 },
};

export function getSessionPressureScale(mode: SessionMode): number {
  return DEFAULT_SESSION_TUNING[mode].pressureScale;
}

export function getSessionRecoveryScale(mode: SessionMode): number {
  return DEFAULT_SESSION_TUNING[mode].recoveryScale;
}

/**
 * Authored copy + identity for each dive mode. Pure data — consumed by the
 * landing triptych, the seed-picker overlay header, and any analytics surface
 * that needs human-readable labels. No React, no styles.
 */
export interface SessionModeMetadata {
  id: SessionMode;
  label: string;
  /** One-line teaser shown beneath the label on the mode card. */
  tagline: string;
  /** Longer copy shown in the seed-picker overlay header. */
  description: string;
  /** Hex of the accent that paints corners/borders on the card. */
  accentHex: string;
  /** Single glyph rendered in the card's icon slot. */
  glyph: string;
  /** Short pace label, used by HUDs and summaries. */
  paceLabel: string;
}

export const MODE_METADATA: Record<SessionMode, SessionModeMetadata> = {
  exploration: {
    id: "exploration",
    label: "Exploration",
    tagline: "Drift the photic shelf. No deadlines, gentle threats.",
    description:
      "A slow survey of the upper trench. Long oxygen, soft predators, free vertical movement — the chart is yours to read.",
    accentHex: "#a4d8c5",
    glyph: "◐",
    paceLabel: "Meditative",
  },
  descent: {
    id: "descent",
    label: "Descent",
    tagline: "Sink toward the abyss. Forced descent, balanced pressure.",
    description:
      "The classic dive. Oxygen ticks, the trench pulls you down, beacons mark the route. Surface breathing easier than when you started.",
    accentHex: "#6be6c1",
    glyph: "↓",
    paceLabel: "Balanced",
  },
  arena: {
    id: "arena",
    label: "Arena",
    tagline: "Clear the room. Bullet-hell, one-shot collisions.",
    description:
      "Each chunk locks until the threats are cleared. Free movement, sharp predators, no impact grace — every contact ends the dive.",
    accentHex: "#ff6b6b",
    glyph: "⌖",
    paceLabel: "Sharp",
  },
};

export function getModeMetadata(mode: SessionMode): SessionModeMetadata {
  return MODE_METADATA[mode];
}
