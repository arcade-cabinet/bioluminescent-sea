import { getFrameScale, normalizedHash, round } from "@/sim/_shared/math";
import type { ViewportDimensions } from "@/sim/dive/types";
import type { Particle } from "./types";

export const PARTICLE_COUNT = 250;

export function createInitialParticles({ width, height }: ViewportDimensions): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const horizontal = normalizedHash(index, 37, 127);
    const vertical = normalizedHash(index, 53, 131);
    const drift = round(index * 0.71, 3);
    
    // Assign zDepth based on index mod
    const layerType = index % 10;
    let zDepth = 0;
    let baseSize = 1;
    let baseSpeed = 0.2;
    let baseOpacity = 0.1;
    
    if (layerType < 5) {
      // Background (most numerous)
      zDepth = 1.0;
      baseSize = 0.5;
      baseSpeed = 0.1;
      baseOpacity = 0.05;
    } else if (layerType < 8) {
      // Midground
      zDepth = 0.0;
      baseSize = 1.5;
      baseSpeed = 0.3;
      baseOpacity = 0.12;
    } else {
      // Foreground (huge, fast, sparse)
      zDepth = -1.2;
      baseSize = 4.5;
      baseSpeed = 0.8;
      baseOpacity = 0.03;
    }

    return {
      drift,
      opacity: round(baseOpacity + Math.sin(drift) * 0.05, 3),
      seed: index + 1,
      size: round(baseSize + normalizedHash(index, 29, 89) * baseSize, 2),
      speed: round(baseSpeed + normalizedHash(index, 31, 83) * baseSpeed * 0.5, 3),
      zDepth,
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
  // Curl-noise-inspired drift: two decoupled low-frequency sinusoids
  // along orthogonal axes produce a divergence-free-feeling vector
  // field without the cost of an actual curl-of-perlin sample. Each
  // particle's seed offsets into the field, so neighbours flow in
  // related-but-not-identical directions — the "fluid" read we want.
  const flowX =
    Math.sin(particle.drift + totalTime * 0.6) * 0.35 +
    Math.cos(particle.seed * 0.11 + totalTime * 0.18) * 0.22;
  const flowY =
    Math.cos(particle.drift * 0.7 + totalTime * 0.4) * 0.18;

  let y = particle.y - particle.speed * frameScale + flowY * frameScale;
  let x = particle.x + flowX * frameScale;

  if (y < -particle.size) {
    y = height + particle.size;
    x = getDeterministicWrapX(particle.seed, totalTime, width);
  }
  // Horizontal wrap so curl drift can't push motes out of frame.
  if (x < -particle.size) x = width + particle.size;
  else if (x > width + particle.size) x = -particle.size;

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
