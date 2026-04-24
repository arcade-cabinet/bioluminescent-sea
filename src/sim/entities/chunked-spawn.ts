import { CHUNK_HEIGHT_METERS } from "@/sim/chunk";
import { createRng } from "@/sim/rng";
import { clamp, round } from "@/sim/_shared/math";
import { playBandMinX, playBandWidth } from "@/sim/_shared/playBand";
import { biomeById } from "@/sim/world/biomes";
import type { Chunk } from "@/sim/world/types";
import type { ViewportDimensions } from "@/sim/dive/types";
import { CREATURE_COLORS, type Creature, type CreatureType } from "./types";

/**
 * Per-chunk entity spawning.
 *
 * Given a chunk (depth range + biome + per-chunk seed), produce the
 * creatures that live inside it. The creature count is driven by the
 * biome's `creatureDensity` so the photic gate feels dense with glow
 * near the surface and the abyssal trench gets quieter.
 *
 * PR F.3 groundwork — the sim still advances 18 fixed creatures
 * today, but this path is ready for the sim migration. Creatures
 * produced here carry `worldYMeters` (in addition to the legacy
 * screen `y`) so the renderer can project them via the camera as
 * soon as camera-scroll is wired.
 */

export const BASE_CREATURES_PER_CHUNK = 3;

export function spawnCreaturesForChunk(
  chunk: Chunk,
  viewport: ViewportDimensions,
): Creature[] {
  const biome = biomeById(chunk.biome);
  // Density 0..1 → count in [1, base + 2]. Photic (density ~0.9) →
  // 4 creatures; abyssal (density ~0.3) → 2 creatures.
  const count = Math.max(
    1,
    Math.round(BASE_CREATURES_PER_CHUNK * biome.creatureDensity * 1.3),
  );

  const rng = createRng(chunk.seed);
  const types: CreatureType[] = ["plankton", "jellyfish", "fish"];
  const { width, height } = viewport;

  return Array.from({ length: count }, (_, index) => {
    const type = rng.pick(types);
    const colors = CREATURE_COLORS[type];
    const sizeScale = sizeForType(type);

    // World-Y is a random depth within the chunk's vertical band.
    const worldYMeters = round(
      chunk.yTopMeters + rng.range(0.12, 0.88) * CHUNK_HEIGHT_METERS,
      2,
    );
    // Legacy screen coords: x spread across viewport, y derived from
    // the normalized position inside the chunk. The renderer replaces
    // this with camera projection once chunk-scroll lands; today it
    // keeps the game playable while the sim is still pixel-bound.
    const chunkLocalY = (worldYMeters - chunk.yTopMeters) / CHUNK_HEIGHT_METERS;
    // Spawn across the full lateral play band so descending through
    // a chunk can reveal creatures the player only finds by drifting
    // sideways. The PRNG's range call remains seeded from the chunk
    // so the population is deterministic across reloads.
    const xNorm = rng.range(0.04, 0.96);
    const yNorm = 0.1 + chunkLocalY * 0.8;

    return {
      color: colors.color,
      glowColor: colors.glow,
      glowIntensity: round(0.68 + rng.range(0, 0.28), 3),
      id: `beacon-c${chunk.index}-${index + 1}`,
      noiseOffsetX: round(rng.range(0, 1000), 2),
      noiseOffsetY: round(rng.range(0, 1000), 2),
      pulsePhase: round(rng.range(0, Math.PI * 2), 3),
      size: round(clamp(640 * sizeScale, 14, 36), 2),
      speed: round(rng.range(0.18, 0.55), 3),
      type,
      worldYMeters,
      x: round(playBandMinX(width) + xNorm * playBandWidth(width), 2),
      y: round(yNorm * height, 2),
    };
  });
}

/**
 * Spawn creatures across every chunk in the given window. Callable as
 * a direct drop-in for the scene's creature array; the resulting
 * count varies with the chunks' biome densities.
 */
export function spawnCreaturesForChunks(
  chunks: readonly Chunk[],
  viewport: ViewportDimensions,
): Creature[] {
  return chunks.flatMap((c) => spawnCreaturesForChunk(c, viewport));
}

function sizeForType(type: CreatureType): number {
  switch (type) {
    case "plankton":
      return 0.025;
    case "jellyfish":
      return 0.036;
    case "fish":
      return 0.032;
  }
}

/**
 * Best-guess world-Y in meters for a creature whose position was
 * authored in pixels only. Used during the transition period to seed
 * `worldYMeters` on the existing 18-fixed-creatures scene without
 * re-seeding the whole placement.
 */
export function estimateWorldYMeters(
  pixelY: number,
  viewportHeight: number,
  currentDepthMeters: number,
): number {
  const normalized = clamp(pixelY / viewportHeight, 0, 1);
  // Map [0,1] viewport to a 1-chunk band around the current depth.
  return currentDepthMeters + (normalized - 0.5) * CHUNK_HEIGHT_METERS;
}
