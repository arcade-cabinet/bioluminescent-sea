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
  // Filter resolution inherits the renderer's resolution because
  // `Filter.defaultOptions.resolution = "inherit"` is set globally
  // in src/render/stage.ts — see pixijs/pixijs#11467.
  const bloom = new AdvancedBloomFilter({
    threshold: 0.45,
    bloomScale: 0.85,
    brightness: 1,
    blur: 4,
    quality: 4,
  });
  bloom.resolution = "inherit";
  subContainer.filters = [bloom];

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

      // Estimate current speed (px/s) from the last two samples so the
      // trail thickens when the sub is moving fast (overdrive, hard
      // descent) and thins when hovering. Read at index 0 vs 1 — these
      // are sequential frames.
      let speedPxPerSec = 0;
      if (trailPositions.length > 1) {
        const cur = trailPositions[0];
        const prev = trailPositions[1];
        const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
        const dt = Math.max(0.001, cur.time - prev.time);
        speedPxPerSec = dist / dt;
      }
      // Map 0..600 px/s → 0..1 boost. Hover ≈ 0, normal sub ≈ 0.4-0.5,
      // overdrive ≈ 0.9+. Width ramps from 4 → 7, alpha 0.35 → 0.55.
      const speedBoost = Math.min(1, speedPxPerSec / 600);
      const trailWidth = (4 + speedBoost * 3) * s;
      const trailAlphaScale = 0.35 + speedBoost * 0.2;

      trail.clear();
      if (trailPositions.length > 1) {
        trail.moveTo(trailPositions[0].x, trailPositions[0].y);
        for (let i = 1; i < trailPositions.length; i++) {
          const pt = trailPositions[i];
          const age = totalTime - pt.time;
          const alpha = Math.max(0, 1 - age * 1.5);
          if (alpha > 0) {
             trail.lineTo(pt.x, pt.y);
             trail.stroke({ color: 0x6be6c1, alpha: alpha * trailAlphaScale, width: trailWidth });
             trail.moveTo(pt.x, pt.y);
          }
        }
      }

      // Active buff tells. `activeBuffs.repelUntil` / `.overdriveUntil`
      // are absolute timestamps; the sim compares against `totalTime`.
      const repelActive = player.activeBuffs.repelUntil > totalTime;
      const overdriveActive = player.activeBuffs.overdriveUntil > totalTime;
      const lureActive = player.activeBuffs.lureUntil > totalTime;
      const lampFlareActive = player.activeBuffs.lampFlareUntil > totalTime;
      const adrenalineActive = player.activeBuffs.adrenalineUntil > totalTime;
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
      if (lureActive) {
        // Lure radius perimeter — faint dashed cyan ring at the
        // actual sim lure radius (300 world-units). Teaches the
        // affordance: collectibles inside the ring will bend to you.
        const lureRadius = 300;
        const dashCount = 48;
        const dashArc = (Math.PI * 2) / dashCount;
        const ringPulse = 0.55 + 0.2 * Math.sin(totalTime * 1.6);
        for (let i = 0; i < dashCount; i++) {
          if (i % 2 === 1) continue;
          const a0 = i * dashArc + totalTime * 0.18;
          const a1 = a0 + dashArc * 0.85;
          buff.moveTo(Math.cos(a0) * lureRadius, Math.sin(a0) * lureRadius);
          buff.arc(0, 0, lureRadius, a0, a1);
          buff.stroke({ color: 0xa5f3fc, alpha: 0.18 * ringPulse, width: 1.1 });
        }

        // Tractor-beam pulse — eight thin cyan rays emanating from
        // the sub at slowly rotating angles. Reads as "the sub is
        // pulling things in" without needing to draw lines TO every
        // collectible (which would clutter at high creature density).
        const rays = 8;
        const baseAngle = totalTime * 1.2;
        const innerR = 42 * s;
        const outerR = 110 * s + Math.sin(totalTime * 3) * 12 * s;
        for (let i = 0; i < rays; i++) {
          const a = baseAngle + (i / rays) * Math.PI * 2;
          const x1 = Math.cos(a) * innerR;
          const y1 = Math.sin(a) * innerR;
          const x2 = Math.cos(a) * outerR;
          const y2 = Math.sin(a) * outerR;
          // Inward-pointing arrow heads at the inner end so the
          // direction-of-pull reads at a glance.
          const arrowSize = 4 * s;
          const perpA = a + Math.PI / 2;
          const arrowX1 = x1 + Math.cos(a) * arrowSize + Math.cos(perpA) * arrowSize;
          const arrowY1 = y1 + Math.sin(a) * arrowSize + Math.sin(perpA) * arrowSize;
          const arrowX2 = x1 + Math.cos(a) * arrowSize - Math.cos(perpA) * arrowSize;
          const arrowY2 = y1 + Math.sin(a) * arrowSize - Math.sin(perpA) * arrowSize;
          buff.moveTo(x2, y2);
          buff.lineTo(x1, y1);
          buff.lineTo(arrowX1, arrowY1);
          buff.moveTo(x1, y1);
          buff.lineTo(arrowX2, arrowY2);
          buff.stroke({ color: 0xa5f3fc, alpha: 0.45, width: 1.2 });
        }
      }
      if (lampFlareActive) {
        // Sun-burst halo at the lamp housing — twelve short rays
        // radiating from the sub's forward bulb, golden so it
        // reads distinct from the cyan/amber/mint palette of other
        // buffs. Pulse slowly to avoid eye strain.
        const flarePulse = 0.7 + 0.3 * Math.sin(totalTime * 2.5);
        const rays = 12;
        for (let i = 0; i < rays; i++) {
          const a = (i / rays) * Math.PI * 2 + totalTime * 0.3;
          const innerR = 8 * s;
          const outerR = (16 + flarePulse * 8) * s;
          // Anchor rays at the lamp housing position (slightly
          // forward + above of the sub's pivot — see lamp draw).
          const anchorX = 17 * s * Math.cos(player.angle) - 0;
          const anchorY = 17 * s * Math.sin(player.angle) - 0;
          buff.moveTo(anchorX + Math.cos(a) * innerR, anchorY + Math.sin(a) * innerR);
          buff.lineTo(anchorX + Math.cos(a) * outerR, anchorY + Math.sin(a) * outerR);
          buff.stroke({ color: 0xfde68a, alpha: 0.7 * flarePulse, width: 1.4 });
        }
      }
      if (adrenalineActive) {
        // Cyan ring overlay — distinct from repel's blue and
        // overdrive's amber. Tighter to the hull, breathes faster
        // (8 Hz to match the FX vignette) so the player's eye
        // catches the burst state on the sub itself, not just the
        // screen edges.
        const adrenPulse = 0.7 + 0.3 * Math.sin(totalTime * 8);
        buff.circle(0, 0, 30 * s).stroke({
          color: 0x6be6c1,
          alpha: 0.65 * adrenPulse,
          width: 2.2,
        });
        buff.circle(0, 0, 22 * s).stroke({
          color: 0xfff3a0,
          alpha: 0.4 * adrenPulse,
          width: 1.2,
        });
      }

      // Buff cooldown arcs — one short arc per active buff at a
      // fixed bearing, sweep proportional to remaining/total time.
      // Sits on a slightly larger radius than the hull so the arcs
      // don't compete with the hull stroke or the damage arc.
      // Bearings spaced at 8 / 4 / 2 / 6 o'clock so a player with
      // multiple buffs sees four discrete chips, not a soup.
      const buffSpecs: {
        active: boolean;
        until: number;
        duration: number;
        bearing: number;
        color: number;
      }[] = [
        { active: repelActive,     until: player.activeBuffs.repelUntil,     duration: 15, bearing: -Math.PI / 2 + Math.PI * 1.25, color: 0x7dd3fc },
        { active: overdriveActive, until: player.activeBuffs.overdriveUntil, duration: 10, bearing: -Math.PI / 2 + Math.PI * 0.25, color: 0xfde68a },
        { active: lureActive,      until: player.activeBuffs.lureUntil,      duration: 12, bearing: -Math.PI / 2 + Math.PI * 1.75, color: 0xa5f3fc },
        { active: lampFlareActive, until: player.activeBuffs.lampFlareUntil, duration: 14, bearing: -Math.PI / 2 + Math.PI * 0.75, color: 0xfde68a },
      ];
      const buffArcR = 44 * s;
      const buffArcSpan = (24 * Math.PI) / 180;
      for (const spec of buffSpecs) {
        if (!spec.active) continue;
        const remaining = Math.max(0, spec.until - totalTime);
        const t = Math.max(0, Math.min(1, remaining / spec.duration));
        if (t <= 0) continue;
        const sweep = buffArcSpan * t;
        buff.moveTo(Math.cos(spec.bearing - sweep / 2) * buffArcR, Math.sin(spec.bearing - sweep / 2) * buffArcR);
        buff.arc(0, 0, buffArcR, spec.bearing - sweep / 2, spec.bearing + sweep / 2);
        buff.stroke({ color: spec.color, alpha: 0.85, width: 2.4 });
      }

      // Damage direction arc: short red arc on the hull-radius ring
      // pointing toward the most recent threat. Visible only during
      // the impact flicker window (0.6s) and only if a bearing was
      // captured. Half-arc width 50° so the player can read "from
      // that side" without it overpowering the buff overlays.
      const sinceImpactDir = totalTime - (player.lastImpactSeconds ?? -Infinity);
      const bearing = player.lastImpactBearing;
      if (sinceImpactDir < 0.6 && sinceImpactDir >= 0 && bearing !== undefined) {
        const fadeT = 1 - sinceImpactDir / 0.6;
        const arcR = 36 * s;
        const halfArc = (50 * Math.PI) / 180;
        buff.moveTo(Math.cos(bearing - halfArc) * arcR, Math.sin(bearing - halfArc) * arcR);
        buff.arc(0, 0, arcR, bearing - halfArc, bearing + halfArc);
        buff.stroke({
          color: 0xff3a2a,
          alpha: 0.85 * fadeT,
          width: 2.4 * fadeT + 1.2,
        });
      }

      // Idle bob — when the sub is barely moving, add a subtle
      // sinusoidal Y offset to the hull + lamp so the silhouette
      // doesn't sit dead-still. Bob amplitude fades out as speed
      // increases (full bob below 40 px/s, vanishes by 200 px/s).
      // Trail and buff overlays anchor at the intended position so
      // they stay world-locked.
      const idleFactor = Math.max(0, 1 - speedPxPerSec / 200);
      const bobY = idleFactor > 0 ? Math.sin(totalTime * 1.6) * 1.4 * idleFactor : 0;

      lamp.clear();
      lamp.position.set(player.x, player.y + bobY);
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
      hull.position.set(player.x, player.y + bobY);
      hull.rotation = player.angle;

      // Main pressure hull — slightly tapered tail end so the
      // silhouette reads as directional rather than a flat ellipse.
      hull.moveTo(28 * s, 0);
      hull.bezierCurveTo(28 * s, -10 * s, 14 * s, -14 * s, 0, -14 * s);
      hull.bezierCurveTo(-16 * s, -14 * s, -22 * s, -8 * s, -24 * s, -3 * s);
      hull.lineTo(-24 * s, 3 * s);
      hull.bezierCurveTo(-22 * s, 8 * s, -16 * s, 14 * s, 0, 14 * s);
      hull.bezierCurveTo(14 * s, 14 * s, 28 * s, 10 * s, 28 * s, 0);
      // Impact flicker — strokes the hull warm-red for ~0.6s after a
      // hit, with a high-frequency oscillation so the player feels
      // "this is bad" without a full-screen flash overlay. After the
      // window the stroke returns to the standard mint.
      const sinceImpact = totalTime - (player.lastImpactSeconds ?? -Infinity);
      const inImpactWindow = sinceImpact >= 0 && sinceImpact < 0.6;
      const impactT = inImpactWindow ? 1 - sinceImpact / 0.6 : 0;
      const impactFlicker = inImpactWindow ? 0.5 + 0.5 * Math.sin(totalTime * 50) : 1;
      const hullStrokeColor = inImpactWindow ? 0xff6b6b : 0x6be6c1;
      const hullStrokeAlpha = 0.9 * (1 - impactT * 0.4) * impactFlicker;
      const hullStrokeWidth = 1.5 + impactT * 1.4; // pop wider on hit
      hull.fill({ color: 0x0e4f55, alpha: 1 });
      hull.stroke({ color: hullStrokeColor, alpha: hullStrokeAlpha, width: hullStrokeWidth });

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
