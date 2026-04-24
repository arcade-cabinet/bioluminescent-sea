import { Container, Graphics } from "pixi.js";
import { AdvancedBloomFilter } from "pixi-filters";
import type { Player } from "@/sim/entities/types";

/**
 * Player submersible + headlamp cone.
 *
 * Two Graphics: the lamp cone (under the hull) and the hull itself
 * (over the cone). Glow intensity drives the lamp alpha breathing.
 *
 * An `AdvancedBloomFilter` is applied to the player's sub-container so
 * the lamp cone + mint strokes read as emissive — the player's position
 * has to pop out of the fluidic backdrop or the eye loses the subject.
 * Tuned conservatively so the bloom supports the silhouette rather than
 * smearing it.
 */

export interface PlayerController {
  sync(player: Player, viewportScale: number, totalTime: number): void;
  destroy(): void;
}

export function mountPlayer(parent: Container): PlayerController {
  const subContainer = new Container();
  subContainer.label = "player:sub";
  subContainer.filters = [
    new AdvancedBloomFilter({
      threshold: 0.45,
      bloomScale: 0.85,
      brightness: 1,
      blur: 4,
      quality: 4,
    }),
  ];

  const trail = new Graphics();
  const buff = new Graphics();
  const lamp = new Graphics();
  const hull = new Graphics();
  // Buff halo sits between trail and hull so the aura reads *around*
  // the sub silhouette without occluding the lamp cone.
  subContainer.addChild(trail, buff, lamp, hull);
  parent.addChild(subContainer);

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

      // Active buff tells. `activeBuffs.repelUntil` / `.overdriveUntil`
      // are absolute timestamps; the sim compares against `totalTime`.
      const repelActive = player.activeBuffs.repelUntil > totalTime;
      const overdriveActive = player.activeBuffs.overdriveUntil > totalTime;
      buff.clear();
      buff.position.set(player.x, player.y);
      if (repelActive) {
        // Two concentric rings, one breathing — reads as a projected
        // forcefield. Cyan-blue so it doesn't collide with the mint
        // of a normal glow.
        const pulse = 0.75 + Math.sin(totalTime * 4) * 0.25;
        const rInner = 38 * s;
        const rOuter = rInner + 8 * s * pulse;
        buff.circle(0, 0, rInner).stroke({
          color: 0x7dd3fc,
          alpha: 0.55,
          width: 2,
        });
        buff.circle(0, 0, rOuter).stroke({
          color: 0x7dd3fc,
          alpha: 0.3 * pulse,
          width: 1.5,
        });
      }
      if (overdriveActive) {
        // Trailing warm aura — reads as "boosted." Kept warm (amber)
        // so it reads as energy rather than another mint source.
        const wobble = 1 + Math.sin(totalTime * 6) * 0.06;
        buff.ellipse(0, 0, 36 * s * wobble, 18 * s * wobble).fill({
          color: 0xffcc6a,
          alpha: 0.18,
        });
      }

      lamp.clear();
      lamp.position.set(player.x, player.y);
      lamp.rotation = player.angle;
      // Lamp cone fans forward (+x) of the sub. Overdrive widens + brightens.
      const lampBoost = overdriveActive ? 1.35 : 1;
      const coneLen = 180 * s * player.lampScale * lampBoost;
      const coneSpread = 80 * s * player.lampScale * lampBoost;
      lamp.moveTo(16 * s, 0);
      lamp.lineTo(coneLen, -coneSpread);
      lamp.lineTo(coneLen, coneSpread);
      lamp.lineTo(16 * s, 0);
      lamp.fill({
        color: 0x6be6c1,
        alpha: (0.09 + player.glowIntensity * 0.08) * (overdriveActive ? 1.6 : 1),
      });
      lamp.moveTo(16 * s, 0);
      lamp.lineTo(coneLen * 0.7, -coneSpread * 0.5);
      lamp.lineTo(coneLen * 0.7, coneSpread * 0.5);
      lamp.lineTo(16 * s, 0);
      lamp.fill({
        color: 0xd9f2ec,
        alpha: (0.06 + player.glowIntensity * 0.1) * (overdriveActive ? 1.6 : 1),
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
      subContainer.destroy({ children: true });
    },
  };
}
