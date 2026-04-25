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
        const color = parseHex(b.color);

        // Soft glow disc — dies fastest, establishes the "flash" read.
        const discRadius = b.size * (0.7 + progress * 1.6);
        const discAlpha = Math.max(0, (1 - progress * 2.2)) * 0.55;
        if (discAlpha > 0) {
          bursts.circle(b.x, b.y, discRadius).fill({ color, alpha: discAlpha });
        }

        // Leading ring — the actual shockwave front. Expands fast, fades
        // with the cube of progress so the edge feels crisp rather than
        // lingering like a ghost.
        const leadRadius = b.size * (0.9 + progress * 2.6);
        const leadAlpha = Math.pow(1 - progress, 2) * 0.9;
        bursts.circle(b.x, b.y, leadRadius).stroke({
          color,
          alpha: leadAlpha,
          width: Math.max(1.5, b.size * 0.11 * (1 - progress)),
        });

        // Inner echo — trails behind the front at ~75% radius, creamy
        // white so the ring reads as "light" rather than just "outline."
        if (progress > 0.08) {
          const echoRadius = leadRadius * 0.72;
          const echoAlpha = Math.pow(1 - progress, 3) * 0.7;
          bursts.circle(b.x, b.y, echoRadius).stroke({
            color: 0xfef9c3,
            alpha: echoAlpha,
            width: Math.max(1, b.size * 0.05 * (1 - progress)),
          });
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
