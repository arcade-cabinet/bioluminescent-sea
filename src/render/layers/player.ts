import { Container, Graphics } from "pixi.js";
import type { Player } from "@/sim/entities/types";

/**
 * Player submersible + headlamp cone.
 *
 * Two Graphics: the lamp cone (under the hull) and the hull itself
 * (over the cone). Glow intensity drives the lamp alpha breathing.
 */

export interface PlayerController {
  sync(player: Player, viewportScale: number, totalTime: number): void;
  destroy(): void;
}

export function mountPlayer(parent: Container): PlayerController {
  const trail = new Graphics();
  const lamp = new Graphics();
  const hull = new Graphics();
  parent.addChild(trail, lamp, hull);

  const trailPositions: { x: number; y: number; time: number }[] = [];

  return {
    sync(player, viewportScale, totalTime) {
      const s = Math.max(0.75, viewportScale);

      // Record trail
      trailPositions.unshift({ x: player.x, y: player.y, time: totalTime });
      if (trailPositions.length > 25) trailPositions.pop();

      trail.clear();
      if (trailPositions.length > 1) {
        trail.moveTo(trailPositions[0].x, trailPositions[0].y);
        for (let i = 1; i < trailPositions.length; i++) {
          const pt = trailPositions[i];
          const age = totalTime - pt.time;
          const alpha = Math.max(0, 1 - age * 1.5);
          if (alpha > 0) {
             trail.lineTo(pt.x, pt.y);
             trail.stroke({ color: 0x6be6c1, alpha: alpha * 0.4, width: 4 * s });
             trail.moveTo(pt.x, pt.y);
          }
        }
      }

      lamp.clear();
      lamp.position.set(player.x, player.y);
      lamp.rotation = player.angle;
      // Lamp cone fans forward (+x) of the sub.
      const coneLen = 180 * s * player.lampScale;
      const coneSpread = 80 * s * player.lampScale;
      lamp.moveTo(16 * s, 0);
      lamp.lineTo(coneLen, -coneSpread);
      lamp.lineTo(coneLen, coneSpread);
      lamp.lineTo(16 * s, 0);
      lamp.fill({
        color: 0x6be6c1,
        alpha: 0.09 + player.glowIntensity * 0.08,
      });
      lamp.moveTo(16 * s, 0);
      lamp.lineTo(coneLen * 0.7, -coneSpread * 0.5);
      lamp.lineTo(coneLen * 0.7, coneSpread * 0.5);
      lamp.lineTo(16 * s, 0);
      lamp.fill({
        color: 0xd9f2ec,
        alpha: 0.06 + player.glowIntensity * 0.1,
      });

      hull.clear();
      hull.position.set(player.x, player.y);
      hull.rotation = player.angle;

      // Main hull
      hull.ellipse(0, 0, 28 * s, 14 * s).fill({
        color: 0x0e4f55,
        alpha: 1,
      });
      hull.ellipse(0, 0, 28 * s, 14 * s).stroke({
        color: 0x6be6c1,
        alpha: 0.9,
        width: 1.5,
      });
      // Dome
      hull.circle(6 * s, -6 * s, 7 * s).fill({ color: 0x102b34, alpha: 1 });
      hull.circle(6 * s, -6 * s, 7 * s).stroke({
        color: 0x6be6c1,
        alpha: 0.85,
        width: 1,
      });
      hull.circle(6 * s, -6 * s, 3 * s).fill({
        color: 0xfffbea,
        alpha: 0.75 + Math.sin(totalTime * 3) * 0.15,
      });
      // Rear fin
      hull.moveTo(-22 * s, -6 * s);
      hull.lineTo(-34 * s, -14 * s);
      hull.lineTo(-28 * s, 0);
      hull.lineTo(-34 * s, 14 * s);
      hull.lineTo(-22 * s, 6 * s);
      hull.fill({ color: 0x0a3740, alpha: 1 });
    },
    destroy() {
      lamp.destroy();
      hull.destroy();
    },
  };
}
