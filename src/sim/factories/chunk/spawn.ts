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
import type { BiomeId } from "@/sim/factories/region/types";

/**
 * Biome-keyed species palettes. Same `CreatureType` (the renderer's
 * shape selector) gets a different colour scheme per biome so each
 * depth band reads as its own ecology — silver-green kelp glowfish
 * in the photic gate, deep-amber dragonfish in the midnight column,
 * crimson vent-fish in the abyssal trench. The `pick` function
 * returns one variant per spawn (chunk-seeded RNG), so even within a
 * biome a chunk can show 2-3 species shoaling together.
 */
const SPECIES_VARIANTS: Record<
  BiomeId,
  Record<CreatureType, ReadonlyArray<{ color: string; glow: string }>>
> = {
  "photic-gate": {
    fish: [
      { color: "#a8d8c5", glow: "#6be6c1" },     // mint kelp glowfish
      { color: "#c8e6a0", glow: "#9ce86b" },     // chartreuse reef-darter
    ],
    jellyfish: [
      { color: "#b3e8ff", glow: "#7dd3fc" },     // sky moon-jelly
      { color: "#c4e8d0", glow: "#86efac" },     // pale spring-medusa
    ],
    plankton: [
      { color: "#d8f3ff", glow: "#a5f3fc" },     // pale-cyan diatoms
    ],
  },
  "twilight-shelf": {
    fish: [
      { color: "#9bb8d8", glow: "#7dd3fc" },     // chrome lanternfish
      { color: "#a896d8", glow: "#c4b5fd" },     // violet flashlight-fish
    ],
    jellyfish: [
      { color: "#a0d0e0", glow: "#67e8f9" },     // glow comb-jelly
      { color: "#b08fd8", glow: "#a78bfa" },     // amethyst bell
    ],
    plankton: [
      { color: "#b8d4e8", glow: "#7dd3fc" },     // lit-blue krill
    ],
  },
  "midnight-column": {
    fish: [
      { color: "#5a3a2a", glow: "#fbbf24" },     // amber dragonfish
      { color: "#3a2840", glow: "#a78bfa" },     // shadow lanternjaw
    ],
    jellyfish: [
      { color: "#3a2030", glow: "#f472b6" },     // blood-bell siphonophore
      { color: "#243450", glow: "#60a5fa" },     // sapphire pyrosome
    ],
    plankton: [
      { color: "#604838", glow: "#fcd34d" },     // amber star-plankton
    ],
  },
  "abyssal-trench": {
    fish: [
      { color: "#5a2620", glow: "#ff6b6b" },     // crimson vent-fish
      { color: "#3a1a30", glow: "#fb7185" },     // ember chimera
    ],
    jellyfish: [
      { color: "#48202a", glow: "#fb923c" },     // forge-jelly
      { color: "#2a1a30", glow: "#f87171" },     // red-glow tube-jelly
    ],
    plankton: [
      { color: "#5a2a20", glow: "#fbbf24" },     // ember plankton
    ],
  },
  "stygian-abyss": {
    fish: [
      { color: "#1a0a14", glow: "#7c3aed" },     // void anglerjaw
      { color: "#0a0418", glow: "#a78bfa" },     // ghost lanternjaw
    ],
    jellyfish: [
      { color: "#1a0a18", glow: "#a855f7" },     // shadowbell
    ],
    plankton: [
      { color: "#0a0418", glow: "#c4b5fd" },     // ghost-mote
    ],
  },
};

function pickSpeciesPalette(
  biomeId: BiomeId,
  type: CreatureType,
  rng: { pick: <T>(arr: readonly T[]) => T },
): { color: string; glow: string } {
  const variants = SPECIES_VARIANTS[biomeId]?.[type];
  if (!variants || variants.length === 0) return CREATURE_COLORS[type];
  return rng.pick(variants);
}

/**
 * Spawn pattern — the *shape* of a chunk's threat layout. A slot value on
 * `ModeSlots`, consumed here and only here. Adding a new pattern is a
 * switch arm, not a cross-cutting rewrite. See `./slots.ts` for the
 * canonical union and player-facing rationale.
 */
export type { ThreatPattern };

// Authored envelope for a chunk's charted creatures. Biome multipliers
// scale on top (0.7–1.4× depending on biome.creatureDensity); the
// chunk's own seed picks where in the envelope it lands so two chunks
// with the same biome don't necessarily have the same count.
export const BASE_CREATURES_PER_CHUNK_RANGE = [8, 14] as const;

export function spawnCreaturesForChunk(
  chunk: Chunk,
  viewport: ViewportDimensions,
): Creature[] {
  const biome = biomeById(chunk.biome);
  const baseRng = createRng(chunk.seed);
  const baseCount = baseRng.int(
    BASE_CREATURES_PER_CHUNK_RANGE[0],
    BASE_CREATURES_PER_CHUNK_RANGE[1],
  );
  const count = Math.max(
    1,
    Math.round(baseCount * biome.creatureDensity * 1.3),
  );

  // Distinct subseed: baseRng above already burned chunk.seed's first
  // draw to pick the count. Reuse that stream for placement so two
  // chunks with the same seed produce identical layouts (deterministic
  // replay) without the count-pick perturbing every downstream draw if
  // the count envelope changes.
  const rng = baseRng;
  const types: CreatureType[] = ["plankton", "jellyfish", "fish"];
  const { width, height } = viewport;

  return Array.from({ length: count }, (_, index) => {
    const type = rng.pick(types);
    const colors = pickSpeciesPalette(chunk.biome, type, rng);
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
  // Multiplier on biome.predatorDensity is seed-derived per chunk so
  // dives feel different even at the same depth band. Authored
  // envelope [4, 8] keeps things in the same density family but avoids
  // every chunk landing on the same number.
  const predatorRng = createRng(chunk.seed + 7777);
  const densityMultiplier = predatorRng.range(4, 8);
  const baseCount = Math.round(biome.predatorDensity * densityMultiplier);
  // Pattern scales the raw count: swarm doubles, shoal-press triples,
  // scattered stays at biome density. This keeps each chunk's pressure
  // tuneable from the mode slot alone.
  const patternScale =
    pattern === "shoal-press" ? 3 : pattern === "swarm" ? 2 : 1;
  const count = clamp(baseCount * patternScale, 0, pattern === "shoal-press" ? 24 : 10);

  if (count === 0 && !isStygian) return [];

  // Reuse the predator RNG stream so the count-pick above and the
  // placement draws below come from the same deterministic sequence.
  const rng = predatorRng;
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
      //
      // Chunk-0 player-spawn carve-out: the player's initial pos is
      // (centre, 0.54*h). With Arena's `collisionEndsDive: true` +
      // `impactGraceSeconds: 0`, a shoal-press predator landing on
      // the player at frame 1 ends the dive instantly. Skip any cell
      // whose center falls inside the carve-out box around the
      // player. Subsequent chunks (chunk > 0) place their grid
      // freely — by then the player has had time to start moving.
      const cols = 6;
      const rows = Math.max(1, Math.ceil(count / cols));
      const cellW = playBandWidth(width) / (cols + 1);
      const cellH = (height * 0.8) / (rows + 1);
      const carveX = chunk.index === 0 ? width * 0.5 : Number.NaN;
      const carveY = chunk.index === 0 ? height * 0.54 : Number.NaN;
      const carveR = chunk.index === 0 ? Math.min(width, height) * 0.28 : 0;
      let i = 0;
      let placed = 0;
      while (placed < count && i < cols * rows * 2) {
        const col = i % cols;
        const row = Math.floor(i / cols) % rows;
        const cx = playBandMinX(width) + (col + 1) * cellW + rng.range(-10, 10);
        const cy = height * 0.1 + (row + 1) * cellH + rng.range(-8, 8);
        i++;
        if (chunk.index === 0) {
          const dx = cx - carveX;
          const dy = cy - carveY;
          if (Math.hypot(dx, dy) < carveR) {
            // Skip — too close to fresh spawn. The grid is large
            // enough that we still place plenty of predators.
            continue;
          }
        }
        const isMarauder = rng.next() > 0.4;
        results.push({
          angle: round(rng.range(-Math.PI, Math.PI), 3),
          // Shoal-press uses the marauder-sub archetype so the AI
          // manager can route a hunting behaviour via id prefix.
          id: isMarauder
            ? `marauder-sub-c${chunk.index}-${placed}`
            : `predator-c${chunk.index}-${placed}`,
          noiseOffset: round(rng.range(0, 1000), 2),
          size: round(baseSize * rng.range(0.55, 0.75), 2),
          speed: round(rng.range(0.9, 1.2), 3),
          x: round(cx, 2),
          y: round(cy, 2),
        });
        placed++;
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

  const types: AnomalyType[] = [
    "repel",
    "overdrive",
    "breath",
    "lure",
    "lamp-flare",
  ];
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

  // Mix species: ~50% fish, ~30% jellyfish, ~20% plankton. The
  // renderer branches on Creature.type so each shape paints
  // differently — without this every ambient drifter rendered as a
  // fish silhouette and the trench looked monotonous.
  const ambientTypes: CreatureType[] = ["fish", "fish", "fish", "fish", "fish", "jellyfish", "jellyfish", "jellyfish", "plankton", "plankton"];

  return Array.from({ length: AMBIENT_FISH_PER_CHUNK }, (_, index) => {
    const worldYMeters = round(
      chunk.yTopMeters + rng.range(0.05, 0.95) * CHUNK_HEIGHT_METERS,
      2,
    );
    const chunkLocalY = (worldYMeters - chunk.yTopMeters) / CHUNK_HEIGHT_METERS;
    const xNorm = rng.range(0.02, 0.98);
    const yNorm = 0.05 + chunkLocalY * 0.9;
    const type = rng.pick(ambientTypes);
    // Each ambient species gets a slightly different muted palette
    // so the eye reads variety even at small sizes / dim glow.
    const palette =
      type === "jellyfish"
        ? { color: "#7a8aa6", glow: "#a0b8e0" }
        : type === "plankton"
          ? { color: "#94a8a0", glow: "#c2dccd" }
          : { color: "#7896a3", glow: "#9fc8c0" };

    return {
      ambient: true,
      color: palette.color,
      glowColor: palette.glow,
      glowIntensity: round(0.42 + rng.range(0, 0.18), 3),
      id: `ambient-c${chunk.index}-${index + 1}`,
      noiseOffsetX: round(rng.range(0, 1000), 2),
      noiseOffsetY: round(rng.range(0, 1000), 2),
      pulsePhase: round(rng.range(0, Math.PI * 2), 3),
      size: round(rng.range(14, 22), 2),
      speed: round(rng.range(0.08, 0.22), 3),
      type,
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
