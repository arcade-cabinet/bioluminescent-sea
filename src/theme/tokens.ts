/**
 * Bioluminescent Sea palette — abyssal + luminous.
 *
 * See docs/DESIGN.md for the palette rationale. The short version:
 * the player is descending into an ocean where the only meaningful
 * light comes from the creatures you pass. Everything off-creature
 * trends toward abyssal navy and deep teal; anything alive glows in
 * the mint accent. The fg color is a muted pale sea-mist so UI text
 * reads as part of the diegesis rather than stamped on top.
 */

export const palette = {
  /** Near-black navy. Used for deep-water backdrop and status bars. */
  bg: "#050a14",
  /** Abyssal navy — one step up from bg for card surfaces / rims. */
  abyss: "#0a1a2e",
  /** Deep teal — mid-water tint, route trails, UI strokes. */
  deep: "#0e4f55",
  /** Bioluminescent mint — creatures, accents, primary CTA. */
  glow: "#6be6c1",
  /** Pale sea-mist for body text — deliberately low-contrast versus */
  /** full white so the diegesis feels continuous. */
  fg: "#d9f2ec",
  /** Muted mist for secondary labels. */
  fgMuted: "#8aa7a2",
  /** Danger tint — used sparingly for predators / low oxygen. */
  warn: "#ff6b6b",
} as const;

export type PaletteKey = keyof typeof palette;

/** Exposed as CSS custom properties on :root in src/theme/global.css. */
export const cssVars: Record<string, string> = Object.fromEntries(
  Object.entries(palette).map(([k, v]) => [`--color-${k}`, v])
);
