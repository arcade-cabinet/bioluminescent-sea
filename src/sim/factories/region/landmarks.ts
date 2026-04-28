import { COMPILED_LANDMARKS } from "../../../../config/compiled/content";
import type { BiomeId } from "./types";

/**
 * Authored named landmarks along the depth axis. Source of truth is
 * `config/raw/landmarks/*.json` — this module just lifts the compiled
 * record into typed form, keeps the list sorted by depth, and exposes
 * the lookup the engine needs to surface the *next upcoming* landmark
 * to the HUD as a sense of journey.
 *
 * Landmarks are not spawned actors — they're navigational beats. Each
 * one is a place the player passes (or holds at) on the way down. The
 * pelagic biomes are the ambient scenery; the landmarks are the named
 * stops inside each scene.
 */
export interface Landmark {
  id: string;
  label: string;
  depthMeters: number;
  biome: BiomeId;
  flavor: string;
}

export const LANDMARKS: readonly Landmark[] = COMPILED_LANDMARKS as readonly Landmark[];

/**
 * Find the next named landmark below the given depth — the one the
 * sub is currently approaching. Returns `null` past the deepest
 * authored landmark (the player has cleared every milestone — at the
 * seafloor in free-roam modes the HUD then reads as "the seafloor"
 * via the dive objective banner instead).
 */
export function nextLandmarkAtDepth(depthMeters: number): Landmark | null {
  for (const lm of LANDMARKS) {
    if (lm.depthMeters > depthMeters) return lm;
  }
  return null;
}

/**
 * Find the deepest landmark the sub has already passed. Used by the
 * HUD to label "you have reached X" — the *most recent* milestone.
 * Returns `null` if the sub is shallower than the first landmark.
 */
export function lastPassedLandmark(depthMeters: number): Landmark | null {
  let last: Landmark | null = null;
  for (const lm of LANDMARKS) {
    if (lm.depthMeters <= depthMeters) last = lm;
    else break;
  }
  return last;
}
