import { Container, Graphics, Rectangle } from "pixi.js";
import { AdjustmentFilter, GodrayFilter } from "pixi-filters";

/**
 * Fluidic-space layer — the cues that make a 2D dark-blue scene read
 * as *water* instead of "shapes on navy":
 *
 *   1. God-ray shafts — `GodrayFilter` from pixi-filters. Applied to a
 *      full-screen rect inside this container so the shafts paint
 *      across the whole viewport with configurable angle + density.
 *      The shafts attenuate as depth grows (surface light doesn't
 *      reach the abyss) so they fade out past the twilight shelf.
 *
 *   2. Procedural caustics — a low-alpha full-screen Graphics drawn on
 *      a curl-noise-driven pulse pattern, additively blended. Cheap
 *      stand-in for a real caustics shader: we don't need physical
 *      light simulation, we need the *read* of rippling brightness.
 *      Tinted to the biome glow so caustics carry biome identity.
 *
 *   3. Atmospheric depth tint — `AdjustmentFilter` on the whole layer
 *      lowers saturation and gamma as depth grows, matching the real
 *      behaviour of colour fading out under water.
 *
 * Everything here is pure decoration. Aria-hidden, pointer-events
 * disabled, no interaction with the sim.
 */

export interface WaterController {
  draw(args: WaterDrawArgs): void;
  resize(widthPx: number, heightPx: number): void;
  destroy(): void;
}

export interface WaterDrawArgs {
  widthPx: number;
  heightPx: number;
  totalTime: number;
  /** Cumulative descent in world meters. Drives fade + depth tint. */
  depthMeters: number;
  /** Current biome tint as a hex string, e.g. "#0c3a48". */
  biomeTintHex?: string;
}

const GODRAY_MAX_DEPTH = 600; // meters — shafts vanish past this
const CAUSTICS_FADE_START = 300;
const CAUSTICS_FADE_END = 900;

/** Cheap 2D pseudo-simplex noise for the caustics pattern. */
function smoothNoise(x: number, y: number, t: number): number {
  // Three rotated sinusoids sum to a wave-like interference pattern —
  // conceptually the same as a 3D simplex(x, y, t) slice but stays on the
  // main-thread JS path (no shader compile). Enough richness to read as
  // animated water light without feeling repetitive.
  const a = Math.sin(x * 0.015 + t * 0.7);
  const b = Math.sin(y * 0.019 - t * 0.5 + x * 0.004);
  const c = Math.sin((x + y) * 0.011 + t * 0.33);
  return (a + b + c) / 3;
}

export function mountWater(parent: Container): WaterController {
  // --- God-ray surface layer -------------------------------------------------
  const surface = new Container();
  surface.label = "water:surface";
  parent.addChild(surface);

  const surfaceRect = new Graphics();
  surface.addChild(surfaceRect);

  const godray = new GodrayFilter({
    // Slightly off-vertical so shafts feel cinematic rather than orthogonal.
    angle: 28,
    gain: 0.36,
    lacunarity: 2.75,
    parallel: true,
  });
  // filterArea needs an initial value; updated in resize().
  surface.filters = [godray];
  surface.filterArea = new Rectangle(0, 0, 1, 1);

  // --- Caustics layer --------------------------------------------------------
  // A coarse grid of bright spots. The grid resolution is fixed so the cost
  // stays O(cols × rows) per frame independently of viewport size.
  const caustics = new Graphics();
  caustics.label = "water:caustics";
  caustics.blendMode = "add";
  parent.addChild(caustics);

  // --- Depth tint -----------------------------------------------------------
  const adjustment = new AdjustmentFilter({
    saturation: 1,
    gamma: 1,
    contrast: 1,
    brightness: 1,
  });
  parent.filters = [adjustment];

  return {
    draw({ widthPx, heightPx, totalTime, depthMeters, biomeTintHex }) {
      // Update fullscreen geometry.
      surface.filterArea = new Rectangle(0, 0, widthPx, heightPx);
      // Godray attenuation: shafts ride on `time` and fade with depth.
      const depthFade = Math.max(0, 1 - depthMeters / GODRAY_MAX_DEPTH);
      surfaceRect.clear();
      // The GodrayFilter multiplies this rect's pixel values with the
      // noise pattern; the rect's alpha must fade with depth too,
      // otherwise the surface tint persists into the abyss even after
      // the rays themselves go to zero.
      surfaceRect
        .rect(0, 0, widthPx, heightPx)
        .fill({ color: 0x6be6c1, alpha: 0.055 * depthFade });

      godray.time = totalTime;
      godray.gain = 0.36 * depthFade;
      godray.lacunarity = 2.75;

      // --- Paint caustics in a coarse grid -----------------------------------
      caustics.clear();
      const causticsAlpha = causticsAlphaForDepth(depthMeters);
      if (causticsAlpha > 0) {
        const color = biomeTintHex ? parseHexColor(biomeTintHex) : 0x6be6c1;
        const cols = 22;
        const rows = 14;
        const cellW = widthPx / cols;
        const cellH = heightPx / rows;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const cx = (i + 0.5) * cellW;
            const cy = (j + 0.5) * cellH;
            const n = smoothNoise(cx, cy, totalTime);
            // Threshold the noise — only the bright peaks paint. This is
            // what gives caustics their characteristic filamentous look
            // rather than a uniform shimmer.
            if (n > 0.42) {
              const brightness = (n - 0.42) / 0.58;
              const r = Math.max(cellW, cellH) * (0.6 + brightness * 0.7);
              caustics.circle(cx, cy, r).fill({
                color,
                alpha: causticsAlpha * brightness,
              });
            }
          }
        }
      }

      // --- Depth tint: lower saturation + darken as we descend --------------
      const depthFrac = Math.min(1, depthMeters / 2400);
      adjustment.saturation = 1 - depthFrac * 0.55;
      adjustment.gamma = 1 - depthFrac * 0.2;
      adjustment.brightness = 1 - depthFrac * 0.15;
    },
    resize(widthPx, heightPx) {
      surface.filterArea = new Rectangle(0, 0, widthPx, heightPx);
    },
    destroy() {
      surface.destroy({ children: true });
      caustics.destroy();
      parent.filters = [];
    },
  };
}

function causticsAlphaForDepth(depthMeters: number): number {
  if (depthMeters <= CAUSTICS_FADE_START) return 0.18;
  if (depthMeters >= CAUSTICS_FADE_END) return 0;
  const t = 1 - (depthMeters - CAUSTICS_FADE_START) / (CAUSTICS_FADE_END - CAUSTICS_FADE_START);
  return 0.18 * t;
}

function parseHexColor(hex: string): number {
  const cleaned = hex.startsWith("#") ? hex.slice(1) : hex;
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isFinite(parsed) ? parsed : 0x6be6c1;
}
