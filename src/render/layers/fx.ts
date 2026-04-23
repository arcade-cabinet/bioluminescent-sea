import { Container, Graphics } from "pixi.js";
import type { Player } from "@/sim/entities/types";

/**
 * FX layer — sonar ping + collection bursts + impact flashes.
 *
 * All ephemeral. The bridge passes a list of active bursts each frame;
 * the sonar ring is a continuous phase.
 */

export interface CollectionBurstView {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  startedAt: number;
}

export interface FxController {
  sync(args: {
    player: Player;
    totalTime: number;
    bursts: readonly CollectionBurstView[];
    threatFlashAlpha: number;
    viewport: { widthPx: number; heightPx: number };
  }): void;
  destroy(): void;
}

export function mountFx(parent: Container): FxController {
  const sonar = new Graphics();
  const bursts = new Graphics();
  const threatFlash = new Graphics();
  parent.addChild(sonar, bursts, threatFlash);

  return {
    sync({ player, totalTime, bursts: list, threatFlashAlpha, viewport }) {
      sonar.clear();
      const phase = (totalTime * 0.75) % 1;
      const radius = 40 + phase * 220;
      sonar.circle(player.x, player.y, radius).stroke({
        color: 0x6be6c1,
        alpha: 0.4 * (1 - phase),
        width: 1.6,
      });

      bursts.clear();
      for (const b of list) {
        const age = totalTime - b.startedAt;
        if (age < 0 || age > 0.85) continue;
        const progress = age / 0.85;
        const alpha = 1 - progress;
        const color = parseHex(b.color);

        bursts.circle(b.x, b.y, b.size * (0.9 + progress * 2.1)).stroke({
          color,
          alpha: alpha * 0.82,
          width: Math.max(1.4, b.size * 0.08),
        });
        for (let i = 0; i < 8; i++) {
          const angle = i * (Math.PI / 4) + progress * 0.8;
          const inner = b.size * (0.55 + progress * 1.2);
          const outer = b.size * (1.15 + progress * 2.8);
          bursts.moveTo(b.x + Math.cos(angle) * inner, b.y + Math.sin(angle) * inner);
          bursts.lineTo(b.x + Math.cos(angle) * outer, b.y + Math.sin(angle) * outer);
          bursts.stroke({ color: 0xfef9c3, alpha: alpha * 0.74, width: 1.3 });
        }
      }

      threatFlash.clear();
      if (threatFlashAlpha > 0) {
        threatFlash.rect(0, 0, viewport.widthPx, viewport.heightPx).fill({
          color: 0xff6b6b,
          alpha: Math.min(0.28, threatFlashAlpha * 0.28),
        });
      }
    },
    destroy() {
      sonar.destroy();
      bursts.destroy();
      threatFlash.destroy();
    },
  };
}

function parseHex(input: string): number {
  if (input.startsWith("#")) return Number.parseInt(input.slice(1), 16);
  return Number.parseInt(input, 16);
}
