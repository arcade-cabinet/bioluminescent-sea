import { Container, Graphics } from "pixi.js";

/**
 * Backdrop layer — abyss gradient + layered ridge silhouettes.
 *
 * This is a persistent Graphics object. `draw()` redraws into the
 * same object every frame (cheap in pixi; no allocations), tracking
 * the viewport size and a slow time modulation for the fog-of-war
 * shimmer. Creates a distinctive fogged gradient that reads as
 * "underwater" and not "flat navy."
 */

export interface BackdropController {
  draw(widthPx: number, heightPx: number, totalTime: number, biomeTintHex?: string): void;
  destroy(): void;
}

const GRADIENT_STEPS = 8;

interface Stop {
  at: number;
  colorHex: number;
  alpha: number;
}

const STOPS: readonly Stop[] = [
  { at: 0, colorHex: 0x0a1a2e, alpha: 1 },
  { at: 0.35, colorHex: 0x0e4f55, alpha: 1 },
  { at: 0.62, colorHex: 0x082633, alpha: 1 },
  { at: 0.82, colorHex: 0x050a14, alpha: 1 },
  { at: 1, colorHex: 0x030608, alpha: 1 },
];

export function mountBackdrop(parent: Container): BackdropController {
  const gradient = new Graphics();
  const biomeTint = new Graphics();
  const ridges = new Graphics();
  parent.addChild(gradient, biomeTint, ridges);

  const draw = (
    widthPx: number,
    heightPx: number,
    totalTime: number,
    biomeTintHex?: string
  ) => {
    gradient.clear();
    // Build a vertical band gradient by stacking GRADIENT_STEPS rects
    // and interpolating colors. pixi v8 has no native gradient fill.
    for (let i = 0; i < GRADIENT_STEPS; i++) {
      const t = i / GRADIENT_STEPS;
      const tNext = (i + 1) / GRADIENT_STEPS;
      const color = sampleGradient(t);
      gradient.rect(0, t * heightPx, widthPx, (tNext - t) * heightPx + 1).fill({
        color,
        alpha: 1,
      });
    }

    biomeTint.clear();
    if (biomeTintHex) {
      const hex = biomeTintHex.startsWith("#") ? biomeTintHex.slice(1) : biomeTintHex;
      const color = Number.parseInt(hex, 16);
      // 10% overlay — strong enough to read as a shift, weak enough to
      // keep the identity palette intact. A full viewport rect with
      // low alpha is cheaper than modulating every gradient stop.
      biomeTint.rect(0, 0, widthPx, heightPx).fill({ color, alpha: 0.1 });
    }

    ridges.clear();
    drawRidge(ridges, widthPx, heightPx, totalTime, 0.55, 0x081826, 0.35);
    drawRidge(ridges, widthPx, heightPx, totalTime * 0.7 + 120, 0.72, 0x061018, 0.55);
    drawRidge(ridges, widthPx, heightPx, totalTime * 0.5 + 260, 0.92, 0x03080f, 0.85);
  };

  return {
    draw,
    destroy() {
      gradient.destroy();
      biomeTint.destroy();
      ridges.destroy();
    },
  };
}

function sampleGradient(t: number): number {
  for (let i = 1; i < STOPS.length; i++) {
    const a = STOPS[i - 1];
    const b = STOPS[i];
    if (t <= b.at) {
      const local = (t - a.at) / (b.at - a.at || 1);
      return lerpColor(a.colorHex, b.colorHex, local);
    }
  }
  return STOPS[STOPS.length - 1].colorHex;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function drawRidge(
  g: Graphics,
  widthPx: number,
  heightPx: number,
  phase: number,
  bandCenter: number,
  colorHex: number,
  alpha: number
): void {
  const segments = 28;
  const centerY = heightPx * bandCenter;
  const amplitude = heightPx * 0.06;

  g.moveTo(0, heightPx);
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * widthPx;
    const y =
      centerY +
      Math.sin(i * 0.93 + phase * 0.01) * amplitude * 0.55 +
      Math.cos(i * 0.47 + phase * 0.012) * amplitude * 0.4;
    g.lineTo(x, y);
  }
  g.lineTo(widthPx, heightPx);
  g.lineTo(0, heightPx);
  g.fill({ color: colorHex, alpha });
}
