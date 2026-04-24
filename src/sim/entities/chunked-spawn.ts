import { CHUNK_HEIGHT_METERS } from "@/sim/chunk";
import { createRng } from "@/sim/rng";
import { clamp, round } from "@/sim/_shared/math";
import { playBandMinX, playBandWidth } from "@/sim/_shared/playBand";
import { biomeById } from "@/sim/world/biomes";
import type { Chunk } from "@/sim/world/types";
import type { ViewportDimensions } from "@/sim/dive/types";
import { CREATURE_COLORS, type Creature, type CreatureType, type Anomaly, type AnomalyType, type Predator, type Pirate } from "./types";

export const BASE_CREATURES_PER_CHUNK = 3;

export function spawnCreaturesForChunk(
  chunk: Chunk,
  viewport: ViewportDimensions,
): Creature[] {
  const biome = biomeById(chunk.biome);
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

    const worldYMeters = round(
      chunk.yTopMeters + rng.range(0.12, 0.88) * CHUNK_HEIGHT_METERS,
      2,
    );
    const chunkLocalY = (worldYMeters - chunk.yTopMeters) / CHUNK_HEIGHT_METERS;
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

export function spawnPredatorsForChunk(
  chunk: Chunk,
  viewport: ViewportDimensions,
): Predator[] {
  const biome = biomeById(chunk.biome);
  const isStygian = chunk.biome === "stygian-abyss";
  const baseCount = Math.round(biome.predatorDensity * 3);
  const count = clamp(baseCount, 0, 10);
  
  if (count === 0 && !isStygian) return [];

  const rng = createRng(chunk.seed + 7777);
  const { width, height } = viewport;
  const baseSize = clamp(640 * 0.14, 54, 94);
  const results: Predator[] = [];

  for (let i = 0; i < count; i++) {
    results.push({
      angle: round(rng.range(-Math.PI, Math.PI), 3),
      id: `predator-c${chunk.index}-${i}`,
      noiseOffset: round(rng.range(0, 1000), 2),
      size: round(baseSize * rng.range(0.85, 1.05), 2),
      speed: round(rng.range(0.5, 0.75), 3),
      x: round(playBandMinX(width) + rng.range(0.1, 0.9) * playBandWidth(width), 2),
      y: round(height * 0.5, 2),
    });
  }

  // Spawn Leviathan in Stygian Abyss (50% chance per chunk)
  if (isStygian && rng.next() > 0.5) {
    results.push({
      angle: round(rng.range(-Math.PI, Math.PI), 3),
      id: `leviathan-c${chunk.index}`,
      noiseOffset: round(rng.range(0, 1000), 2),
      size: round(baseSize * 4, 2), // Massive!
      speed: round(rng.range(0.2, 0.4), 3), // Slow and menacing
      x: round(playBandMinX(width) + rng.range(0.1, 0.9) * playBandWidth(width), 2),
      y: round(height * 0.5, 2),
      isLeviathan: true,
    });
  }

  return results;
}

export function spawnPiratesForChunk(
  chunk: Chunk,
  viewport: ViewportDimensions,
): Pirate[] {
  const biome = biomeById(chunk.biome);
  const baseCount = Math.round(biome.pirateDensity * 2);
  const count = clamp(baseCount, 0, 5);
  
  if (count === 0) return [];

  const rng = createRng(chunk.seed + 8888);
  const { width, height } = viewport;
  const results: Pirate[] = [];

  for (let i = 0; i < count; i++) {
    results.push({
      angle: round(rng.range(-Math.PI, Math.PI), 3),
      id: `pirate-c${chunk.index}-${i}`,
      noiseOffset: round(rng.range(0, 1000), 2),
      speed: round(rng.range(0.6, 0.9), 3),
      lanternPhase: rng.next() * Math.PI * 2,
      x: round(playBandMinX(width) + rng.range(0.1, 0.9) * playBandWidth(width), 2),
      y: round(height * 0.5, 2),
    });
  }

  return results;
}

export function spawnAnomaliesForChunk(
  chunk: Chunk,
  viewport: ViewportDimensions,
): Anomaly[] {
  // Only spawn anomalies occasionally (e.g. 20% of chunks have one)
  const rng = createRng(chunk.seed + 9999);
  if (rng.next() > 0.2) return [];

  const types: AnomalyType[] = ["repel", "overdrive"];
  const { width, height } = viewport;
  const worldYMeters = round(chunk.yTopMeters + rng.range(0.2, 0.8) * CHUNK_HEIGHT_METERS, 2);
  const xNorm = rng.range(0.1, 0.9);

  return [{
    id: `anomaly-c${chunk.index}`,
    type: rng.pick(types),
    x: round(playBandMinX(width) + xNorm * playBandWidth(width), 2),
    y: round(height * 0.5, 2),
    worldYMeters,
    size: 24,
    pulsePhase: rng.range(0, Math.PI * 2),
  }];
}

export function spawnCreaturesForChunks(
  chunks: readonly Chunk[],
  viewport: ViewportDimensions,
): Creature[] {
  return chunks.flatMap((c) => spawnCreaturesForChunk(c, viewport));
}

export function spawnPredatorsForChunks(
  chunks: readonly Chunk[],
  viewport: ViewportDimensions,
): Predator[] {
  return chunks.flatMap((c) => spawnPredatorsForChunk(c, viewport));
}

export function spawnPiratesForChunks(
  chunks: readonly Chunk[],
  viewport: ViewportDimensions,
): Pirate[] {
  return chunks.flatMap((c) => spawnPiratesForChunk(c, viewport));
}

export function spawnAnomaliesForChunks(
  chunks: readonly Chunk[],
  viewport: ViewportDimensions,
): Anomaly[] {
  return chunks.flatMap((c) => spawnAnomaliesForChunk(c, viewport));
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

export function estimateWorldYMeters(
  pixelY: number,
  viewportHeight: number,
  currentDepthMeters: number,
): number {
  const normalized = clamp(pixelY / viewportHeight, 0, 1);
  return currentDepthMeters + (normalized - 0.5) * CHUNK_HEIGHT_METERS;
}
