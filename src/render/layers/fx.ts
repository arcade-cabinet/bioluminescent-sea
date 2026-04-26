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
    threatBearings: readonly {
      bearing: number;
      intensity: number;
      nearness: number;
    }[];
    impactRippleAt: { x: number; y: number } | null;
    /** 0..1 leviathan proximity. Drives a subtle violet edge
     *  vignette pulse so the player feels something enormous is
     *  nearby. Independent of `threatFlashAlpha`. */
    leviathanProximity: number;
    /** Active flank broadcasts — fading arcs from engager to
     *  packmates so the player sees the pack converging. */
    flankBroadcasts: readonly {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      age: number;
      lifetime: number;
    }[];
    /** True while adrenaline is active. The FX layer paints a
     *  cyan-edged chromatic vignette so the slow-mo state is
     *  visually unmistakable. */
    adrenalineActive: boolean;
    /** 0..1 adrenaline readiness. The FX layer renders a thin
     *  mint pulse ring around the player that brightens with
     *  readiness so the player can see when the safety net is
     *  armed. */
    adrenalineReadiness: number;
    /** 0..1 oxygen ratio. Drives a deep-red critical vignette
     *  that scales in intensity as oxygen approaches 0. Hidden
     *  above 0.18 so calm play stays uncluttered. */
    oxygenRatio: number;
    /** Anomaly pickups *this frame*. Each one seeds an expanding
     *  pickup ring that lives for ~0.6s, color-keyed to the
     *  anomaly type. The FX layer maintains its own age list so
     *  the rings persist after the sim's edge event has cleared. */
    anomalyPickups: readonly {
      x: number;
      y: number;
      type: "repel" | "overdrive" | "lure" | "lamp-flare" | "breath";
    }[];
    /** True for exactly one frame at the moment the biome changes.
     *  The FX layer starts a 1.4 s sweep cinematic in the new
     *  biome's tint. */
    biomeTransitionTriggered: boolean;
    /** Hex tint of the *current* biome. Used as the cinematic
     *  sweep color when biomeTransitionTriggered is true. */
    biomeTintHex: string | undefined;
  }): void;
  destroy(): void;
}

interface ActiveRipple {
  x: number;
  y: number;
  startedAt: number;
}

export function mountFx(parent: Container): FxController {
  const sonar = new Graphics();
  const bursts = new Graphics();
  const lampScatter = new Graphics();
  const impactRipples = new Graphics();
  const flankArcs = new Graphics();
  const leviathanVignette = new Graphics();
  const adrenalineVignette = new Graphics();
  const oxygenCriticalVignette = new Graphics();
  const pickupRings = new Graphics();
  const biomeSweep = new Graphics();
  const threatFlash = new Graphics();
  parent.addChild(
    sonar,
    bursts,
    lampScatter,
    impactRipples,
    flankArcs,
    leviathanVignette,
    adrenalineVignette,
    oxygenCriticalVignette,
    pickupRings,
    biomeSweep,
    threatFlash,
  );

  /** Active ripples — short ring buffer, entries auto-prune past
   *  the 0.7s lifetime. Edge-detected against the last impact
   *  position so a multi-frame collision doesn't queue duplicates. */
  const activeRipples: ActiveRipple[] = [];
  let lastSeenImpact: { x: number; y: number } | null = null;

  /** Active pickup rings — one entry per anomaly collected. The
   *  sim emits an edge event in `anomalyPickups`; the FX layer
   *  copies it onto its own age list so the visual persists after
   *  the sim event has cleared. */
  const activePickups: {
    x: number;
    y: number;
    color: number;
    startedAt: number;
  }[] = [];
  const PICKUP_COLORS: Record<string, number> = {
    repel: 0x7dd3fc,
    overdrive: 0xfde68a,
    lure: 0xa5f3fc,
    "lamp-flare": 0xfde68a,
    breath: 0x6be6c1,
  };

  /** Active biome-transition sweep cinematic. `null` = no
   *  cinematic playing. Lifetime 1.4 s; the sweep band moves from
   *  off-screen-top to off-screen-bottom over that window. */
  let activeBiomeSweep: { startedAt: number; color: number } | null = null;

  return {
    sync({ player, totalTime, bursts: list, threatFlashAlpha, viewport, lampScatterPoints, threatBearings, impactRippleAt, leviathanProximity, flankBroadcasts, adrenalineActive, adrenalineReadiness, oxygenRatio, anomalyPickups, biomeTransitionTriggered, biomeTintHex }) {
      // Ingest fresh pickups onto the active list.
      for (const p of anomalyPickups) {
        activePickups.push({
          x: p.x,
          y: p.y,
          color: PICKUP_COLORS[p.type] ?? 0xa5f3fc,
          startedAt: totalTime,
        });
      }

      // Ingest a fresh biome-sweep on the trigger frame. The
      // cinematic uses the *new* biome's tint so the player sees
      // the destination color, not the origin.
      if (biomeTransitionTriggered) {
        let tint = 0x6be6c1;
        if (biomeTintHex) {
          const hex = biomeTintHex.startsWith("#") ? biomeTintHex.slice(1) : biomeTintHex;
          const parsed = Number.parseInt(hex, 16);
          if (Number.isFinite(parsed)) tint = parsed;
        }
        activeBiomeSweep = { startedAt: totalTime, color: tint };
      }
      // Ingest a new ripple on rising-edge of impactRippleAt. The
      // sim re-emits the same {x, y} for several frames during the
      // grace window, so we de-dupe on identity.
      if (impactRippleAt) {
        if (
          !lastSeenImpact ||
          lastSeenImpact.x !== impactRippleAt.x ||
          lastSeenImpact.y !== impactRippleAt.y
        ) {
          activeRipples.push({
            x: impactRippleAt.x,
            y: impactRippleAt.y,
            startedAt: totalTime,
          });
          lastSeenImpact = { x: impactRippleAt.x, y: impactRippleAt.y };
        }
      } else {
        lastSeenImpact = null;
      }
      // Prune ripples past their visible lifetime (0.7s).
      while (activeRipples.length > 0 && totalTime - activeRipples[0].startedAt > 0.7) {
        activeRipples.shift();
      }

      sonar.clear();
      const phase = (totalTime * 0.75) % 1;
      const radius = 40 + phase * 220;
      sonar.circle(player.x, player.y, radius).stroke({
        color: 0x6be6c1,
        alpha: 0.4 * (1 - phase),
        width: 1.6,
      });

      // Adrenaline readiness ring — a thin mint pulse around the
      // player that brightens with readiness so the player can see
      // when the safety net is armed without hunting through the
      // HUD. At full readiness (1.0), the ring breathes between
      // 70%–100% alpha at 1.2 Hz; below 0.05 it goes invisible.
      if (adrenalineReadiness >= 0.05) {
        const breath = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(totalTime * 1.2));
        const ringR = 80;
        if (adrenalineReadiness < 1) {
          // Cooldown: filling arc starting at 12 o'clock, sweeping
          // clockwise as readiness climbs. Reads as "the gauge is
          // refilling" — radically more legible than a fading
          // circle.
          const arcStart = -Math.PI / 2;
          const arcEnd = arcStart + Math.PI * 2 * adrenalineReadiness;
          sonar.moveTo(player.x + Math.cos(arcStart) * ringR, player.y + Math.sin(arcStart) * ringR);
          sonar.arc(player.x, player.y, ringR, arcStart, arcEnd);
          sonar.stroke({
            color: 0x6be6c1,
            alpha: 0.35 + adrenalineReadiness * 0.3,
            width: 1.4,
          });
        } else {
          // Ready: full breathing ring, brighter than the cooldown
          // arc so the readiness state pops.
          sonar.circle(player.x, player.y, ringR).stroke({
            color: 0x6be6c1,
            alpha: 0.55 * breath,
            width: 2.4,
          });
        }
      }

      // Threat-bearing arcs on a fixed-radius warning ring around
      // the player. Each active stalker/charger/striker paints a
      // short red arc at its bearing — the player learns "I'm
      // about to be flanked from upper-left" at a glance, even
      // for predators outside the viewport.
      //
      // Arc width scales with intensity (stalk thinner, strike
      // fatter) so the player's lizard brain can rank threats by
      // urgency without reading colour. Alpha scales with nearness
      // so close threats burn brighter.
      const warningRingRadius = 64;
      for (const t of threatBearings) {
        const arcSpan = 0.16 + 0.18 * t.intensity; // radians
        const ax = player.x + Math.cos(t.bearing) * warningRingRadius;
        const ay = player.y + Math.sin(t.bearing) * warningRingRadius;
        // Lead head — the dot at the bearing.
        sonar.circle(ax, ay, 1.5 + t.intensity * 1.5).fill({
          color: 0xff6b6b,
          alpha: 0.85 * t.nearness,
        });
        // Arc segment — short ring stroke spanning ±arcSpan/2 around
        // the bearing. Pixi has no arc primitive on Graphics, so
        // approximate with a small N-segment polyline.
        const segments = 8;
        const half = arcSpan / 2;
        sonar.moveTo(
          player.x + Math.cos(t.bearing - half) * warningRingRadius,
          player.y + Math.sin(t.bearing - half) * warningRingRadius,
        );
        for (let i = 1; i <= segments; i++) {
          const theta = t.bearing - half + (arcSpan * i) / segments;
          sonar.lineTo(
            player.x + Math.cos(theta) * warningRingRadius,
            player.y + Math.sin(theta) * warningRingRadius,
          );
        }
        sonar.stroke({
          color: 0xff6b6b,
          alpha: 0.55 * t.nearness,
          width: 1.4 + t.intensity * 1.6,
        });
      }

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

      // Impact ripples — expanding warm-red shockwaves at the
      // collision position. Two concentric rings: the outer is the
      // forward shockwave (fast-expanding, sharp), the inner is a
      // soft trailing fill that anchors the ring as a "thump." Both
      // fade with t³ so the edge feels percussive rather than
      // lingering.
      impactRipples.clear();
      for (const r of activeRipples) {
        const age = totalTime - r.startedAt;
        const t = Math.max(0, Math.min(1, age / 0.7));
        const outerR = 18 + t * 110;
        const innerR = outerR * 0.62;
        const outerAlpha = Math.pow(1 - t, 2.4) * 0.8;
        const innerAlpha = Math.pow(1 - t, 3) * 0.45;
        if (outerAlpha > 0.02) {
          impactRipples.circle(r.x, r.y, outerR).stroke({
            color: 0xff6b6b,
            alpha: outerAlpha,
            width: 2.4 - t * 1.6,
          });
        }
        if (innerAlpha > 0.02) {
          impactRipples.circle(r.x, r.y, innerR).fill({
            color: 0xff6b6b,
            alpha: innerAlpha * 0.35,
          });
        }
      }

      // Pickup-confirmation rings — one expanding ring per anomaly
      // collected, color-keyed to type. Lifetime 0.6s with t² fade
      // so the pop is decisive but doesn't linger across the
      // following seconds. Two rings at offset radii so the pulse
      // reads richer than a single stroke.
      pickupRings.clear();
      for (let i = activePickups.length - 1; i >= 0; i--) {
        const p = activePickups[i];
        const age = totalTime - p.startedAt;
        const t = age / 0.6;
        if (t < 0 || t >= 1) {
          if (t >= 1) activePickups.splice(i, 1);
          continue;
        }
        const baseR = 10 + t * 70;
        const outerAlpha = Math.pow(1 - t, 2) * 0.85;
        pickupRings.circle(p.x, p.y, baseR).stroke({
          color: p.color,
          alpha: outerAlpha,
          width: 2.2 * (1 - t * 0.6),
        });
        pickupRings.circle(p.x, p.y, baseR * 0.65).stroke({
          color: 0xfef9c3,
          alpha: outerAlpha * 0.55,
          width: 1.2 * (1 - t * 0.5),
        });
      }

      // Pack-flank convergence arcs — when a predator broadcasts an
      // engage, draw a brief warm-orange line from the engager to
      // each packmate it called. The arc fades over `lifetime` so
      // the visual lasts as long as the broadcast cooldown gates
      // the next call. Sells the moment the pack tightens — a
      // reflex-readable cue beyond just the audio chirp.
      flankArcs.clear();
      for (const b of flankBroadcasts) {
        const t = Math.max(0, Math.min(1, b.age / b.lifetime));
        const alpha = Math.pow(1 - t, 1.6) * 0.55;
        if (alpha < 0.02) continue;
        flankArcs.moveTo(b.fromX, b.fromY);
        // Mid-point bow upward (negative y) so the arc reads as a
        // commanding gesture, not a flat string. Bow height scales
        // with broadcast age — peaks early, flattens as it fades.
        const midX = (b.fromX + b.toX) * 0.5;
        const midY = (b.fromY + b.toY) * 0.5 - 60 * (1 - t);
        flankArcs.quadraticCurveTo(midX, midY, b.toX, b.toY);
        flankArcs.stroke({
          color: 0xff9f4a,
          alpha,
          width: 1.6 + (1 - t) * 1.4,
        });
        // Lead pulse at the destination — a small filled disc that
        // shrinks as the arc fades, marks where each mate is being
        // recruited.
        flankArcs.circle(b.toX, b.toY, 4 + (1 - t) * 4).fill({
          color: 0xff9f4a,
          alpha: alpha * 0.75,
        });
      }

      // Leviathan presence vignette — four edge bands that ramp
      // alpha with proximity, breathing on a slow sine. Color is
      // dusky violet (0x3a1d5a — same as midnight-column tint) so
      // it reads as ambient dread, not a damage flash. Visible only
      // when `leviathanProximity > 0.05` to avoid burning fill rate
      // on empty frames.
      leviathanVignette.clear();
      if (leviathanProximity > 0.05) {
        // 1.6 Hz breathing — a 2/3 second cycle, feels like a deep
        // breath rather than a heartbeat. Modulates the band alpha
        // 70%–100% so the vignette is always visibly present at
        // proximity > 0, never strobes off.
        const breath = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(totalTime * 1.6));
        const baseAlpha = leviathanProximity * 0.5 * breath;
        const w = viewport.widthPx;
        const h = viewport.heightPx;
        const bandW = w * 0.18;
        const bandH = h * 0.22;
        // Top + bottom + left + right bands, each fading inward.
        // Three concentric rectangles per side give a soft falloff
        // without a real radial-gradient shader.
        const bandSteps = 3;
        for (let i = 0; i < bandSteps; i++) {
          const t = (i + 1) / bandSteps;
          const a = baseAlpha * (1 - t * t);
          const inset = t * bandW;
          const insetH = t * bandH;
          // Top
          leviathanVignette.rect(0, 0, w, insetH).fill({ color: 0x3a1d5a, alpha: a });
          // Bottom
          leviathanVignette.rect(0, h - insetH, w, insetH).fill({ color: 0x3a1d5a, alpha: a });
          // Left
          leviathanVignette.rect(0, 0, inset, h).fill({ color: 0x3a1d5a, alpha: a });
          // Right
          leviathanVignette.rect(w - inset, 0, inset, h).fill({ color: 0x3a1d5a, alpha: a });
        }
      }

      // Adrenaline vignette — cyan-tinted radial inset that pulses
      // sharply on the rising edge then settles into a calm border.
      // Visually distinguishes the slow-mo state from the violet
      // leviathan vignette so a player in adrenaline + leviathan
      // proximity can read both cues at once.
      adrenalineVignette.clear();
      if (adrenalineActive) {
        const breath = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(totalTime * 8));
        const baseAlpha = 0.45 * breath;
        const w = viewport.widthPx;
        const h = viewport.heightPx;
        const bandSteps = 4;
        const bandW = w * 0.16;
        const bandH = h * 0.18;
        for (let i = 0; i < bandSteps; i++) {
          const t = (i + 1) / bandSteps;
          const a = baseAlpha * (1 - t * t * t);
          const inset = t * bandW;
          const insetH = t * bandH;
          adrenalineVignette.rect(0, 0, w, insetH).fill({ color: 0x6be6c1, alpha: a });
          adrenalineVignette.rect(0, h - insetH, w, insetH).fill({ color: 0x6be6c1, alpha: a });
          adrenalineVignette.rect(0, 0, inset, h).fill({ color: 0x6be6c1, alpha: a });
          adrenalineVignette.rect(w - inset, 0, inset, h).fill({ color: 0x6be6c1, alpha: a });
        }
      }

      // Oxygen-critical vignette — deep-red screen edges that
      // intensify as oxygen approaches 0. Hidden above 0.18 so
      // calm play stays uncluttered. Pulse rate accelerates with
      // urgency: 1.5 Hz at the boundary, 4 Hz at zero. Combined
      // with the existing low-oxygen HUD label and oxygen-warn
      // SFX, the player gets a complete "you are running out" cue
      // at three independent layers (HUD text, audio chirp, full-
      // screen vignette).
      oxygenCriticalVignette.clear();
      if (oxygenRatio < 0.18) {
        // Severity ramps from 0 at ratio=0.18 to 1 at ratio=0.
        const severity = 1 - oxygenRatio / 0.18;
        const pulseHz = 1.5 + severity * 2.5;
        const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(totalTime * pulseHz * Math.PI * 2));
        const baseAlpha = severity * 0.55 * pulse;
        const w = viewport.widthPx;
        const h = viewport.heightPx;
        const bandW = w * 0.22;
        const bandH = h * 0.26;
        const bandSteps = 4;
        for (let i = 0; i < bandSteps; i++) {
          const t = (i + 1) / bandSteps;
          const a = baseAlpha * (1 - t * t);
          const inset = t * bandW;
          const insetH = t * bandH;
          oxygenCriticalVignette.rect(0, 0, w, insetH).fill({ color: 0xff3a2a, alpha: a });
          oxygenCriticalVignette.rect(0, h - insetH, w, insetH).fill({ color: 0xff3a2a, alpha: a });
          oxygenCriticalVignette.rect(0, 0, inset, h).fill({ color: 0xff3a2a, alpha: a });
          oxygenCriticalVignette.rect(w - inset, 0, inset, h).fill({ color: 0xff3a2a, alpha: a });
        }
      }

      // Biome transition cinematic — a soft horizontal band sweeps
      // top-to-bottom in the new biome's tint, paired with a
      // depth-tint pulse on the rest of the screen so the eye reads
      // "the world just changed color." 1.4 s lifetime; band width
      // ~30% of viewport height; eased so the trailing edge lingers.
      biomeSweep.clear();
      if (activeBiomeSweep) {
        const age = totalTime - activeBiomeSweep.startedAt;
        const lifetime = 1.4;
        if (age >= lifetime) {
          activeBiomeSweep = null;
        } else {
          const t = age / lifetime;
          const w = viewport.widthPx;
          const h = viewport.heightPx;
          // Whole-screen tint pulse — peaks at 25% of lifetime.
          const tintT = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
          biomeSweep.rect(0, 0, w, h).fill({
            color: activeBiomeSweep.color,
            alpha: 0.18 * tintT,
          });
          // Sweeping band. Eased descent so the leading edge moves
          // fast, the trailing edge lingers — feels like a body of
          // water passing through.
          const eased = t * t * (3 - 2 * t);
          const bandH = h * 0.32;
          const bandY = -bandH + eased * (h + bandH);
          const bandAlpha = 0.55 * (1 - t * 0.4);
          biomeSweep.rect(0, bandY, w, bandH).fill({
            color: activeBiomeSweep.color,
            alpha: bandAlpha,
          });
          // Trailing edge highlight — creamy yellow, narrow.
          biomeSweep.rect(0, bandY + bandH - 3, w, 3).fill({
            color: 0xfef9c3,
            alpha: 0.7 * (1 - t),
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
      lampScatter.destroy();
      impactRipples.destroy();
      flankArcs.destroy();
      leviathanVignette.destroy();
      adrenalineVignette.destroy();
      oxygenCriticalVignette.destroy();
      pickupRings.destroy();
      biomeSweep.destroy();
      threatFlash.destroy();
      activeRipples.length = 0;
      activePickups.length = 0;
      activeBiomeSweep = null;
    },
  };
}

function parseHex(input: string): number {
  if (input.startsWith("#")) return Number.parseInt(input.slice(1), 16);
  return Number.parseInt(input, 16);
}
