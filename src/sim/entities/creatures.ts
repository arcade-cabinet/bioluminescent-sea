import { noise2D } from "@/sim/_shared/perlin";
import { clamp, getFrameScale, round, wrapCoordinate } from "@/sim/_shared/math";
import { playBandMinX, playBandWidth, wrapAroundPlayBand } from "@/sim/_shared/playBand";
import type { ViewportDimensions } from "@/sim/dive/types";
import { CREATURE_COLORS, type Creature, type CreatureType } from "./types";

interface CreatureAnchor {
  type: CreatureType;
  x: number;
  y: number;
  size: number;
}

export const CREATURE_ANCHORS: readonly CreatureAnchor[] = [
  { type: "plankton", x: 0.16, y: 0.2, size: 0.038 },
  { type: "jellyfish", x: 0.35, y: 0.18, size: 0.061 },
  { type: "fish", x: 0.7, y: 0.22, size: 0.051 },
  { type: "plankton", x: 0.85, y: 0.34, size: 0.035 },
  { type: "fish", x: 0.58, y: 0.36, size: 0.049 },
  { type: "jellyfish", x: 0.23, y: 0.42, size: 0.058 },
  { type: "plankton", x: 0.45, y: 0.5, size: 0.034 },
  { type: "fish", x: 0.78, y: 0.55, size: 0.047 },
  { type: "jellyfish", x: 0.12, y: 0.64, size: 0.062 },
  { type: "plankton", x: 0.32, y: 0.72, size: 0.036 },
  { type: "fish", x: 0.54, y: 0.7, size: 0.052 },
  { type: "jellyfish", x: 0.88, y: 0.76, size: 0.06 },
  { type: "plankton", x: 0.67, y: 0.84, size: 0.034 },
  { type: "fish", x: 0.18, y: 0.86, size: 0.049 },
  { type: "jellyfish", x: 0.47, y: 0.27, size: 0.056 },
  { type: "plankton", x: 0.74, y: 0.44, size: 0.033 },
  { type: "fish", x: 0.28, y: 0.57, size: 0.05 },
  { type: "jellyfish", x: 0.62, y: 0.62, size: 0.057 },
];

export const TOTAL_BEACONS = CREATURE_ANCHORS.length;

export function createInitialCreatures({ width, height }: ViewportDimensions): Creature[] {
  const minDimension = Math.min(width, height);
  // The legacy seeded scene packs creatures tight in the viewport;
  // the chunked-spawn path is the canonical world-aware one. For
  // this fallback we stretch the anchors across the full play band
  // so lateral exploration finds creatures instead of an empty band.
  const bandMin = playBandMinX(width);
  const bandWidth = playBandWidth(width);

  return CREATURE_ANCHORS.map((anchor, index) => {
    const colors = CREATURE_COLORS[anchor.type];
    const laneOffset = ((index % 3) - 1) * Math.min(18, minDimension * 0.025);

    return {
      color: colors.color,
      glowColor: colors.glow,
      glowIntensity: round(0.68 + (index % 5) * 0.055),
      id: `beacon-${index + 1}`,
      noiseOffsetX: 120 + index * 19,
      noiseOffsetY: 430 + index * 23,
      pulsePhase: (index * Math.PI) / 5,
      size: round(clamp(minDimension * anchor.size, 14, 36), 2),
      speed: round(0.2 + (index % 4) * 0.075, 3),
      type: anchor.type,
      x: round(bandMin + anchor.x * bandWidth + laneOffset, 2),
      y: round(clamp(height * anchor.y - laneOffset * 0.35, 24, height - 24), 2),
    };
  });
}

export function advanceCreature(
  creature: Creature,
  { width, height }: ViewportDimensions,
  totalTime: number,
  deltaTime: number
): Creature {
  const frameScale = getFrameScale(deltaTime);
  const noiseX = noise2D(creature.noiseOffsetX + totalTime * creature.speed, creature.noiseOffsetY);
  const noiseY = noise2D(creature.noiseOffsetX, creature.noiseOffsetY + totalTime * creature.speed);
  const pulsePhase = creature.pulsePhase + deltaTime * 2;

  return {
    ...creature,
    glowIntensity: round(0.62 + Math.sin(pulsePhase) * 0.28, 3),
    pulsePhase,
    x: wrapAroundPlayBand(creature.x + noiseX * 2 * frameScale, width, creature.size),
    y: wrapCoordinate(creature.y + noiseY * 2 * frameScale, height, creature.size),
  };
}
