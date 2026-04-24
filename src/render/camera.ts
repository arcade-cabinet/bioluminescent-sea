import type { Vec3 } from "@/sim/world";

/**
 * World → screen projection.
 *
 * The world is authored in meters; the renderer draws in pixels.
 * The camera owns:
 *   - `scrollMeters` — the world-y depth the viewport center is
 *     looking at (0 = surface).
 *   - `pxPerMeter`   — zoom. Typically 0.8–1.2 depending on viewport.
 *   - `viewport`     — the screen extents the camera projects onto.
 *
 * `z ∈ [0, 1]` is a parallax-layer hint, not true perspective. Near
 * entities (z ≈ 0) follow the world scale 1:1; far entities (z ≈ 1)
 * project at a fraction of world motion so they feel distant.
 *
 * PR C consumers keep `scrollMeters = 0` and project the existing
 * viewport-space simulation straight through; PR F flips scroll on
 * when chunked depth lands.
 */

export interface CameraViewport {
  widthPx: number;
  heightPx: number;
}

export interface Camera {
  viewport: CameraViewport;
  scrollMeters: number;
  /**
   * Lateral scroll in pixels. The sim lives on a wider-than-viewport
   * play band (see `sim/_shared/playBand`); this value is the world-x
   * of the viewport's left edge. Renderers subtract it from entity x
   * before drawing so moving laterally reveals content that was off
   * the viewport a moment ago.
   */
  scrollXPx: number;
  pxPerMeter: number;
  setViewport(w: number, h: number): void;
  setScrollMeters(m: number): void;
  setScrollXPx(px: number): void;
  project(world: Vec3): { x: number; y: number; scale: number };
}

export function createCamera(initial: CameraViewport): Camera {
  const state = {
    viewport: { ...initial },
    scrollMeters: 0,
    scrollXPx: 0,
    pxPerMeter: 1,
  };

  const nearFarScaleX = (z: number) => lerp(1, 0.35, clamp01(z));
  const nearFarScaleY = (z: number) => lerp(1, 0.45, clamp01(z));

  return {
    get viewport() {
      return state.viewport;
    },
    get scrollMeters() {
      return state.scrollMeters;
    },
    get scrollXPx() {
      return state.scrollXPx;
    },
    get pxPerMeter() {
      return state.pxPerMeter;
    },
    setViewport(w, h) {
      state.viewport = { widthPx: w, heightPx: h };
    },
    setScrollMeters(m) {
      state.scrollMeters = m;
    },
    setScrollXPx(px) {
      state.scrollXPx = px;
    },
    project(world) {
      const cx = state.viewport.widthPx * 0.5;
      const cy = state.viewport.heightPx * 0.5;
      const sx = state.pxPerMeter * nearFarScaleX(world.z);
      const sy = state.pxPerMeter * nearFarScaleY(world.z);
      return {
        x: cx + world.x * sx,
        y: cy + (world.y - state.scrollMeters) * sy,
        scale: lerp(1, 0.6, clamp01(world.z)),
      };
    },
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
