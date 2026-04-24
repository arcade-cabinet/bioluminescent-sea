import type { Rng } from "@/sim/rng";
import { clamp, round } from "@/sim/_shared/math";
import { playBandMinX, playBandWidth } from "@/sim/_shared/playBand";
import type { ViewportDimensions } from "@/sim/dive/types";
import { CREATURE_COLORS, type Creature, type CreatureType } from "./types";
import type { Particle, Pirate, Player, Predator } from "./types";

/**
 * Seed-driven entity spawning.
 *
 * Every placement is a pure function of an Rng derived from the
 * dive's seed. No Math.random, no hardcoded tables — the same seed
 * always produces identical positions, sizes, phases.
 *
 * Counts are fixed per-entity-kind for now (18 creatures, 2 predators,
 * 2 pirates, 130 particles) so PR F's chunking can layer on top
 * without re-working the dive lifecycle. Density-by-biome lives in
 * src/sim/world/biomes.ts and lands when chunks do.
 */

export const SEEDED_CREATURE_COUNT = 18;
export const SEEDED_PREDATOR_COUNT = 2;
export const SEEDED_PIRATE_COUNT = 2;
export const SEEDED_PARTICLE_COUNT = 130;

export function spawnSeededPlayer(
  { width, height }: ViewportDimensions
): Player {
  // Player starts at viewport center regardless of seed — the player
  // is the camera's reference point, not a scene-random element.
  const x = width * 0.5;
  const y = height * 0.54;
  return {
    angle: -Math.PI / 18,
    glowIntensity: 1,
    targetX: x,
    targetY: y,
    x,
    y,
  };
}

export function spawnSeededCreatures(
  rng: Rng,
  { width, height }: ViewportDimensions
): Creature[] {
  const minDimension = Math.min(width, height);
  const types: CreatureType[] = ["plankton", "jellyfish", "fish"];

  return Array.from({ length: SEEDED_CREATURE_COUNT }, (_, index) => {
    const type = rng.pick(types);
    const colors = CREATURE_COLORS[type];
    const sizeScale = sizeForType(type);

    // Place creatures in a distributed-random grid so they don't
    // clump: divide the viewport into rows, place each creature in
    // its row with horizontal jitter.
    const rowCount = 6;
    const row = index % rowCount;
    const rowTop = (row / rowCount) * 0.92 + 0.04;
    const rowHeight = 0.92 / rowCount;
    const yNorm = rowTop + rng.range(0.15, 0.85) * rowHeight;
    const xNorm = rng.range(0.06, 0.94);

    return {
      color: colors.color,
      glowColor: colors.glow,
      glowIntensity: round(0.68 + rng.range(0, 0.28), 3),
      id: `beacon-${index + 1}`,
      noiseOffsetX: round(rng.range(0, 1000), 2),
      noiseOffsetY: round(rng.range(0, 1000), 2),
      pulsePhase: round(rng.range(0, Math.PI * 2), 3),
      size: round(clamp(minDimension * sizeScale, 14, 36), 2),
      speed: round(rng.range(0.18, 0.55), 3),
      type,
      x: round(xNorm * width, 2),
      y: round(yNorm * height, 2),
    };
  });
}

export function spawnSeededPredators(
  rng: Rng,
  { width, height }: ViewportDimensions
): Predator[] {
  const minDimension = Math.min(width, height);
  const baseSize = clamp(minDimension * 0.14, 54, 94);

  return Array.from({ length: SEEDED_PREDATOR_COUNT }, (_, index) => ({
    angle: round(rng.range(-Math.PI, Math.PI), 3),
    id: `predator-${index + 1}`,
    noiseOffset: round(rng.range(0, 1000), 2),
    size: round(baseSize * rng.range(0.85, 1.05), 2),
    speed: round(rng.range(0.5, 0.75), 3),
    x: round(width * rng.range(0.1, 0.9), 2),
    y: round(height * rng.range(0.25, 0.8), 2),
  }));
}

export function spawnSeededPirates(
  rng: Rng,
  { width, height }: ViewportDimensions
): Pirate[] {
  return Array.from({ length: SEEDED_PIRATE_COUNT }, (_, index) => ({
    angle: round(rng.range(-Math.PI, Math.PI), 3),
    id: `pirate-${index + 1}`,
    lanternPhase: round(rng.range(0, Math.PI * 2), 3),
    noiseOffset: round(rng.range(0, 1000), 2),
    speed: round(rng.range(0.7, 0.9), 3),
    x: round(width * rng.range(0.05, 0.95), 2),
    y: round(height * rng.range(0.2, 0.8), 2),
  }));
}

export function spawnSeededParticles(
  rng: Rng,
  { width, height }: ViewportDimensions
): Particle[] {
  return Array.from({ length: SEEDED_PARTICLE_COUNT }, (_, index) => {
    const drift = round(rng.range(0, 100), 3);
    return {
      drift,
      opacity: round(0.1 + Math.sin(drift) * 0.1, 3),
      seed: index + 1,
      size: round(rng.range(0.8, 3.4), 2),
      speed: round(rng.range(0.18, 0.7), 3),
      x: round(rng.range(0, width), 2),
      y: round(rng.range(0, height), 2),
    };
  });
}

function sizeForType(type: CreatureType): number {
  if (type === "jellyfish") return 0.058;
  if (type === "fish") return 0.05;
  return 0.036;
}
