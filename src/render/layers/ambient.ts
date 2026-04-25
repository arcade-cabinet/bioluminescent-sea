import { Container, Graphics } from "pixi.js";

/**
 * Biome-aware deep-far ambient layer.
 *
 * Sits between the backdrop ridges and the water surface, drawing
 * large biome-coupled silhouettes that scroll past at slow parallax
 * as the sub descends. This is the layer that sells "you're traveling
 * through water" — the sub's surroundings change identity as you
 * cross biome boundaries instead of just a tint shift.
 *
 * Per biome:
 *   photic-shelf  — kelp ribbons swaying in current, distant coral
 *                   outcrops glinting under the surface god-rays
 *   twilight-shelf — distant jellyfish swarms (cluster of glowing
 *                   bells), drifting whale-fall silhouette near floor
 *   midnight-column — anglerfish lures pulsing in the deep dark,
 *                   tentacle silhouettes hinting at things larger
 *                   than the sub
 *   abyssal-trench — volcanic vent glow, hydrothermal column shimmer,
 *                   rocky outcrop silhouettes, sunken ship hull
 *
 * Everything is authored as Graphics (no textures) so it renders at
 * native canvas resolution and ships in the same bundle. Procedural
 * placement is seeded by the dive seed so each trench has its own
 * ambient layout — every dive feels different.
 */

import { biomeAtDepth } from "@/sim/factories/region/biomes";

export interface AmbientController {
  draw(args: AmbientDrawArgs): void;
  destroy(): void;
}

export interface AmbientDrawArgs {
  widthPx: number;
  heightPx: number;
  totalTime: number;
  /** Cumulative descent in world-meters — drives parallax + biome lookup. */
  depthMeters: number;
  /**
   * Dive seed. Used to deterministically place ambient elements per
   * dive — same seed → same kelp positions, same anglerfish lures,
   * same shipwreck location. Different seeds → different ambient
   * compositions across the same trench.
   */
  diveSeed: number;
}

const PARALLAX_FACTOR = 0.04; // very slow — far things barely move

export function mountAmbient(parent: Container): AmbientController {
  const g = new Graphics();
  parent.addChild(g);

  return {
    draw({ widthPx, heightPx, totalTime, depthMeters, diveSeed }) {
      g.clear();
      const biome = biomeAtDepth(depthMeters);
      const shift = depthMeters * PARALLAX_FACTOR;
      // Repeat across descent so we don't run out of ambient — wrap
      // every viewport-height in world space.
      const wrappedY = ((shift % heightPx) + heightPx) % heightPx;

      switch (biome.id) {
        case "photic-gate":
          drawKelpRibbons(g, widthPx, heightPx, totalTime, wrappedY, diveSeed);
          break;
        case "twilight-shelf":
          drawJellyfishSwarm(g, widthPx, heightPx, totalTime, wrappedY, diveSeed);
          break;
        case "midnight-column":
          drawAnglerfishLures(g, widthPx, heightPx, totalTime, wrappedY, diveSeed);
          break;
        case "abyssal-trench":
        case "stygian-abyss":
          drawAbyssalLandmarks(g, widthPx, heightPx, totalTime, wrappedY, diveSeed);
          break;
      }
    },
    destroy() {
      g.destroy();
    },
  };
}

/**
 * Tiny LCG so we don't import the sim's RNG into the renderer.
 * Deterministic per (seed, index).
 */
function noise(seed: number, index: number): number {
  let h = (seed ^ index) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

// ── Photic shelf — kelp ribbons swaying ────────────────────────────────────
function drawKelpRibbons(
  g: Graphics,
  widthPx: number,
  heightPx: number,
  totalTime: number,
  parallaxY: number,
  diveSeed: number,
): void {
  const ribbonCount = 8;
  for (let i = 0; i < ribbonCount; i++) {
    const x = noise(diveSeed, i * 7) * widthPx;
    const baseY = heightPx + parallaxY * 0.6;
    const heightVar = 0.5 + noise(diveSeed, i * 11) * 0.4;
    const sway = Math.sin(totalTime * 0.5 + i) * 8;
    const segments = 14;
    g.moveTo(x, baseY);
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const wobble = Math.sin(totalTime * 0.7 + i + t * 4) * 6 * t;
      g.lineTo(
        x + wobble + sway * t,
        baseY - heightPx * heightVar * t,
      );
    }
    g.stroke({ color: 0x1f4d3f, alpha: 0.32, width: 5 });
  }
}

// ── Twilight shelf — distant jellyfish swarms ──────────────────────────────
function drawJellyfishSwarm(
  g: Graphics,
  widthPx: number,
  heightPx: number,
  totalTime: number,
  parallaxY: number,
  diveSeed: number,
): void {
  const swarmCount = 18;
  for (let i = 0; i < swarmCount; i++) {
    const x = noise(diveSeed, i * 13) * widthPx;
    const y =
      ((noise(diveSeed, i * 17) * heightPx + parallaxY) % heightPx + heightPx) %
      heightPx;
    const size = 6 + noise(diveSeed, i * 19) * 10;
    const pulse = 0.4 + Math.sin(totalTime * 0.8 + i) * 0.25;
    g.ellipse(x, y, size, size * 0.7).fill({
      color: 0x7da3c0,
      alpha: pulse * 0.35,
    });
    // Trailing tentacles
    for (let t = 0; t < 3; t++) {
      const ty = y + size * 0.7 + t * 4;
      g.moveTo(x - size * 0.3 + t * size * 0.3, y + size * 0.7);
      g.lineTo(x - size * 0.4 + t * size * 0.3, ty + Math.sin(totalTime + t) * 2);
      g.stroke({ color: 0x9bc4dd, alpha: pulse * 0.25, width: 1 });
    }
  }
}

// ── Midnight column — anglerfish lures + tentacle silhouettes ──────────────
function drawAnglerfishLures(
  g: Graphics,
  widthPx: number,
  heightPx: number,
  totalTime: number,
  parallaxY: number,
  diveSeed: number,
): void {
  const lureCount = 6;
  for (let i = 0; i < lureCount; i++) {
    const x = noise(diveSeed, i * 23) * widthPx;
    const y =
      ((noise(diveSeed, i * 29) * heightPx + parallaxY) % heightPx + heightPx) %
      heightPx;
    // The lure pulses on a slow heartbeat. Two layers — bright core +
    // diffuse halo so it reads as glow even under the depth tint.
    const beat = 0.5 + Math.sin(totalTime * 1.4 + i * 0.7) * 0.5;
    g.circle(x, y, 14 + beat * 4).fill({
      color: 0xffe8a3,
      alpha: 0.05 + beat * 0.08,
    });
    g.circle(x, y, 4 + beat * 2).fill({
      color: 0xfff5d0,
      alpha: 0.15 + beat * 0.35,
    });
    // Hint of the body trailing back into shadow
    g.moveTo(x, y);
    g.lineTo(x - 26, y + 8);
    g.stroke({ color: 0x1a1216, alpha: 0.5, width: 18 });
  }
  // One distant tentacle silhouette per dive — placed by seed
  const tentacleX = noise(diveSeed, 9999) * widthPx;
  const tentacleY = heightPx * 0.7 + parallaxY * 0.3;
  for (let arm = 0; arm < 4; arm++) {
    g.moveTo(tentacleX, tentacleY);
    const armLen = 80 + arm * 12;
    const armWobble = Math.sin(totalTime * 0.4 + arm) * 14;
    g.bezierCurveTo(
      tentacleX + armWobble - 20,
      tentacleY + armLen * 0.3,
      tentacleX + armWobble + 20,
      tentacleY + armLen * 0.6,
      tentacleX + armWobble,
      tentacleY + armLen,
    );
    g.stroke({ color: 0x080a0e, alpha: 0.5, width: 7 - arm });
  }
}

// ── Abyssal trench — volcanic vents + rocky outcrops + shipwreck ────────────
function drawAbyssalLandmarks(
  g: Graphics,
  widthPx: number,
  heightPx: number,
  totalTime: number,
  parallaxY: number,
  diveSeed: number,
): void {
  // Volcanic vent — pulsing red-hot column rising from the floor
  const ventCount = 3;
  for (let i = 0; i < ventCount; i++) {
    const x = noise(diveSeed, i * 31) * widthPx;
    const baseY = heightPx + parallaxY * 0.4;
    const ventHeight = 60 + noise(diveSeed, i * 37) * 80;
    const flicker = 0.6 + Math.sin(totalTime * 3 + i * 2) * 0.4;
    // Wide diffuse glow
    g.ellipse(x, baseY - ventHeight * 0.3, 28, ventHeight * 0.7).fill({
      color: 0xff5a3c,
      alpha: 0.06 * flicker,
    });
    // Bright core
    g.ellipse(x, baseY - ventHeight * 0.4, 8, ventHeight * 0.5).fill({
      color: 0xffaa66,
      alpha: 0.18 * flicker,
    });
    // Rocky base outcrop
    g.moveTo(x - 20, baseY);
    g.lineTo(x - 14, baseY - 16);
    g.lineTo(x - 6, baseY - 8);
    g.lineTo(x + 4, baseY - 18);
    g.lineTo(x + 16, baseY - 6);
    g.lineTo(x + 22, baseY);
    g.fill({ color: 0x080a0e, alpha: 0.85 });
  }
  // Shipwreck — one per dive, placed by seed deterministically
  const wreckX = noise(diveSeed, 1234) * widthPx;
  const wreckY = heightPx * 0.85 + parallaxY * 0.5;
  // Hull
  g.moveTo(wreckX - 60, wreckY);
  g.lineTo(wreckX - 50, wreckY - 14);
  g.lineTo(wreckX + 50, wreckY - 10);
  g.lineTo(wreckX + 60, wreckY);
  g.fill({ color: 0x0a0e14, alpha: 0.7 });
  // Mast
  g.moveTo(wreckX - 14, wreckY - 12);
  g.lineTo(wreckX - 18, wreckY - 38);
  g.stroke({ color: 0x0a0e14, alpha: 0.6, width: 2 });
  g.moveTo(wreckX + 12, wreckY - 11);
  g.lineTo(wreckX + 16, wreckY - 32);
  g.stroke({ color: 0x0a0e14, alpha: 0.6, width: 2 });
}
