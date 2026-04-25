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
    lampScatterPoints: readonly { x: number; y: number }[];
  }): void;
  destroy(): void;
}

export function mountFx(parent: Container): FxController {
  const sonar = new Graphics();
  const bursts = new Graphics();
  const lampScatter = new Graphics();
  const threatFlash = new Graphics();
  parent.addChild(sonar, bursts, lampScatter, threatFlash);

  return {
    sync({ player, totalTime, bursts: list, threatFlashAlpha, viewport, lampScatterPoints }) {
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

      // Lamp scatter — small amber sparks emitted at every predator
      // currently inside the lamp cone. Drawn each frame; the renderer
      // doesn't carry per-spark history, so the scatter is procedural:
      // 6 sparks per impact point, positioned + scaled by a noise
      // function seeded from totalTime so the cluster shimmers across
      // frames. Sells "the lamp is hurting them" continuously while
      // the cone holds steady, even when damage is on cooldown.
      lampScatter.clear();
      for (const pt of lampScatterPoints) {
        const sparkCount = 6;
        for (let i = 0; i < sparkCount; i++) {
          const phase = i + totalTime * 8 + pt.x * 0.01 + pt.y * 0.01;
          const angle = (i / sparkCount) * Math.PI * 2 + Math.sin(phase) * 0.4;
          const radius = 6 + Math.abs(Math.sin(phase * 1.7)) * 18;
          const sx = pt.x + Math.cos(angle) * radius;
          const sy = pt.y + Math.sin(angle) * radius;
          const r = 1.2 + Math.abs(Math.sin(phase * 2.3)) * 1.4;
          // Amber → cream gradient by spark phase so the cluster has
          // colour variance, not a flat dot field.
          const colour = i % 2 === 0 ? 0xfde68a : 0xfff3a0;
          lampScatter.circle(sx, sy, r).fill({ color: colour, alpha: 0.85 });
        }
        // Soft amber glow under the cluster — anchors the spark
        // shimmer so it reads as a hot spot rather than floating dots.
        lampScatter.circle(pt.x, pt.y, 22).fill({
          color: 0xfde68a,
          alpha: 0.18,
        });
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
      lampScatter.destroy();
      threatFlash.destroy();
    },
  };
}

function parseHex(input: string): number {
  if (input.startsWith("#")) return Number.parseInt(input.slice(1), 16);
  return Number.parseInt(input, 16);
}
