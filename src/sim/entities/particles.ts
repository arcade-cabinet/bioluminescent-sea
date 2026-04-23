import { getFrameScale, normalizedHash, round } from "@/sim/_shared/math";
import type { ViewportDimensions } from "@/sim/dive/types";
import type { Particle } from "./types";

export const PARTICLE_COUNT = 130;

export function createInitialParticles({ width, height }: ViewportDimensions): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const horizontal = normalizedHash(index, 37, 127);
    const vertical = normalizedHash(index, 53, 131);
    const drift = round(index * 0.71, 3);

    return {
      drift,
      // Seed opacity from the same sine that `advanceParticle` uses
      // at totalTime=0, so the first post-advance frame doesn't jump.
      opacity: round(0.1 + Math.sin(drift) * 0.1, 3),
      seed: index + 1,
      size: round(0.8 + normalizedHash(index, 29, 89) * 2.6, 2),
      speed: round(0.18 + normalizedHash(index, 31, 83) * 0.52, 3),
      x: round(horizontal * width, 2),
      y: round(vertical * height, 2),
    };
  });
}

export function advanceParticle(
  particle: Particle,
  { width, height }: ViewportDimensions,
  totalTime: number,
  deltaTime: number
): Particle {
  const frameScale = getFrameScale(deltaTime);
  let y = particle.y - particle.speed * frameScale;
  let x = particle.x + Math.sin(particle.drift + totalTime) * 0.3 * frameScale;

  if (y < -particle.size) {
    y = height + particle.size;
    x = getDeterministicWrapX(particle.seed, totalTime, width);
  }

  return {
    ...particle,
    opacity: round(0.1 + Math.sin(totalTime * 2 + particle.drift) * 0.1, 3),
    x,
    y,
  };
}

export function getDeterministicWrapX(seed: number, totalTime: number, width: number): number {
  const timeBucket = Math.floor(totalTime * 10);
  const value = ((seed * 37 + timeBucket * 53) % 997) / 997;
  return round(value * width, 3);
}
