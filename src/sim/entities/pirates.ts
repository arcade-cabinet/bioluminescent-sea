import { noise2D } from "@/sim/_shared/perlin";
import { clamp, getFrameScale, interpolateAngle, round } from "@/sim/_shared/math";
import { playBandMaxX, playBandMinX } from "@/sim/_shared/playBand";
import type { ViewportDimensions } from "@/sim/dive/types";
import type { Pirate, Player } from "./types";

export function createInitialPirates({ width, height }: ViewportDimensions): Pirate[] {
  const leftEdge = playBandMinX(width);
  const rightEdge = playBandMaxX(width);
  return [
    {
      angle: 0.08,
      id: "lantern-skiff-port",
      lanternPhase: 0.4,
      noiseOffset: 120,
      speed: 0.76,
      // Park the pirates at the band's edges so the lantern cones
      // are only a threat if the player explores laterally — right
      // at center the viewport is clean.
      x: round(leftEdge + width * 0.1, 2),
      y: round(height * 0.28, 2),
    },
    {
      angle: Math.PI - 0.12,
      id: "lantern-skiff-starboard",
      lanternPhase: 2.2,
      noiseOffset: 520,
      speed: 0.82,
      x: round(rightEdge - width * 0.1, 2),
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

  // Soft wrap-around at the play band's edges — pirates that drift
  // past the band reverse heading so they don't escape into the
  // void. The band is already much wider than the viewport, so this
  // rarely triggers during normal play.
  const leftBound = playBandMinX(width) - 100;
  const rightBound = playBandMaxX(width) + 100;
  if (x < leftBound) {
    x = leftBound;
    angle = 0;
  }
  if (x > rightBound) {
    x = rightBound;
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
