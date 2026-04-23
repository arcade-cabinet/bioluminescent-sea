/**
 * Audio stack.
 *
 * - `ambient` — Tone.js ambient pad whose filter + reverb modulate
 *   with depth and biome. No pre-rendered audio asset; synthesized.
 * - `sfx` — Howler pool for one-shots (collect chime, impact thud,
 *   biome transition gong, oxygen-low rattle).
 * - `mixer` — master gain, mute toggle, honors `prefers-reduced-motion`
 *   and Capacitor app-state pause.
 *
 * Filled in by PR G.
 */
export {};
