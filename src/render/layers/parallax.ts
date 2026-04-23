import { Container, Graphics } from "pixi.js";
import type { Particle } from "@/sim/entities/types";

/**
 * Parallax layer — marine snow particles.
 *
 * One Graphics object, redrawn each frame. At 130 particles this is
 * cheaper and simpler than 130 persistent Sprites; the cost of the
 * redraw is dominated by fill setup, not triangle count.
 */

export interface ParallaxController {
  draw(particles: readonly Particle[]): void;
  destroy(): void;
}

export function mountParallax(parent: Container): ParallaxController {
  const g = new Graphics();
  parent.addChild(g);

  return {
    draw(particles) {
      g.clear();
      for (const p of particles) {
        g.circle(p.x, p.y, p.size).fill({
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
