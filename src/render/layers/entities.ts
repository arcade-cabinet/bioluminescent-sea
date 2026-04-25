import { Container, Graphics } from "pixi.js";
import { GlowFilter } from "pixi-filters";
import type { Camera } from "@/render/camera";
import { drawProceduralCreature } from "./creature-factory";
import type {
  Anomaly,
  Creature,
  Pirate,
  Predator,
} from "@/sim/entities/types";

export interface EntityController {
  sync(args: {
    anomalies: readonly Anomaly[];
    creatures: readonly Creature[];
    predators: readonly Predator[];
    pirates: readonly Pirate[];
    totalTime: number;
    camera?: Camera;
  }): void;
  destroy(): void;
}

export function mountEntities(parent: Container, rendererResolution = 1): EntityController {
  // Anomalies live in their own sub-container with a GlowFilter so
  // the buff pickups read as emissive even at distance. The explicit
  // resolution stamp matches the renderer's DPR — without it the
  // glow texture renders at half size on retina, producing the
  // upper-left rectangle artifact (see water.ts for the longer
  // diagnosis + pixijs/pixijs#11467).
  const anomalyHost = new Container();
  anomalyHost.label = "entities:anomalies";
  const anomalyGlow = new GlowFilter({
    distance: 18,
    outerStrength: 1.6,
    innerStrength: 0.2,
    color: 0xffffff,
    quality: 0.35,
  });
  anomalyGlow.resolution = rendererResolution;
  anomalyHost.filters = [anomalyGlow];
  parent.addChild(anomalyHost);

  const anomalies = new Map<string, Graphics>();
  const creatures = new Map<string, Graphics>();
  const predators = new Map<string, Graphics>();
  const pirates = new Map<string, Graphics>();

  return {
    sync({ anomalies: as, creatures: cs, predators: ps, pirates: ks, totalTime, camera }) {
      syncAnomalies(anomalyHost, anomalies, as, camera);
      syncCreatures(parent, creatures, cs, camera);
      syncPredators(parent, predators, ps, totalTime);
      syncPirates(parent, pirates, ks, totalTime);
    },
    destroy() {
      for (const g of anomalies.values()) g.destroy();
      for (const g of creatures.values()) g.destroy();
      for (const g of predators.values()) g.destroy();
      for (const g of pirates.values()) g.destroy();
      anomalies.clear();
      creatures.clear();
      predators.clear();
      pirates.clear();
      anomalyHost.filters = [];
      anomalyHost.destroy();
    },
  };
}

function syncAnomalies(
  parent: Container,
  cache: Map<string, Graphics>,
  list: readonly Anomaly[],
  camera: Camera | undefined
): void {
  const seen = new Set<string>();
  for (const a of list) {
    seen.add(a.id);
    let g = cache.get(a.id);
    if (!g) {
      g = new Graphics();
      parent.addChild(g);
      cache.set(a.id, g);
    }
    g.clear();
    
    if (camera && a.worldYMeters !== undefined) {
      const projected = camera.project({ x: 0, y: a.worldYMeters, z: 0 });
      g.position.set(a.x, projected.y);
    } else {
      g.position.set(a.x, a.y);
    }
    
    const pulse = 1 + Math.sin(a.pulsePhase) * 0.15;
    const glowRadius = a.size * 2 * pulse;
    // Anomaly identity by type. Each buff carries its own colour
    // hint so the player learns "this glyph means X" without text.
    const color =
      a.type === "repel"
        ? 0x8b5cf6 // violet — wards predators
        : a.type === "overdrive"
          ? 0xfde68a // amber — speed boost
          : a.type === "breath"
            ? 0x6be6c1 // mint — instant oxygen burst
            : a.type === "lure"
              ? 0xa5f3fc // pale cyan — pulls collectibles
              : 0xfbbf24; // gold — lamp-flare
    
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 3;
      g.circle(0, 0, glowRadius * t).fill({
        color,
        alpha: 0.15 * (1 - t),
      });
    }

    g.circle(0, 0, a.size * 0.5 * pulse).fill({ color, alpha: 0.9 });
    g.circle(0, 0, a.size * 0.5 * pulse).stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
  }

  for (const [id, g] of cache) {
    if (!seen.has(id)) {
      g.destroy();
      cache.delete(id);
    }
  }
}

function syncCreatures(
  parent: Container,
  cache: Map<string, Graphics>,
  list: readonly Creature[],
  camera: Camera | undefined
): void {
  const seen = new Set<string>();
  for (const c of list) {
    seen.add(c.id);
    let g = cache.get(c.id);
    if (!g) {
      g = new Graphics();
      parent.addChild(g);
      cache.set(c.id, g);
    }
    g.clear();

    if (camera && c.worldYMeters !== undefined) {
      const projected = camera.project({ x: 0, y: c.worldYMeters, z: 0 });
      g.position.set(c.x, projected.y);
    } else {
      g.position.set(c.x, c.y);
    }
    g.rotation = Math.sin(c.pulsePhase * 0.45) * 0.16;

    const glowRadius = c.size * 2.4;
    const glowColor = parseHex(c.glowColor);
    const bodyColor = parseHex(c.color);
    
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 3;
      g.circle(0, 0, glowRadius * t).fill({
        color: glowColor,
        alpha: c.glowIntensity * 0.12 * (1 - t),
      });
    }

    drawProceduralCreature(g, c, bodyColor, glowColor);
  }

  for (const [id, g] of cache) {
    if (!seen.has(id)) {
      g.destroy();
      cache.delete(id);
    }
  }
}

function syncPredators(
  parent: Container,
  cache: Map<string, Graphics>,
  list: readonly Predator[],
  totalTime: number
): void {
  const seen = new Set<string>();
  for (const p of list) {
    seen.add(p.id);
    let g = cache.get(p.id);
    if (!g) {
      g = new Graphics();
      parent.addChild(g);
      cache.set(p.id, g);
    }
    g.clear();
    g.position.set(p.x, p.y); // Still screen-space for now, chunk mapping later
    g.rotation = p.angle;

    // Marauder-sub: render as a sub silhouette (warm-red palette, grungy
    // plating). Detection by id prefix mirrors the AIManager wiring in
    // src/sim/ai/manager.ts — entity ids start with "marauder-sub-".
    if (p.id.startsWith("marauder-sub")) {
      drawEnemySub(g, p.size, totalTime, p.noiseOffset);
    } else if (p.isLeviathan) {
      const sway = Math.sin(totalTime * 1.5 + p.noiseOffset) * p.size * 0.05;
      
      // Leviathan rendering
      g.ellipse(0, sway, p.size * 0.8, p.size * 0.4).fill({ color: 0x03060a, alpha: 0.98 });
      g.ellipse(0, sway, p.size * 0.8, p.size * 0.4).stroke({ color: 0x8b5cf6, width: 2, alpha: 0.4 });
      
      // Spine
      g.moveTo(-p.size * 0.4, -p.size * 0.3 + sway);
      for(let i=0; i<5; i++) {
        g.lineTo(-p.size * 0.3 + (i * p.size * 0.15), -p.size * 0.5 + sway + (i % 2 === 0 ? p.size*0.1 : 0));
      }
      g.stroke({ color: 0x8b5cf6, width: 3, alpha: 0.6 });

      // Eyes
      g.circle(p.size * 0.6, -p.size * 0.1 + sway, p.size * 0.08).fill({ color: 0xfde68a, alpha: 1 });
      g.circle(p.size * 0.65, -p.size * 0.05 + sway, p.size * 0.05).fill({ color: 0xfde68a, alpha: 1 });
      g.circle(p.size * 0.55, -p.size * 0.15 + sway, p.size * 0.06).fill({ color: 0xfde68a, alpha: 1 });
      
      // Tendrils
      for(let i=0; i<6; i++) {
        const tSway = Math.sin(totalTime * 2 + i) * p.size * 0.15;
        g.moveTo(-p.size * 0.7, sway);
        g.bezierCurveTo(-p.size * 1.2, sway + tSway, -p.size * 1.5, sway - tSway, -p.size * 2, sway + tSway * 1.5);
        g.stroke({ color: 0x8b5cf6, width: 2 + i % 2, alpha: 0.5 });
      }

    } else {
      // Normal predator rendering. Identity-coded warm: stroke uses
      // warn-red (0xff6b6b) instead of mint so the player can never
      // confuse it with their own sub at a glance. Eye glow is a
      // slow amber pulse (was static cream) — sells the predator is
      // *watching*, not just floating.
      g.ellipse(0, 0, p.size * 0.7, p.size * 0.3).fill({
        color: 0x0c0508,
        alpha: 0.95,
      });
      g.ellipse(0, 0, p.size * 0.7, p.size * 0.3).stroke({
        color: 0xff6b6b,
        alpha: 0.36,
        width: 1.4,
      });

      // Dorsal fin
      g.moveTo(-p.size * 0.05, -p.size * 0.28);
      g.lineTo(p.size * 0.15, -p.size * 0.55);
      g.lineTo(p.size * 0.3, -p.size * 0.28);
      g.fill({ color: 0x050207, alpha: 0.98 });

      // Belly fin
      g.moveTo(p.size * 0.05, p.size * 0.22);
      g.lineTo(p.size * 0.22, p.size * 0.45);
      g.lineTo(p.size * 0.34, p.size * 0.22);
      g.fill({ color: 0x050207, alpha: 0.9 });

      // Tail
      g.moveTo(-p.size * 0.55, 0);
      g.lineTo(-p.size * 0.98, -p.size * 0.32);
      g.lineTo(-p.size * 0.78, 0);
      g.lineTo(-p.size * 0.96, p.size * 0.32);
      g.lineTo(-p.size * 0.55, 0);
      g.fill({ color: 0x050207, alpha: 0.97 });

      // Gills — faint warm-red rake near the head
      g.moveTo(p.size * 0.05, -p.size * 0.08);
      g.lineTo(p.size * 0.15, p.size * 0.05);
      g.lineTo(p.size * 0.12, -p.size * 0.12);
      g.lineTo(p.size * 0.22, 0);
      g.stroke({ color: 0xff6b6b, alpha: 0.45, width: 1 });

      // Eye — amber with a slow pulse. The pulse is a low-frequency
      // sine on totalTime so it reads as breathing/watching, not a
      // strobe. Pupil stays dark.
      const eyePulse = 0.7 + 0.3 * Math.sin(totalTime * 1.4 + p.noiseOffset);
      g.circle(p.size * 0.55, -p.size * 0.08, p.size * 0.1).fill({
        color: 0xfde68a,
        alpha: eyePulse,
      });
      g.circle(p.size * 0.58, -p.size * 0.08, p.size * 0.045).fill({
        color: 0x050207,
        alpha: 1,
      });
    }
  }
  for (const [id, g] of cache) {
    if (!seen.has(id)) {
      g.destroy();
      cache.delete(id);
    }
  }
}

function syncPirates(
  parent: Container,
  cache: Map<string, Graphics>,
  list: readonly Pirate[],
  totalTime: number
): void {
  const seen = new Set<string>();
  for (const p of list) {
    seen.add(p.id);
    let g = cache.get(p.id);
    if (!g) {
      g = new Graphics();
      parent.addChild(g);
      cache.set(p.id, g);
    }
    g.clear();
    g.position.set(p.x, p.y);
    g.rotation = p.angle;

    g.moveTo(-34, 0);
    g.bezierCurveTo(-28, -14, 20, -14, 34, 0);
    g.bezierCurveTo(28, 12, -26, 12, -34, 0);
    g.fill({ color: 0x061018, alpha: 0.95 });

    const lanternIntensity = 0.55 + Math.sin(totalTime * 2 + p.lanternPhase) * 0.25;
    g.moveTo(34, -8);
    g.lineTo(128, -42);
    g.lineTo(128, 42);
    g.lineTo(34, 8);
    g.fill({ color: 0xfde68a, alpha: 0.18 * lanternIntensity });

    g.circle(34, 0, 4).fill({ color: 0xfff3a0, alpha: lanternIntensity });
  }
  for (const [id, g] of cache) {
    if (!seen.has(id)) {
      g.destroy();
      cache.delete(id);
    }
  }
}

function parseHex(input: string): number {
  if (input.startsWith("#")) return Number.parseInt(input.slice(1), 16);
  return Number.parseInt(input, 16);
}

/**
 * Enemy submarine silhouette. Mirrors the player's articulated sub
 * shape (hull bezier + dome + lamp cone) but in adversary palette:
 * grungy iron hull, warn-red running lights, hostile cone in
 * warn-red. The lamp cone here is a "sweep" rather than a wide
 * spotlight — narrower, redder, more like a hunting beam.
 *
 * Drawn at the predator's local origin; caller positions/rotates the
 * Graphics container.
 */
function drawEnemySub(
  g: Graphics,
  size: number,
  totalTime: number,
  noiseOffset: number,
): void {
  // size from archetype is ~60. Scale internal proportions to match.
  const s = size / 28;

  // Hostile lamp cone — narrow, warn-red, sweeping wider on a slow
  // sine so the player reads "this thing is searching for me".
  const sweep = Math.sin(totalTime * 0.6 + noiseOffset) * 0.15 + 0.85;
  const coneLen = 90 * s;
  const coneSpread = 36 * s * sweep;
  g.moveTo(14 * s, 0);
  g.quadraticCurveTo(
    coneLen * 0.45,
    -coneSpread * 0.4,
    coneLen,
    -coneSpread,
  );
  g.lineTo(coneLen, coneSpread);
  g.quadraticCurveTo(
    coneLen * 0.45,
    coneSpread * 0.4,
    14 * s,
    0,
  );
  g.fill({ color: 0xff6b6b, alpha: 0.07 });
  g.moveTo(14 * s, 0);
  g.quadraticCurveTo(
    coneLen * 0.55,
    -coneSpread * 0.3,
    coneLen * 0.85,
    -coneSpread * 0.7,
  );
  g.lineTo(coneLen * 0.85, coneSpread * 0.7);
  g.quadraticCurveTo(
    coneLen * 0.55,
    coneSpread * 0.3,
    14 * s,
    0,
  );
  g.fill({ color: 0xff6b6b, alpha: 0.13 });

  // Pressure hull — same bezier silhouette as the player's sub but
  // in iron-grey + warn-red stroke.
  g.moveTo(28 * s, 0);
  g.bezierCurveTo(28 * s, -10 * s, 14 * s, -14 * s, 0, -14 * s);
  g.bezierCurveTo(-16 * s, -14 * s, -22 * s, -8 * s, -24 * s, -3 * s);
  g.lineTo(-24 * s, 3 * s);
  g.bezierCurveTo(-22 * s, 8 * s, -16 * s, 14 * s, 0, 14 * s);
  g.bezierCurveTo(14 * s, 14 * s, 28 * s, 10 * s, 28 * s, 0);
  g.fill({ color: 0x1a0608, alpha: 1 });
  g.stroke({ color: 0xff6b6b, alpha: 0.7, width: 1.5 });

  // Riveted plating — three faint warn-red lines at mid-line read
  // as paneling and reinforce the adversary palette.
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    g.moveTo(-20 * s, i * 4 * s);
    g.lineTo(20 * s, i * 4 * s);
    g.stroke({ color: 0xff6b6b, alpha: 0.18, width: 0.6 });
  }

  // Forward observation dome with an angry red eye behind it.
  g.circle(8 * s, -7 * s, 7 * s).fill({ color: 0x0a0204, alpha: 1 });
  g.circle(8 * s, -7 * s, 7 * s).stroke({
    color: 0xff6b6b,
    alpha: 0.85,
    width: 1,
  });
  // Eye pulse — lowest-frequency sine so it reads as a slow,
  // patient watch rather than a strobe.
  const eyePulse = 0.6 + 0.4 * Math.sin(totalTime * 1.2 + noiseOffset);
  g.circle(8 * s, -7 * s, 3.4 * s).fill({
    color: 0xff8a6a,
    alpha: eyePulse * 0.75,
  });

  // Stern propeller wash — three warn-red vanes spinning fast.
  const propPhase = totalTime * 6 + noiseOffset;
  for (let i = 0; i < 3; i++) {
    const a = propPhase + (i * Math.PI * 2) / 3;
    g.moveTo(-24 * s, 0);
    g.lineTo(-24 * s + Math.cos(a) * 6 * s, Math.sin(a) * 6 * s);
    g.stroke({ color: 0xff6b6b, alpha: 0.45, width: 1.5 });
  }
}
