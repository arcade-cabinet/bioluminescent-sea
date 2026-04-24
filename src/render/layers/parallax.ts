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
  const g = new Graphics();
  parent.addChild(g);

  return {
    draw({ particles, heightPx, depthMeters = 0, pxPerMeter = 1 }) {
      g.clear();
      // depthMeters is world-space; multiply by pxPerMeter so the
      // parallax shift lives in the same coordinate system as p.y.
      const shift = depthMeters * pxPerMeter * DEPTH_SCROLL_FACTOR;
      const h = Math.max(heightPx, 1);
      for (const p of particles) {
        // Wrap in [0, h) so particles keep filling the column as
        // the sub descends instead of draining off the top.
        const y = ((p.y - shift) % h + h) % h;
        g.circle(p.x, y, p.size).fill({
          color: 0xd9f2ec,
          alpha: p.opacity,
        });
      }
    },
    destroy() {
      g.destroy();
    },
  };
}
