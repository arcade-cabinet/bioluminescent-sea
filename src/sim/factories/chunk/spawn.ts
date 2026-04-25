import { CHUNK_HEIGHT_METERS } from "@/sim/factories/chunk";
import { createRng } from "@/sim/rng";
import { clamp, round } from "@/sim/_shared/math";
import { playBandMinX, playBandWidth } from "@/sim/_shared/playBand";
import { biomeById } from "@/sim/factories/region/biomes";
import type { Chunk } from "@/sim/factories/region/types";
import type { ViewportDimensions } from "@/sim/dive/types";
import type { ThreatPattern } from "./slots";
import {
  CREATURE_COLORS,
  type Creature,
  type CreatureType,
  type Anomaly,
  type AnomalyType,
  type Predator,
  type Pirate,
} from "@/sim/entities/types";

/**
 * Spawn pattern — the *shape* of a chunk's threat layout. A slot value on
 * `ModeSlots`, consumed here and only here. Adding a new pattern is a
 * switch arm, not a cross-cutting rewrite. See `./slots.ts` for the
 * canonical union and player-facing rationale.
 */
export type { ThreatPattern };

// Base count for a chunk's charted creatures (the objective-relevant
// beacons). The play band is 2.4× the viewport wide; at the previous
// value of 3 the world looked empty on every viewport. 10 gives a
// continuous field of bioluminescent targets across the band without
// crowding — biome multipliers still scale densities from 0.7 to 1.4.
export const BASE_CREATURES_PER_CHUNK = 10;

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
  pattern: ThreatPattern = "scattered",
): Predator[] {
  const biome = biomeById(chunk.biome);
  const isStygian = chunk.biome === "stygian-abyss";
  const baseCount = Math.round(biome.predatorDensity * 3);
  // Pattern scales the raw count: swarm doubles, shoal-press triples,
  // scattered stays at biome density. This keeps each chunk's pressure
  // tuneable from the mode slot alone.
  const patternScale =
    pattern === "shoal-press" ? 3 : pattern === "swarm" ? 2 : 1;
  const count = clamp(baseCount * patternScale, 0, pattern === "shoal-press" ? 24 : 10);

  if (count === 0 && !isStygian) return [];

  const rng = createRng(chunk.seed + 7777);
  const { width, height } = viewport;
  const baseSize = clamp(640 * 0.14, 54, 94);
  const results: Predator[] = [];

  switch (pattern) {
    case "swarm": {
      // Two tight clusters; everybody orbits an anchor.
      const anchors = [
        { ax: playBandMinX(width) + rng.range(0.2, 0.45) * playBandWidth(width), ay: height * rng.range(0.3, 0.7) },
        { ax: playBandMinX(width) + rng.range(0.55, 0.8) * playBandWidth(width), ay: height * rng.range(0.3, 0.7) },
      ];
      for (let i = 0; i < count; i++) {
        const anchor = anchors[i % anchors.length];
        const r = rng.range(10, 80);
        const theta = rng.range(0, Math.PI * 2);
        results.push({
          angle: round(theta, 3),
          id: `predator-c${chunk.index}-${i}`,
          noiseOffset: round(rng.range(0, 1000), 2),
          size: round(baseSize * rng.range(0.8, 1.0), 2),
          speed: round(rng.range(0.55, 0.85), 3),
          x: round(anchor.ax + Math.cos(theta) * r, 2),
          y: round(anchor.ay + Math.sin(theta) * r, 2),
        });
      }
      break;
    }
    case "shoal-press": {
      // Tight grid of small fast marauders pressing in from every
      // edge of the pocket. Forms the arena-mode encounter.
      const cols = 6;
      const rows = Math.max(1, Math.ceil(count / cols));
      const cellW = playBandWidth(width) / (cols + 1);
      const cellH = (height * 0.8) / (rows + 1);
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = playBandMinX(width) + (col + 1) * cellW + rng.range(-10, 10);
        const cy = height * 0.1 + (row + 1) * cellH + rng.range(-8, 8);
        const isMarauder = rng.next() > 0.4;
        results.push({
          angle: round(rng.range(-Math.PI, Math.PI), 3),
          // Shoal-press uses the marauder-sub archetype so the AI
          // manager can route a hunting behaviour via id prefix.
          id: isMarauder
            ? `marauder-sub-c${chunk.index}-${i}`
            : `predator-c${chunk.index}-${i}`,
          noiseOffset: round(rng.range(0, 1000), 2),
          size: round(baseSize * rng.range(0.55, 0.75), 2),
          speed: round(rng.range(0.9, 1.2), 3),
          x: round(cx, 2),
          y: round(cy, 2),
        });
      }
      break;
    }
    default: {
      // scattered — baseline. Y scatters across the chunk's vertical
      // band so predators don't all stack on the player's y.
      // Chunk 0 also enforces a no-spawn zone around the player's
      // initial position so a fresh dive doesn't open with a hit.
      for (let i = 0; i < count; i++) {
        const x = round(
          playBandMinX(width) + rng.range(0.1, 0.9) * playBandWidth(width),
          2,
        );
        const y = round(predatorYForChunk(chunk.index, height, rng), 2);
        results.push({
          angle: round(rng.range(-Math.PI, Math.PI), 3),
          id: `predator-c${chunk.index}-${i}`,
          noiseOffset: round(rng.range(0, 1000), 2),
          size: round(baseSize * rng.range(0.85, 1.05), 2),
          speed: round(rng.range(0.5, 0.75), 3),
          x,
          y,
        });
      }
    }
  }

  // Spawn Leviathan in Stygian Abyss (50% chance per chunk) — independent
  // of pattern; the leviathan is a named boss, not a wave member.
  if (isStygian && rng.next() > 0.5) {
    results.push({
      angle: round(rng.range(-Math.PI, Math.PI), 3),
      id: `leviathan-c${chunk.index}`,
      noiseOffset: round(rng.range(0, 1000), 2),
      size: round(baseSize * 4, 2),
      speed: round(rng.range(0.2, 0.4), 3),
      x: round(playBandMinX(width) + rng.range(0.1, 0.9) * playBandWidth(width), 2),
      y: round(predatorYForChunk(chunk.index, height, rng), 2),
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
      y: round(predatorYForChunk(chunk.index, height, rng), 2),
    });
  }

  return results;
}

/**
 * Pick a y for a threat (predator/pirate/leviathan) inside a chunk's
 * visible band. Chunk 0 (the chunk the player spawns in) carves out
 * a no-spawn zone around the player's initial y (height * 0.54) so
 * a fresh dive doesn't open with a hit; threats are pushed to the
 * top or bottom band of the viewport. Subsequent chunks scatter
 * uniformly across the full band.
 */
function predatorYForChunk(
  chunkIndex: number,
  height: number,
  rng: { range: (min: number, max: number) => number; next: () => number },
): number {
  if (chunkIndex === 0) {
    // Player spawns at y = height * 0.54. Carve out [0.40, 0.70] —
    // a 30% band around the spawn — and place the threat above or
    // below it. The 50/50 coin keeps the chunk from feeling
    // top-heavy.
    return rng.next() < 0.5
      ? height * rng.range(0.08, 0.38)
      : height * rng.range(0.72, 0.94);
  }
  return height * rng.range(0.1, 0.9);
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

/**
 * Atmospheric ambient fish — small, dim drifters scattered across the
 * chunk. They never count for score, oxygen, or chain (collection
 * skips `ambient: true`); their entire job is to make the water feel
 * alive between bright scoring beacons. ~12 per chunk regardless of
 * biome — a baseline density the player always sees.
 */
const AMBIENT_FISH_PER_CHUNK = 12;

export function spawnAmbientFishForChunk(
  chunk: Chunk,
  viewport: ViewportDimensions,
): Creature[] {
  // Use a distinct rng offset from beacons/predators so adding ambient
  // fish doesn't disturb the deterministic positions of scoring
  // entities in saved seeds.
  const rng = createRng(chunk.seed + 31337);
  const { width, height } = viewport;

  return Array.from({ length: AMBIENT_FISH_PER_CHUNK }, (_, index) => {
    const worldYMeters = round(
      chunk.yTopMeters + rng.range(0.05, 0.95) * CHUNK_HEIGHT_METERS,
      2,
    );
    const chunkLocalY = (worldYMeters - chunk.yTopMeters) / CHUNK_HEIGHT_METERS;
    const xNorm = rng.range(0.02, 0.98);
    const yNorm = 0.05 + chunkLocalY * 0.9;

    return {
      ambient: true,
      // Brighter mint-tinted slate so ambient fish aren't pure
      // grey-on-navy invisible. Their job is to populate the trench
      // visually; a slight bioluminescence sells "this water is alive."
      color: "#7896a3",
      glowColor: "#9fc8c0",
      glowIntensity: round(0.42 + rng.range(0, 0.18), 3),
      id: `ambient-c${chunk.index}-${index + 1}`,
      noiseOffsetX: round(rng.range(0, 1000), 2),
      noiseOffsetY: round(rng.range(0, 1000), 2),
      pulsePhase: round(rng.range(0, Math.PI * 2), 3),
      size: round(rng.range(14, 22), 2),
      speed: round(rng.range(0.08, 0.22), 3),
      type: "fish" as const,
      worldYMeters,
      x: round(playBandMinX(width) + xNorm * playBandWidth(width), 2),
      y: round(yNorm * height, 2),
    };
  });
}

export function spawnCreaturesForChunks(
  chunks: readonly Chunk[],
  viewport: ViewportDimensions,
): Creature[] {
  return chunks.flatMap((c) => [
    ...spawnCreaturesForChunk(c, viewport),
    ...spawnAmbientFishForChunk(c, viewport),
  ]);
}

export function spawnPredatorsForChunks(
  chunks: readonly Chunk[],
  viewport: ViewportDimensions,
  pattern: ThreatPattern = "scattered",
): Predator[] {
  return chunks.flatMap((c) => spawnPredatorsForChunk(c, viewport, pattern));
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
