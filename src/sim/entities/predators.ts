import { fbm } from "@/sim/_shared/perlin";
import { clamp, getFrameScale, round } from "@/sim/_shared/math";
import { clampToPlayBand, playBandMaxX, playBandMinX } from "@/sim/_shared/playBand";
import type { ViewportDimensions } from "@/sim/dive/types";
import type { Player, Predator } from "./types";

export function createInitialPredators({ width, height }: ViewportDimensions): Predator[] {
  const baseSize = clamp(640 * 0.14, 54, 94);
  const leftEdge = playBandMinX(width);
  const rightEdge = playBandMaxX(width);

  return [
    {
      angle: -0.18,
      id: "angler-left",
      noiseOffset: 200,
      size: round(baseSize, 2),
      speed: 0.55,
      // Spawn at the far-left of the play band so the player can
      // first meet a predator by drifting laterally, not just by
      // staying center. Same for the starboard eel on the right.
      x: round(leftEdge + width * 0.2, 2),
      y: round(height * 0.74, 2),
    },
    {
      angle: Math.PI - 0.22,
      id: "eel-right",
      noiseOffset: 640,
      size: round(baseSize * 0.92, 2),
      speed: 0.64,
      x: round(rightEdge - width * 0.2, 2),
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
    x: clampToPlayBand(
      predator.x + (dx / distance) * speed + Math.cos(noiseAngle * Math.PI * 2) * drift,
      width,
    ),
    y: clamp(
      predator.y + (dy / distance) * speed + Math.sin(noiseAngle * Math.PI * 2) * drift,
      0,
      height
    ),
  };
}
