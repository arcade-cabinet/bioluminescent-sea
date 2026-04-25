import { Container, Graphics } from "pixi.js";
import { AdvancedBloomFilter } from "pixi-filters";
import type { Player } from "@/sim/entities/types";

/**
 * Player submersible + headlamp cone.
 *
 * Four Graphics: trail, buff halo, lamp cone, hull silhouette. Glow
 * intensity drives the lamp alpha breathing. An `AdvancedBloomFilter`
 * on the sub container layers a soft halo over the mint strokes so
 * the player's position reads as emissive against the fluidic
 * backdrop. The bloom is on the `fx` layer (mounted by bridge.ts),
 * which is NOT a refraction target — the previous bug where the sub
 * vanished came from stacking bloom inside `near`'s
 * DisplacementFilter, plus the upstream pixi#11467 filter-resolution
 * issue. Both are addressed: player is on fx, and the FilterSystem
 * resolution patch (src/render/filterResolutionPatch.ts) ensures the
 * bloom texture matches the renderer's DPR.
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
      // Base scale floor bumped from 0.75 to 1.4 — at 1280px the sub
      // was rendering at ~28px wide and the riveted plating + dome
      // glint + propeller wash were invisible. Larger silhouette
      // gives detail room to read.
      const s = Math.max(1.4, viewportScale);

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
      // Volumetric look: paint concentric cones from outer→inner with
      // additive-feeling alpha layering so the centre reads bright
      // and the edges fade into water rather than terminating in a
      // hard polygon. A small lamp-glow disc sits at the housing.
      const lampBoost = overdriveActive ? 1.35 : 1;
      const coneLen = 180 * s * player.lampScale * lampBoost;
      const coneSpread = 80 * s * player.lampScale * lampBoost;
      const baseAlpha = (overdriveActive ? 1.6 : 1) * (0.6 + player.glowIntensity * 0.4);

      // Outer halo — widest, dimmest, fades fastest with distance.
      const haloLen = coneLen * 1.05;
      const haloSpread = coneSpread * 1.15;
      lamp.moveTo(14 * s, 0);
      lamp.quadraticCurveTo(haloLen * 0.5, -haloSpread * 0.55, haloLen, -haloSpread);
      lamp.lineTo(haloLen, haloSpread);
      lamp.quadraticCurveTo(haloLen * 0.5, haloSpread * 0.55, 14 * s, 0);
      lamp.fill({ color: 0x6be6c1, alpha: 0.05 * baseAlpha });

      // Mid cone — primary mint volume.
      lamp.moveTo(15 * s, 0);
      lamp.quadraticCurveTo(coneLen * 0.5, -coneSpread * 0.55, coneLen, -coneSpread);
      lamp.lineTo(coneLen, coneSpread);
      lamp.quadraticCurveTo(coneLen * 0.5, coneSpread * 0.55, 15 * s, 0);
      lamp.fill({ color: 0x6be6c1, alpha: 0.09 * baseAlpha });

      // Inner cone — narrower, brighter, the perceived beam.
      const innerLen = coneLen * 0.78;
      const innerSpread = coneSpread * 0.55;
      lamp.moveTo(16 * s, 0);
      lamp.quadraticCurveTo(innerLen * 0.5, -innerSpread * 0.45, innerLen, -innerSpread);
      lamp.lineTo(innerLen, innerSpread);
      lamp.quadraticCurveTo(innerLen * 0.5, innerSpread * 0.45, 16 * s, 0);
      lamp.fill({ color: 0xd9f2ec, alpha: 0.13 * baseAlpha });

      // Hot core — a tight, bright stripe near the lamp housing.
      const coreLen = coneLen * 0.5;
      const coreSpread = coneSpread * 0.22;
      lamp.moveTo(17 * s, 0);
      lamp.lineTo(coreLen, -coreSpread);
      lamp.lineTo(coreLen, coreSpread);
      lamp.lineTo(17 * s, 0);
      lamp.fill({ color: 0xffffff, alpha: 0.18 * baseAlpha });

      // Lamp housing glow — a small disc at the bulb so the source
      // reads emissive rather than the cone appearing free-floating.
      lamp.circle(17 * s, 0, 4 * s).fill({
        color: 0xfffbea,
        alpha: 0.8 * baseAlpha,
      });

      hull.clear();
      hull.position.set(player.x, player.y);
      hull.rotation = player.angle;

      // Main pressure hull — slightly tapered tail end so the
      // silhouette reads as directional rather than a flat ellipse.
      hull.moveTo(28 * s, 0);
      hull.bezierCurveTo(28 * s, -10 * s, 14 * s, -14 * s, 0, -14 * s);
      hull.bezierCurveTo(-16 * s, -14 * s, -22 * s, -8 * s, -24 * s, -3 * s);
      hull.lineTo(-24 * s, 3 * s);
      hull.bezierCurveTo(-22 * s, 8 * s, -16 * s, 14 * s, 0, 14 * s);
      hull.bezierCurveTo(14 * s, 14 * s, 28 * s, 10 * s, 28 * s, 0);
      hull.fill({ color: 0x0e4f55, alpha: 1 });
      hull.stroke({ color: 0x6be6c1, alpha: 0.9, width: 1.5 });

      // Riveted hull plating — three faint horizontal lines at the
      // mid-line read as paneling under the mint stroke.
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        hull.moveTo(-20 * s, i * 4 * s);
        hull.lineTo(20 * s, i * 4 * s);
        hull.stroke({ color: 0x6be6c1, alpha: 0.18, width: 0.6 });
      }

      // Forward observation dome — the captain's bubble. Inner light
      // breathes with `glowIntensity`.
      hull.circle(8 * s, -7 * s, 7 * s).fill({ color: 0x051a22, alpha: 1 });
      hull.circle(8 * s, -7 * s, 7 * s).stroke({
        color: 0x6be6c1,
        alpha: 0.85,
        width: 1,
      });
      hull.circle(8 * s, -7 * s, 3.4 * s).fill({
        color: 0xfffbea,
        alpha: 0.7 + Math.sin(totalTime * 3) * 0.18,
      });
      // Highlight glint on the dome — sells the curvature.
      hull.circle(10 * s, -9 * s, 1.2 * s).fill({
        color: 0xffffff,
        alpha: 0.6,
      });

      // Aft thrust nacelles — two short cylinders on either side of
      // the tail. Pulse alpha tracks overdrive so a boost reads.
      const thrusterAlpha = overdriveActive
        ? 0.95
        : 0.7 + Math.sin(totalTime * 8) * 0.08;
      hull.roundRect(-30 * s, -10 * s, 8 * s, 5 * s, 1.5).fill({
        color: 0x0a3740,
        alpha: thrusterAlpha,
      });
      hull.roundRect(-30 * s, 5 * s, 8 * s, 5 * s, 1.5).fill({
        color: 0x0a3740,
        alpha: thrusterAlpha,
      });

      // Propeller wash — a soft amber/teal puff streaming behind the
      // nacelles, pushed back further during overdrive.
      const washX = -32 * s;
      const washSpread = overdriveActive ? 18 * s : 10 * s;
      hull.ellipse(washX - washSpread * 0.5, -7.5 * s, washSpread, 2 * s).fill({
        color: overdriveActive ? 0xffcc6a : 0x6be6c1,
        alpha: (0.18 + Math.sin(totalTime * 10) * 0.06) * (overdriveActive ? 2 : 1),
      });
      hull.ellipse(washX - washSpread * 0.5, 7.5 * s, washSpread, 2 * s).fill({
        color: overdriveActive ? 0xffcc6a : 0x6be6c1,
        alpha: (0.18 + Math.sin(totalTime * 10 + 1) * 0.06) * (overdriveActive ? 2 : 1),
      });

      // Top antenna — single mast with a blinking tip light. Adds a
      // tiny vertical detail that breaks the otherwise-flat silhouette.
      hull.moveTo(-2 * s, -14 * s);
      hull.lineTo(-2 * s, -22 * s);
      hull.stroke({ color: 0x6be6c1, alpha: 0.55, width: 0.8 });
      hull.circle(-2 * s, -22 * s, 1.4 * s).fill({
        color: 0xff6b6b,
        alpha: 0.5 + Math.sin(totalTime * 5) * 0.5,
      });
    },
    destroy() {
      subContainer.destroy({ children: true });
    },
  };
}
