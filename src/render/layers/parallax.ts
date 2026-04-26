import { Container, Graphics } from "pixi.js";
import type { Particle } from "@/sim/entities/types";

/**
 * Parallax layer — marine snow particles.
 *
 * One Graphics object, redrawn each frame. At 130 particles this is
 * cheaper and simpler than 130 persistent Sprites; the cost of the
 * redraw is dominated by fill setup, not triangle count.
 *
 * Particles ship from the sim in viewport-space (y ∈ [0, heightPx]).
 * The layer adds a descent-driven vertical offset so the whole field
 * appears to scroll upward past the viewport as the sub descends —
 * another parallax cue stacked on top of the backdrop ridges. Each
 * particle wraps modulo `heightPx` so we never run out of snow.
 */

export interface ParallaxController {
  draw(args: ParallaxDrawArgs): void;
  destroy(): void;
}

export interface ParallaxDrawArgs {
  particles: readonly Particle[];
  heightPx: number;
  /**
   * Viewport width in pixels. Used to span the depth-marker lines.
   * Defaults to 0 (no markers drawn) for backwards compatibility.
   */
  widthPx?: number;
  /**
   * Cumulative descent in world-meters. Drives the vertical scroll
   * offset. Optional — omit or pass 0 for the pre-F.4 behavior.
   */
  depthMeters?: number;
  /**
   * World→screen scale from the camera. Required whenever
   * `depthMeters` is non-zero so the shift is computed in pixel
   * space consistently with the rest of the render pipeline.
   * Defaults to 1 to preserve behavior when depthMeters is 0.
   */
  pxPerMeter?: number;
}

const DEPTH_SCROLL_FACTOR = 0.35;

export function mountParallax(parent: Container): ParallaxController {
  const gBackground = new Graphics();
  const gDepthMarkers = new Graphics();
  const gMidground = new Graphics();
  const gForeground = new Graphics();

  parent.addChild(gBackground, gDepthMarkers, gMidground, gForeground);

  return {
    draw({ particles, heightPx, widthPx = 0, depthMeters = 0, pxPerMeter = 1 }) {
      gBackground.clear();
      gDepthMarkers.clear();
      gMidground.clear();
      gForeground.clear();

      const shift = depthMeters * pxPerMeter * DEPTH_SCROLL_FACTOR;
      const h = Math.max(heightPx, 1);

      // Depth-tick lines: every 50 m of descent, a thin horizontal
      // band passes upward through the viewport. Sits between
      // background and midground particles so it reads as
      // world-fixed strata. Bands at multiples of 100 m get a
      // brighter mint accent on the left to differentiate
      // hectometer milestones.
      if (widthPx > 0 && pxPerMeter > 0) {
        const interval = 50;
        const w = widthPx;
        const stepPx = interval * pxPerMeter * DEPTH_SCROLL_FACTOR;
        if (stepPx > 8) {
          const firstDepth = Math.floor(depthMeters / interval) * interval;
          for (let i = 0; i < 8; i++) {
            const yWorld = firstDepth + i * interval;
            const yScreen = (yWorld - depthMeters) * pxPerMeter * DEPTH_SCROLL_FACTOR + h * 0.5;
            if (yScreen > h + 4) break;
            if (yScreen < -4) continue;
            const isHectometer = yWorld % 100 === 0;
            gDepthMarkers.moveTo(0, yScreen);
            gDepthMarkers.lineTo(w, yScreen);
            gDepthMarkers.stroke({
              color: isHectometer ? 0x6be6c1 : 0x0e4f55,
              alpha: isHectometer ? 0.18 : 0.1,
              width: 1,
            });
            if (isHectometer) {
              gDepthMarkers.moveTo(w * 0.04, yScreen);
              gDepthMarkers.lineTo(w * 0.06, yScreen - 4);
              gDepthMarkers.lineTo(w * 0.08, yScreen);
              gDepthMarkers.stroke({ color: 0x6be6c1, alpha: 0.32, width: 1.2 });
            }
          }
        }
      }

      for (const p of particles) {
        // Adjust the shift based on zDepth
        // zDepth > 0 (background) shifts slower.
        // zDepth < 0 (foreground) shifts faster.
        const layerShift = shift / (1 + p.zDepth);
        const y = ((p.y - layerShift) % h + h) % h;
        
        let targetG = gMidground;
        if (p.zDepth > 0) targetG = gBackground;
        if (p.zDepth < 0) targetG = gForeground;

        targetG.circle(p.x, y, p.size).fill({
          color: p.zDepth < 0 ? 0xffffff : 0xd9f2ec,
          alpha: p.opacity,
        });
      }
    },
    destroy() {
      gBackground.destroy();
      gDepthMarkers.destroy();
      gMidground.destroy();
      gForeground.destroy();
    },
  };
}
