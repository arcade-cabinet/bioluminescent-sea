import { noise2D } from "@/sim/_shared/perlin";
import { clamp, getFrameScale, interpolateAngle, round } from "@/sim/_shared/math";
import type { ViewportDimensions } from "@/sim/dive/types";
import type { Pirate, Player } from "./types";

export function createInitialPirates({ width, height }: ViewportDimensions): Pirate[] {
  return [
    {
      angle: 0.08,
      id: "lantern-skiff-port",
      lanternPhase: 0.4,
      noiseOffset: 120,
      speed: 0.76,
      x: round(width * 0.08, 2),
      y: round(height * 0.28, 2),
    },
    {
      angle: Math.PI - 0.12,
      id: "lantern-skiff-starboard",
      lanternPhase: 2.2,
      noiseOffset: 520,
      speed: 0.82,
      x: round(width * 0.92, 2),
      y: round(height * 0.68, 2),
    },
  ];
}

export function advancePirate(
  pirate: Pirate,
  player: Player,
  { width, height }: ViewportDimensions,
  totalTime: number,
  deltaTime: number,
  speedScale = 1
): Pirate {
  const dx = player.x - pirate.x;
  const dy = player.y - pirate.y;
  const distance = Math.hypot(dx, dy);
  const frameScale = getFrameScale(deltaTime);
  const noiseY = noise2D(pirate.noiseOffset, totalTime * 0.5) * 2 * frameScale;
  let angle = pirate.angle;
  let x = pirate.x;
  let y = pirate.y;

  if (distance < 300 && distance > 0) {
    const targetAngle = Math.atan2(dy, dx);
    angle = interpolateAngle(pirate.angle, targetAngle, 0.05 * frameScale);
    x += Math.cos(angle) * pirate.speed * 1.2 * frameScale * speedScale;
    y += Math.sin(angle) * pirate.speed * 1.2 * frameScale * speedScale + noiseY * 0.5;
  } else {
    x += Math.cos(angle) * pirate.speed * 0.5 * frameScale * speedScale;
    y += noiseY;
  }

  if (x < -100) {
    x = -100;
    angle = 0;
  }

  if (x > width + 100) {
    x = width + 100;
    angle = Math.PI;
  }

  return {
    ...pirate,
    angle,
    lanternPhase: pirate.lanternPhase + deltaTime * 5,
    x,
    y: clamp(y, 50, Math.max(50, height - 50)),
  };
}
