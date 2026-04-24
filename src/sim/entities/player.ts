import { clamp, getFrameScale, round } from "@/sim/_shared/math";
import { clampToPlayBand } from "@/sim/_shared/playBand";
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
    speedScale: 1,
    lampScale: 1,
  };
}

export function advancePlayer(
  player: Player,
  input: DiveInput,
  { width, height }: ViewportDimensions,
  totalTime: number,
  deltaTime: number
): Player {
  // Input comes in as pixel-x already offset by the camera scroll
  // (DeepSeaGame applies the scroll delta before the sim tick), so
  // here we clamp to the full lateral play band — the viewport is no
  // longer the world. Y stays viewport-clamped: descent owns the
  // vertical axis, player input is horizontal + pitch.
  const targetX = input.isActive ? clampToPlayBand(input.x, width) : player.targetX;
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

  const speed = Math.min(distance * 0.08, 8 * player.speedScale) * frameScale * player.speedScale;

  return {
    ...player,
    angle: Math.atan2(dy, dx),
    glowIntensity: round(0.72 + Math.sin(totalTime * 3) * 0.26, 3),
    targetX,
    targetY,
    x: clampToPlayBand(player.x + (dx / distance) * speed, width),
    y: clamp(player.y + (dy / distance) * speed, 0, height),
  };
}
