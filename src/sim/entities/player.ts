import { clamp, getFrameScale, round } from "@/sim/_shared/math";
import type { ViewportDimensions } from "@/sim/dive/types";
import type { Player } from "./types";
import type { DiveInput } from "@/sim/dive/types";

export function createInitialPlayer({ width, height }: ViewportDimensions): Player {
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

export function advancePlayer(
  player: Player,
  input: DiveInput,
  { width, height }: ViewportDimensions,
  totalTime: number,
  deltaTime: number
): Player {
  const targetX = input.isActive ? clamp(input.x, 0, width) : player.targetX;
  const targetY = input.isActive ? clamp(input.y, 0, height) : player.targetY;
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const distance = Math.hypot(dx, dy);
  const frameScale = getFrameScale(deltaTime);

  if (distance <= 1) {
    return {
      ...player,
      glowIntensity: round(0.72 + Math.sin(totalTime * 3) * 0.26, 3),
      targetX,
      targetY,
    };
  }

  const speed = Math.min(distance * 0.08, 8) * frameScale;

  return {
    angle: Math.atan2(dy, dx),
    glowIntensity: round(0.72 + Math.sin(totalTime * 3) * 0.26, 3),
    targetX,
    targetY,
    x: clamp(player.x + (dx / distance) * speed, 0, width),
    y: clamp(player.y + (dy / distance) * speed, 0, height),
  };
}
