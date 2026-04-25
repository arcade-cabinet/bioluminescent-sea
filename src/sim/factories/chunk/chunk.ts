import { biomeAtDepth } from "@/sim/factories/region/biomes";
import { hashSeed } from "@/sim/rng";
import type { Chunk } from "@/sim/factories/region/types";

/**
 * Vertical extent of a single chunk in world-meters. Tuned so the
 * four biomes (photic 0–800, twilight 800–2400, midnight 2400–4800,
 * abyssal 4800–6400) decompose into a sensible count of chunks. A
 * 400m chunk puts:
 *   - photic-gate    across 2 chunks
 *   - twilight-shelf across 4 chunks
 *   - midnight-column across 6 chunks
 *   - abyssal-trench across 4 chunks
 * for 16 chunks total at the trench floor. Small enough to retire
 * off-screen quickly, large enough that spawn cost is amortized.
 */
export const CHUNK_HEIGHT_METERS = 400;

/** Which chunk the given depth falls into (index 0 = surface). */
export function chunkIndexAtDepth(depthMeters: number): number {
  return Math.floor(Math.max(0, depthMeters) / CHUNK_HEIGHT_METERS);
}

/**
 * Build a Chunk object for the given index. The per-chunk seed is
 * derived from the master seed with the chunk index mixed in, so the
 * same master seed always produces the same chunk contents.
 */
export function chunkAt(index: number, masterSeed: number): Chunk {
  const yTopMeters = index * CHUNK_HEIGHT_METERS;
  const yBottomMeters = yTopMeters + CHUNK_HEIGHT_METERS;
  // Use the chunk's *midpoint* for biome lookup so chunks that
  // straddle a biome boundary still pick the dominant biome.
  const biome = biomeAtDepth(yTopMeters + CHUNK_HEIGHT_METERS / 2);
  return {
    index,
    biome: biome.id,
    yTopMeters,
    yBottomMeters,
    seed: hashSeed(masterSeed, 0xc700 + index),
  };
}

/**
 * The chunks that should currently be live given a camera position
 * and a look-ahead/look-behind window. Used by the spawn/retire loop
 * to know which chunks to instantiate or tear down each frame.
 *
 * lookAheadMeters defaults to one viewport below the camera; keeping
 * a single chunk alive above the camera avoids flicker when the sub
 * briefly ascends (impact knockback).
 */
export function chunksInWindow(args: {
  depthTravelMeters: number;
  viewportHeightMeters: number;
  masterSeed: number;
  lookAheadMeters?: number;
  lookBehindMeters?: number;
}): Chunk[] {
  const lookAhead = args.lookAheadMeters ?? args.viewportHeightMeters;
  const lookBehind = args.lookBehindMeters ?? CHUNK_HEIGHT_METERS;
  const topMeters = Math.max(0, args.depthTravelMeters - lookBehind);
  const bottomMeters = args.depthTravelMeters + args.viewportHeightMeters + lookAhead;
  const firstIndex = chunkIndexAtDepth(topMeters);
  const lastIndex = chunkIndexAtDepth(bottomMeters);
  const chunks: Chunk[] = [];
  for (let i = firstIndex; i <= lastIndex; i++) {
    chunks.push(chunkAt(i, args.masterSeed));
  }
  return chunks;
}
