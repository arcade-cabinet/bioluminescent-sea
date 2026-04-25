import type { ThreatPattern } from "./spawn";

/**
 * What kind of traversal a chunk offers.
 *
 *   open        - the viewport follows the player laterally and
 *                 vertically. Adjacent chunks are streamed in as the
 *                 player swims; no gate. The default for exploration
 *                 + descent mode chunks.
 *   locked-room - the viewport clamps to the chunk's play band until
 *                 the chunk's threat count reaches zero, at which
 *                 point adjacent chunks unlock. The player can then
 *                 swim freely through any cleared chunk, but entering
 *                 an uncleared one re-locks the camera to it. Used by
 *                 arena mode and boss pockets.
 *   corridor    - one-directional traversal (forced descent / forced
 *                 swim-right). Lateral input clamps to a narrow band
 *                 inside the chunk.
 */
export type ChunkTravel = "open" | "locked-room" | "corridor";

/**
 * Every slot on a chunk that can vary by content authoring. ChunkSlots
 * compose with DiveSlots (which set the mode-wide defaults) — a
 * specific chunk archetype can override any of these.
 */
export interface ChunkSlots {
  /** How the camera + player movement is constrained inside this chunk. */
  travel: ChunkTravel;
  /** The threat-layout shape. Forwards to spawn.ts' pattern dispatch. */
  threatPattern: ThreatPattern;
  /** Multiplier on the base creature count the chunk spawns. 1 = default. */
  creatureDensity: number;
  /** Multiplier on the base predator count. 1 = default. */
  predatorDensity: number;
  /** True if anomalies (powerups) may spawn here. */
  anomaliesAllowed: boolean;
  /** True if pirates may patrol here (mid-depth chunks only). */
  piratesAllowed: boolean;
  /** True if the chunk's threats respawn when cleared (for arena rooms
   * you want cleared = cleared; for descent-mode pressure you want
   * fresh threats on re-entry). */
  respawnOnReEnter: boolean;
}
