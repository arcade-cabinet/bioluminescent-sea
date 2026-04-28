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
 *
 * `accentHex` is provided as a hex string for use cases that need to do
 * pixel math (canvas tints, additive blends, gradient interpolation),
 * but every accent value MUST be one of the palette colours documented
 * in `docs/DESIGN.md`. The corresponding CSS custom property is in
 * `accentVar` for callers that can use a variable directly. Keep both
 * in sync when adding modes.
 */
export interface SessionModeMetadata {
  id: SessionMode;
  label: string;
  /** One-line teaser shown beneath the label on the mode card. */
  tagline: string;
  /** Longer copy shown in the seed-picker overlay header. */
  description: string;
  /** Hex form of the accent — must match a palette colour. */
  accentHex: string;
  /** CSS custom property reference for the same accent. */
  accentVar: string;
  /** Single glyph rendered in the card's icon slot. */
  glyph: string;
  /** Short pace label, used by HUDs and summaries. */
  paceLabel: string;
}

export const MODE_METADATA: Record<SessionMode, SessionModeMetadata> = {
  exploration: {
    id: "exploration",
    label: "Exploration",
    // Plain-English copy: tell the player exactly what they will do.
    // Old taglines used scene-jargon ("photic shelf", "contested reefs")
    // that meant nothing to a first-timer. New rule: the tagline names
    // the goal, the verb, and the failure state.
    tagline: "Take your time. Collect glowing creatures, avoid predators, go deep.",
    description:
      "A relaxed dive. You move freely in any direction and have plenty of oxygen. Tap or drag to steer your sub. Touch glowing creatures to score; avoid the dark shapes that hunt you. Surface whenever you want.",
    accentHex: "#a4d8c5",
    accentVar: "var(--color-glow-soft, #a4d8c5)",
    glyph: "◐",
    paceLabel: "Meditative",
  },
  descent: {
    id: "descent",
    label: "Descent",
    tagline: "Sink straight down. Steer left and right. See how deep you can go.",
    description:
      "Your sub falls automatically. You only choose left or right. Collect glowing creatures on the way down, dodge predators, and keep going as long as your oxygen holds. The deeper you go, the higher you score.",
    accentHex: "#6be6c1",
    accentVar: "var(--color-glow)",
    glyph: "↓",
    paceLabel: "Balanced",
  },
  arena: {
    id: "arena",
    label: "Arena",
    tagline: "Fight through one room at a time. One hit and you're out.",
    description:
      "You're locked into a small area. Clear out the predators inside, then move on to the next. One hit ends the dive — there are no second chances. The deeper you push, the more you score.",
    accentHex: "#ff6b6b",
    accentVar: "var(--color-warn)",
    glyph: "⌖",
    paceLabel: "Sharp",
  },
};

export function getModeMetadata(mode: SessionMode): SessionModeMetadata {
  return MODE_METADATA[mode];
}
