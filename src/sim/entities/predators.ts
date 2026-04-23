import { fbm } from "@/sim/_shared/perlin";
import { clamp, getFrameScale, round } from "@/sim/_shared/math";
import type { ViewportDimensions } from "@/sim/dive/types";
import type { Player, Predator } from "./types";

export function createInitialPredators({ width, height }: ViewportDimensions): Predator[] {
  const minDimension = Math.min(width, height);
  const baseSize = clamp(minDimension * 0.14, 54, 94);

  return [
    {
      angle: -0.18,
      id: "angler-left",
      noiseOffset: 200,
      size: round(baseSize, 2),
      speed: 0.55,
      x: round(width * 0.14, 2),
      y: round(height * 0.74, 2),
    },
    {
      angle: Math.PI - 0.22,
      id: "eel-right",
      noiseOffset: 640,
      size: round(baseSize * 0.92, 2),
      speed: 0.64,
      x: round(width * 0.86, 2),
      y: round(height * 0.31, 2),
    },
  ];
}

export function advancePredator(
  predator: Predator,
  player: Player,
  { width, height }: ViewportDimensions,
  totalTime: number,
  deltaTime: number,
  speedScale = 1
): Predator {
  const dx = player.x - predator.x;
  const dy = player.y - predator.y;
  const distance = Math.hypot(dx, dy);
  const frameScale = getFrameScale(deltaTime);

  if (distance === 0) {
    return predator;
  }

  const noiseAngle = fbm(predator.noiseOffset + totalTime * 0.3, totalTime * 0.2);
  const closingBoost = distance < 150 ? 1.52 : 0.88;
  const speed = predator.speed * closingBoost * frameScale * speedScale;
  const drift = distance < 150 ? 0 : 0.5 * frameScale;

  return {
    ...predator,
    angle: Math.atan2(dy, dx),
    x: clamp(
      predator.x + (dx / distance) * speed + Math.cos(noiseAngle * Math.PI * 2) * drift,
      0,
      width
    ),
    y: clamp(
      predator.y + (dy / distance) * speed + Math.sin(noiseAngle * Math.PI * 2) * drift,
      0,
      height
    ),
  };
}
