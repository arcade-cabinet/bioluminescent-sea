import { Container, Graphics } from "pixi.js";
import { GlowFilter } from "pixi-filters";
import type { Camera } from "@/render/camera";
import { drawProceduralCreature } from "./creature-factory";
import type {
  Anomaly,
  Creature,
  Pirate,
  Predator,
} from "@/sim/entities/types";

export interface EntityController {
  sync(args: {
    anomalies: readonly Anomaly[];
    creatures: readonly Creature[];
    predators: readonly Predator[];
    pirates: readonly Pirate[];
    totalTime: number;
    camera?: Camera;
  }): void;
  destroy(): void;
}

export function mountEntities(parent: Container): EntityController {
  // Anomalies live in their own sub-container with a GlowFilter so
  // the buff pickups read as emissive even at distance. Filter
  // resolution inherits the renderer's resolution via
  // `Filter.defaultOptions.resolution = "inherit"` (set in stage.ts) —
  // see pixijs/pixijs#11467.
  const anomalyHost = new Container();
  anomalyHost.label = "entities:anomalies";
  const anomalyGlow = new GlowFilter({
    distance: 18,
    outerStrength: 1.6,
    innerStrength: 0.2,
    color: 0xffffff,
    quality: 0.35,
  });
  anomalyGlow.resolution = "inherit";
  anomalyHost.filters = [anomalyGlow];
  parent.addChild(anomalyHost);

  const anomalies = new Map<string, Graphics>();
  const creatures = new Map<string, Graphics>();
  const predators = new Map<string, Graphics>();
  const pirates = new Map<string, Graphics>();

  return {
    sync({ anomalies: as, creatures: cs, predators: ps, pirates: ks, totalTime, camera }) {
      syncAnomalies(anomalyHost, anomalies, as, camera);
      syncCreatures(parent, creatures, cs, camera);
      syncPredators(parent, predators, ps, totalTime);
      syncPirates(parent, pirates, ks, totalTime);
    },
    destroy() {
      for (const g of anomalies.values()) g.destroy();
      for (const g of creatures.values()) g.destroy();
      for (const g of predators.values()) g.destroy();
      for (const g of pirates.values()) g.destroy();
      anomalies.clear();
      creatures.clear();
      predators.clear();
      pirates.clear();
      anomalyHost.filters = [];
      anomalyHost.destroy();
    },
  };
}

function syncAnomalies(
  parent: Container,
  cache: Map<string, Graphics>,
  list: readonly Anomaly[],
  camera: Camera | undefined
): void {
  const seen = new Set<string>();
  for (const a of list) {
    seen.add(a.id);
    let g = cache.get(a.id);
    if (!g) {
      g = new Graphics();
      parent.addChild(g);
      cache.set(a.id, g);
    }
    g.clear();
    
    if (camera && a.worldYMeters !== undefined) {
      const projected = camera.project({ x: 0, y: a.worldYMeters, z: 0 });
      g.position.set(a.x, projected.y);
    } else {
      g.position.set(a.x, a.y);
    }
    
    const pulse = 1 + Math.sin(a.pulsePhase) * 0.15;
    const glowRadius = a.size * 2 * pulse;
    // Anomaly identity by type. Each buff carries its own colour
    // hint so the player learns "this glyph means X" without text.
    const color =
      a.type === "repel"
        ? 0x8b5cf6 // violet — wards predators
        : a.type === "overdrive"
          ? 0xfde68a // amber — speed boost
          : a.type === "breath"
            ? 0x6be6c1 // mint — instant oxygen burst
            : a.type === "lure"
              ? 0xa5f3fc // pale cyan — pulls collectibles
              : 0xfbbf24; // gold — lamp-flare
    
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 3;
      g.circle(0, 0, glowRadius * t).fill({
        color,
        alpha: 0.15 * (1 - t),
      });
    }

    const coreR = a.size * 0.5 * pulse;
    g.circle(0, 0, coreR).fill({ color, alpha: 0.9 });
    g.circle(0, 0, coreR).stroke({ color: 0xffffff, width: 2, alpha: 0.5 });

    // Glyph inside the core — distinguishes the buff types beyond
    // colour alone, since color-blind players + low-saturation
    // backdrops can't always read the colour. Each glyph echoes the
    // buff's effect.
    drawAnomalyGlyph(g, a.type, coreR);
  }

  for (const [id, g] of cache) {
    if (!seen.has(id)) {
      g.destroy();
      cache.delete(id);
    }
  }
}

function syncCreatures(
  parent: Container,
  cache: Map<string, Graphics>,
  list: readonly Creature[],
  camera: Camera | undefined
): void {
  const seen = new Set<string>();
  for (const c of list) {
    seen.add(c.id);
    let g = cache.get(c.id);
    if (!g) {
      g = new Graphics();
      parent.addChild(g);
      cache.set(c.id, g);
    }
    g.clear();

    if (camera && c.worldYMeters !== undefined) {
      const projected = camera.project({ x: 0, y: c.worldYMeters, z: 0 });
      g.position.set(c.x, projected.y);
    } else {
      g.position.set(c.x, c.y);
    }
    g.rotation = Math.sin(c.pulsePhase * 0.45) * 0.16;

    const glowRadius = c.size * 2.4;
    const glowColor = parseHex(c.glowColor);
    const bodyColor = parseHex(c.color);
    
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 3;
      g.circle(0, 0, glowRadius * t).fill({
        color: glowColor,
        alpha: c.glowIntensity * 0.12 * (1 - t),
      });
    }

    drawProceduralCreature(g, c, bodyColor, glowColor);
  }

  for (const [id, g] of cache) {
    if (!seen.has(id)) {
      g.destroy();
      cache.delete(id);
    }
  }
}

function syncPredators(
  parent: Container,
  cache: Map<string, Graphics>,
  list: readonly Predator[],
  totalTime: number
): void {
  const seen = new Set<string>();
  for (const p of list) {
    seen.add(p.id);
    let g = cache.get(p.id);
    if (!g) {
      g = new Graphics();
      parent.addChild(g);
      cache.set(p.id, g);
    }
    g.clear();
    // Death animation: dying predators sink (Y offset) and tilt (extra
    // angle) over the deathProgress 0..1 window. The renderer also
    // dims the alpha at the container level so every body piece
    // fades together. Bubble particles are drawn near the entity in a
    // separate layer pass below.
    const deathProg = p.deathProgress ?? 0;
    const sinkOffset = deathProg * 60; // px below original Y
    const deathTilt = deathProg * 0.6; // radians
    g.position.set(p.x, p.y + sinkOffset);
    g.rotation = p.angle + deathTilt;
    g.alpha = deathProg > 0 ? 1 - deathProg * deathProg : 1;

    // Marauder-sub: render as a sub silhouette (warm-red palette, grungy
    // plating). Detection by id prefix mirrors the AIManager wiring in
    // src/sim/ai/manager.ts — entity ids start with "marauder-sub-".
    if (p.id.startsWith("marauder-sub")) {
      drawEnemySub(g, p.size, totalTime, p.noiseOffset);
    } else if (p.id.startsWith("torpedo-eel")) {
      drawTorpedoEel(g, p.size, totalTime, p.noiseOffset, p.aiState, p.stateProgress);
    } else if (p.id.startsWith("shadow-octopus")) {
      drawShadowOctopus(g, p.size, totalTime, p.noiseOffset, p.aiState, p.stateProgress);
    } else if (p.isLeviathan) {
      const sway = Math.sin(totalTime * 1.5 + p.noiseOffset) * p.size * 0.05;
      
      // Leviathan rendering
      g.ellipse(0, sway, p.size * 0.8, p.size * 0.4).fill({ color: 0x03060a, alpha: 0.98 });
      g.ellipse(0, sway, p.size * 0.8, p.size * 0.4).stroke({ color: 0x8b5cf6, width: 2, alpha: 0.4 });
      
      // Spine
      g.moveTo(-p.size * 0.4, -p.size * 0.3 + sway);
      for(let i=0; i<5; i++) {
        g.lineTo(-p.size * 0.3 + (i * p.size * 0.15), -p.size * 0.5 + sway + (i % 2 === 0 ? p.size*0.1 : 0));
      }
      g.stroke({ color: 0x8b5cf6, width: 3, alpha: 0.6 });

      // Eyes
      g.circle(p.size * 0.6, -p.size * 0.1 + sway, p.size * 0.08).fill({ color: 0xfde68a, alpha: 1 });
      g.circle(p.size * 0.65, -p.size * 0.05 + sway, p.size * 0.05).fill({ color: 0xfde68a, alpha: 1 });
      g.circle(p.size * 0.55, -p.size * 0.15 + sway, p.size * 0.06).fill({ color: 0xfde68a, alpha: 1 });
      
      // Tendrils
      for(let i=0; i<6; i++) {
        const tSway = Math.sin(totalTime * 2 + i) * p.size * 0.15;
        g.moveTo(-p.size * 0.7, sway);
        g.bezierCurveTo(-p.size * 1.2, sway + tSway, -p.size * 1.5, sway - tSway, -p.size * 2, sway + tSway * 1.5);
        g.stroke({ color: 0x8b5cf6, width: 2 + i % 2, alpha: 0.5 });
      }

    } else {
      drawPredatorStateful(g, p, totalTime);
    }
  }
  for (const [id, g] of cache) {
    if (!seen.has(id)) {
      g.destroy();
      cache.delete(id);
    }
  }
}

function syncPirates(
  parent: Container,
  cache: Map<string, Graphics>,
  list: readonly Pirate[],
  totalTime: number
): void {
  const seen = new Set<string>();
  for (const p of list) {
    seen.add(p.id);
    let g = cache.get(p.id);
    if (!g) {
      g = new Graphics();
      parent.addChild(g);
      cache.set(p.id, g);
    }
    g.clear();
    g.position.set(p.x, p.y);
    g.rotation = p.angle;

    g.moveTo(-34, 0);
    g.bezierCurveTo(-28, -14, 20, -14, 34, 0);
    g.bezierCurveTo(28, 12, -26, 12, -34, 0);
    g.fill({ color: 0x061018, alpha: 0.95 });

    const lanternIntensity = 0.55 + Math.sin(totalTime * 2 + p.lanternPhase) * 0.25;
    g.moveTo(34, -8);
    g.lineTo(128, -42);
    g.lineTo(128, 42);
    g.lineTo(34, 8);
    g.fill({ color: 0xfde68a, alpha: 0.18 * lanternIntensity });

    g.circle(34, 0, 4).fill({ color: 0xfff3a0, alpha: lanternIntensity });
  }
  for (const [id, g] of cache) {
    if (!seen.has(id)) {
      g.destroy();
      cache.delete(id);
    }
  }
}

function parseHex(input: string): number {
  if (input.startsWith("#")) return Number.parseInt(input.slice(1), 16);
  return Number.parseInt(input, 16);
}

/**
 * Draws a small white glyph inside the anomaly core that echoes the
 * buff's effect. Players learn the glyphs and read them at a glance
 * even when colour is washed out by depth tint.
 *
 *   repel       diamond ward  (4 outward rays)
 *   overdrive   forward chevron (speed)
 *   breath      lung wedge (oxygen)
 *   lure        inward arrows (collectibles drawn in)
 *   lamp-flare  starburst (radiating spokes)
 */
function drawAnomalyGlyph(
  g: Graphics,
  type: Anomaly["type"],
  r: number,
): void {
  const white = 0xffffff;
  const a = 0.95;
  const w = Math.max(1, r * 0.18);
  switch (type) {
    case "repel": {
      // Diamond ward
      const d = r * 0.4;
      g.moveTo(0, -d);
      g.lineTo(d, 0);
      g.lineTo(0, d);
      g.lineTo(-d, 0);
      g.lineTo(0, -d);
      g.stroke({ color: white, alpha: a, width: w });
      break;
    }
    case "overdrive": {
      // Forward chevron (>>)
      const dx = r * 0.3;
      const dy = r * 0.32;
      for (const off of [-dx * 0.4, dx * 0.4]) {
        g.moveTo(off - dx * 0.3, -dy);
        g.lineTo(off + dx * 0.3, 0);
        g.lineTo(off - dx * 0.3, dy);
        g.stroke({ color: white, alpha: a, width: w });
      }
      break;
    }
    case "breath": {
      // Stylised lung wedge — two arcs meeting at the centerline
      const d = r * 0.42;
      g.moveTo(0, -d);
      g.bezierCurveTo(d, -d * 0.5, d, d * 0.5, 0, d);
      g.bezierCurveTo(-d, d * 0.5, -d, -d * 0.5, 0, -d);
      g.stroke({ color: white, alpha: a, width: w });
      // Center line
      g.moveTo(0, -d * 0.7);
      g.lineTo(0, d * 0.7);
      g.stroke({ color: white, alpha: a, width: w });
      break;
    }
    case "lure": {
      // Four inward-pointing arrows around the centre
      const d = r * 0.5;
      const tip = r * 0.18;
      for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const sx = Math.cos(angle) * d;
        const sy = Math.sin(angle) * d;
        const ex = Math.cos(angle) * tip;
        const ey = Math.sin(angle) * tip;
        g.moveTo(sx, sy);
        g.lineTo(ex, ey);
        // Arrow head
        const headSize = r * 0.12;
        const headA = Math.atan2(sy - ey, sx - ex);
        g.lineTo(
          ex + Math.cos(headA + 0.5) * headSize,
          ey + Math.sin(headA + 0.5) * headSize,
        );
        g.moveTo(ex, ey);
        g.lineTo(
          ex + Math.cos(headA - 0.5) * headSize,
          ey + Math.sin(headA - 0.5) * headSize,
        );
        g.stroke({ color: white, alpha: a, width: w });
      }
      break;
    }
    case "lamp-flare": {
      // Eight-pointed radiating starburst
      const longR = r * 0.5;
      const shortR = r * 0.18;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const len = i % 2 === 0 ? longR : shortR;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
        g.stroke({ color: white, alpha: a, width: w });
      }
      break;
    }
  }
}

/**
 * Enemy submarine silhouette. Mirrors the player's articulated sub
 * shape (hull bezier + dome + lamp cone) but in adversary palette:
 * grungy iron hull, warn-red running lights, hostile cone in
 * warn-red. The lamp cone here is a "sweep" rather than a wide
 * spotlight — narrower, redder, more like a hunting beam.
 *
 * Drawn at the predator's local origin; caller positions/rotates the
 * Graphics container.
 */
function drawEnemySub(
  g: Graphics,
  size: number,
  totalTime: number,
  noiseOffset: number,
): void {
  // size from archetype is ~60. Scale internal proportions to match.
  const s = size / 28;

  // Hostile lamp cone — narrow, warn-red, sweeping wider on a slow
  // sine so the player reads "this thing is searching for me".
  const sweep = Math.sin(totalTime * 0.6 + noiseOffset) * 0.15 + 0.85;
  const coneLen = 90 * s;
  const coneSpread = 36 * s * sweep;
  g.moveTo(14 * s, 0);
  g.quadraticCurveTo(
    coneLen * 0.45,
    -coneSpread * 0.4,
    coneLen,
    -coneSpread,
  );
  g.lineTo(coneLen, coneSpread);
  g.quadraticCurveTo(
    coneLen * 0.45,
    coneSpread * 0.4,
    14 * s,
    0,
  );
  g.fill({ color: 0xff6b6b, alpha: 0.07 });
  g.moveTo(14 * s, 0);
  g.quadraticCurveTo(
    coneLen * 0.55,
    -coneSpread * 0.3,
    coneLen * 0.85,
    -coneSpread * 0.7,
  );
  g.lineTo(coneLen * 0.85, coneSpread * 0.7);
  g.quadraticCurveTo(
    coneLen * 0.55,
    coneSpread * 0.3,
    14 * s,
    0,
  );
  g.fill({ color: 0xff6b6b, alpha: 0.13 });

  // Pressure hull — same bezier silhouette as the player's sub but
  // in iron-grey + warn-red stroke.
  g.moveTo(28 * s, 0);
  g.bezierCurveTo(28 * s, -10 * s, 14 * s, -14 * s, 0, -14 * s);
  g.bezierCurveTo(-16 * s, -14 * s, -22 * s, -8 * s, -24 * s, -3 * s);
  g.lineTo(-24 * s, 3 * s);
  g.bezierCurveTo(-22 * s, 8 * s, -16 * s, 14 * s, 0, 14 * s);
  g.bezierCurveTo(14 * s, 14 * s, 28 * s, 10 * s, 28 * s, 0);
  g.fill({ color: 0x1a0608, alpha: 1 });
  g.stroke({ color: 0xff6b6b, alpha: 0.7, width: 1.5 });

  // Riveted plating — three faint warn-red lines at mid-line read
  // as paneling and reinforce the adversary palette.
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    g.moveTo(-20 * s, i * 4 * s);
    g.lineTo(20 * s, i * 4 * s);
    g.stroke({ color: 0xff6b6b, alpha: 0.18, width: 0.6 });
  }

  // Forward observation dome with an angry red eye behind it.
  g.circle(8 * s, -7 * s, 7 * s).fill({ color: 0x0a0204, alpha: 1 });
  g.circle(8 * s, -7 * s, 7 * s).stroke({
    color: 0xff6b6b,
    alpha: 0.85,
    width: 1,
  });
  // Eye pulse — lowest-frequency sine so it reads as a slow,
  // patient watch rather than a strobe.
  const eyePulse = 0.6 + 0.4 * Math.sin(totalTime * 1.2 + noiseOffset);
  g.circle(8 * s, -7 * s, 3.4 * s).fill({
    color: 0xff8a6a,
    alpha: eyePulse * 0.75,
  });

  // Stern propeller wash — three warn-red vanes spinning fast.
  const propPhase = totalTime * 6 + noiseOffset;
  for (let i = 0; i < 3; i++) {
    const a = propPhase + (i * Math.PI * 2) / 3;
    g.moveTo(-24 * s, 0);
    g.lineTo(-24 * s + Math.cos(a) * 6 * s, Math.sin(a) * 6 * s);
    g.stroke({ color: 0xff6b6b, alpha: 0.45, width: 1.5 });
  }
}

/**
 * Torpedo-eel: long sinusoidal body that *charges* on a line. The
 * forward third is a glowing red maw with twin headlights; the back
 * two-thirds is a wavering tail that ripples on a higher-frequency
 * sine than other predators so it reads as agile + tense.
 *
 * Posture responds to AI state. Stalk + charge tighten the tail
 * undulation and brighten the headlights; strike straightens the
 * spine and opens the maw; recover dims everything; flee whips the
 * tail at maximum amplitude.
 */
function drawTorpedoEel(
  g: Graphics,
  size: number,
  totalTime: number,
  noiseOffset: number,
  aiState?: import("@/sim/entities/types").PredatorAiState,
  stateProgress?: number,
): void {
  const state = aiState ?? "patrol";
  const progress = stateProgress ?? 0;
  // Tail amplitude + frequency are state-driven so an eel reads as
  // calm-coiled (patrol), tense-coiled (stalk/charge), straight-line
  // (strike), and panicked-thrashing (flee).
  let tailFreq = 4.5;
  let tailAmp = 0.18;
  let eyeColor = 0xff7a5a;
  let eyeAlpha = 0.6 + 0.4 * Math.sin(totalTime * 3 + noiseOffset);
  let strokeAlpha = 0.85;
  let mawOpen = 0;
  switch (state) {
    case "stalk":
      tailFreq = 5.5;
      tailAmp = 0.16;
      eyeColor = 0xff9f4a;
      strokeAlpha = 0.95;
      break;
    case "charge":
      tailFreq = 6.5;
      tailAmp = 0.1 + 0.06 * (1 - progress); // tail stiffens as charge peaks
      eyeColor = 0xff5a3a;
      eyeAlpha = 0.95;
      strokeAlpha = 1;
      mawOpen = progress * 0.7;
      break;
    case "strike":
      tailFreq = 7.5;
      tailAmp = 0.04; // straight as a torpedo
      eyeColor = 0xff3a2a;
      eyeAlpha = 1;
      strokeAlpha = 1;
      mawOpen = 1;
      break;
    case "recover":
      tailFreq = 2.5;
      tailAmp = 0.08;
      eyeColor = 0x7a4520;
      eyeAlpha = 0.35;
      strokeAlpha = 0.4;
      break;
    case "flee":
      tailFreq = 8;
      tailAmp = 0.28;
      eyeColor = 0xfff2c4;
      eyeAlpha = 1;
      strokeAlpha = 0.6;
      break;
    case "patrol":
    default:
      // Defaults already set
      break;
  }

  const segments = 9;
  const s = size / 32;
  // Tail ribbon — drawn back-to-front so the spine sits above the
  // wavering body.
  for (let i = segments; i >= 1; i--) {
    const t = i / segments;
    const x = -size * 0.6 * t;
    const wave = Math.sin(totalTime * tailFreq + i * 0.6 + noiseOffset) * size * tailAmp * t;
    const r = size * 0.18 * (1 - t * 0.7);
    g.circle(x, wave, r).fill({ color: 0x1a0408, alpha: 0.85 });
    g.circle(x, wave, r).stroke({
      color: 0xff5a3c,
      alpha: 0.45 * (1 - t * 0.5),
      width: 1.2,
    });
  }
  // Forward maw + skull
  g.ellipse(size * 0.18, 0, size * 0.32, size * 0.22).fill({
    color: 0x1a0408,
    alpha: 0.95,
  });
  g.ellipse(size * 0.18, 0, size * 0.32, size * 0.22).stroke({
    color: 0xff5a3c,
    alpha: strokeAlpha,
    width: 1.6,
  });
  // Twin red headlight eyes
  g.circle(size * 0.28, -size * 0.07, size * 0.07).fill({
    color: eyeColor,
    alpha: eyeAlpha,
  });
  g.circle(size * 0.28, size * 0.07, size * 0.07).fill({
    color: eyeColor,
    alpha: eyeAlpha,
  });
  // Eye glow halo during charge/strike
  if (state === "charge" || state === "strike") {
    const haloR = size * 0.18 * (1 + 0.4 * progress);
    g.circle(size * 0.28, 0, haloR).fill({
      color: eyeColor,
      alpha: 0.18 * eyeAlpha,
    });
  }
  // State-driven maw opening — additive to the existing fang line so
  // the eel reads as gaping during charge/strike.
  if (mawOpen > 0.05) {
    const mawHeight = size * 0.14 * mawOpen;
    g.moveTo(size * 0.42, -mawHeight);
    g.lineTo(size * 0.58, 0);
    g.lineTo(size * 0.42, mawHeight);
    g.fill({ color: 0x2a0410, alpha: 0.95 });
    // Fangs in the maw
    for (let i = 0; i < 3; i++) {
      const fx = size * 0.44 + i * size * 0.05;
      const fy = -mawHeight * (1 - i / 3);
      g.moveTo(fx, fy);
      g.lineTo(fx + size * 0.02, fy + mawHeight * 0.4);
      g.lineTo(fx + size * 0.04, fy);
      g.fill({ color: 0xfff2c4, alpha: 0.85 });
      g.moveTo(fx, -fy);
      g.lineTo(fx + size * 0.02, -fy - mawHeight * 0.4);
      g.lineTo(fx + size * 0.04, -fy);
      g.fill({ color: 0xfff2c4, alpha: 0.85 });
    }
  }
  // Open jaw — small triangular fang line
  g.moveTo(size * 0.4, -size * 0.05);
  g.lineTo(size * 0.5, 0);
  g.lineTo(size * 0.4, size * 0.05);
  g.stroke({ color: 0xff5a3c, alpha: 0.8, width: 1.5 });
  void s;
}

/**
 * Shadow-octopus: a bulb body with eight slowly-curling tentacles.
 * Body alpha breathes on a slow sine — at the troughs the creature
 * almost disappears, sells "flickers in/out of view" without an
 * actual visibility toggle.
 */
function drawShadowOctopus(
  g: Graphics,
  size: number,
  totalTime: number,
  noiseOffset: number,
  aiState?: import("@/sim/entities/types").PredatorAiState,
  stateProgress?: number,
): void {
  const state = aiState ?? "patrol";
  const progress = stateProgress ?? 0;
  // State-driven posture for the octopus:
  // - patrol: slow flicker, soft purple eyes, tentacles drift
  // - stalk: bulb solid, eyes brighten, tentacles flex inward (preparing
  //   to envelop)
  // - charge: tentacles snap into striking pose, eyes blaze white-violet
  // - strike: tentacles fully extended forward, mantle stretched
  // - recover: bulb deflates (small), eyes dim, tentacles dragging
  // - flee: tentacles curl inward defensively, body propels backward
  let flickerAmp = 0.45;
  let eyeColor = 0xc4b5fd;
  let eyeAlpha = 0.7;
  let strokeAlpha = 0.55;
  let tentacleCurlBias = 0;
  let tentacleSpeed = 1.4;
  let bulbScale = 1;
  let mantleStretch = 1;
  switch (state) {
    case "stalk":
      flickerAmp = 0.15; // less flickering, more solid
      eyeColor = 0xddd0ff;
      eyeAlpha = 0.95;
      strokeAlpha = 0.85;
      tentacleCurlBias = -0.3; // tentacles flex inward
      tentacleSpeed = 2.2;
      break;
    case "charge":
      flickerAmp = 0.1;
      eyeColor = 0xfff8c4;
      eyeAlpha = 1;
      strokeAlpha = 1;
      tentacleCurlBias = -0.55 - 0.3 * progress; // snap into strike pose
      tentacleSpeed = 3 + progress * 2;
      bulbScale = 1 + 0.08 * progress;
      mantleStretch = 1 + 0.1 * progress;
      break;
    case "strike":
      flickerAmp = 0;
      eyeColor = 0xffffff;
      eyeAlpha = 1;
      strokeAlpha = 1;
      tentacleCurlBias = -0.9; // fully extended forward
      tentacleSpeed = 5;
      bulbScale = 1.05;
      mantleStretch = 1.2;
      break;
    case "recover":
      flickerAmp = 0.6;
      eyeColor = 0x7d6db8;
      eyeAlpha = 0.3;
      strokeAlpha = 0.2;
      tentacleCurlBias = 0.4; // dragging
      tentacleSpeed = 0.6;
      bulbScale = 0.85;
      break;
    case "flee":
      flickerAmp = 0.3;
      eyeColor = 0xfff2c4;
      eyeAlpha = 0.9;
      strokeAlpha = 0.55;
      tentacleCurlBias = 0.7; // curl inward defensively
      tentacleSpeed = 4;
      bulbScale = 0.9;
      break;
    case "patrol":
    default:
      // Defaults already set
      break;
  }

  const flicker = (1 - flickerAmp) + flickerAmp * Math.sin(totalTime * 0.9 + noiseOffset);
  // Mantle bulb (state-scaled)
  g.ellipse(0, -size * 0.05, size * 0.45 * bulbScale, size * 0.55 * mantleStretch).fill({
    color: 0x100618,
    alpha: 0.9 * flicker,
  });
  g.ellipse(0, -size * 0.05, size * 0.45 * bulbScale, size * 0.55 * mantleStretch).stroke({
    color: 0x8b5cf6,
    alpha: strokeAlpha * flicker,
    width: 1.4,
  });
  // Two glowing eye-pits high on the bulb
  const finalEyeAlpha = eyeAlpha * flicker;
  g.circle(-size * 0.14, -size * 0.18, size * 0.06 * bulbScale).fill({
    color: eyeColor,
    alpha: finalEyeAlpha,
  });
  g.circle(size * 0.14, -size * 0.18, size * 0.06 * bulbScale).fill({
    color: eyeColor,
    alpha: finalEyeAlpha,
  });
  // Eye glow halo during charge/strike
  if (state === "charge" || state === "strike") {
    const haloR = size * 0.16 * (1 + 0.4 * progress);
    g.circle(-size * 0.14, -size * 0.18, haloR).fill({
      color: eyeColor,
      alpha: 0.16 * finalEyeAlpha,
    });
    g.circle(size * 0.14, -size * 0.18, haloR).fill({
      color: eyeColor,
      alpha: 0.16 * finalEyeAlpha,
    });
  }
  // Eight tentacles curling outward from the bulb base. State-driven
  // curl bias rotates the curl from "drifting outward" (positive bias)
  // through "neutral" (0) to "snapping forward" (negative bias).
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + noiseOffset * 0.1;
    const baseX = Math.cos(a) * size * 0.32;
    const baseY = size * 0.35 + Math.abs(Math.sin(a)) * size * 0.05;
    const curl = Math.sin(totalTime * tentacleSpeed + i + noiseOffset) * 0.6 + tentacleCurlBias;
    const tipLen = size * 0.55 * mantleStretch;
    const tipX = baseX + Math.cos(a + curl) * tipLen;
    const tipY = baseY + Math.sin(a + curl) * tipLen;
    const midX = (baseX + tipX) * 0.5 + Math.cos(a + Math.PI / 2) * size * 0.1 * curl;
    const midY = (baseY + tipY) * 0.5 + Math.sin(a + Math.PI / 2) * size * 0.1 * curl;
    g.moveTo(baseX, baseY);
    g.bezierCurveTo(
      baseX + (midX - baseX) * 0.5,
      baseY + (midY - baseY) * 0.5,
      midX,
      midY,
      tipX,
      tipY,
    );
    g.stroke({
      color: 0x8b5cf6,
      alpha: strokeAlpha * flicker,
      width: 2 + (i % 2 ? 0 : 1),
    });
  }
}

/**
 * State-driven predator silhouette. The single ellipse-and-fins draw
 * was a screensaver; emergent attackers need posture cues that read at
 * a glance:
 *
 * - **Patrol** — hull at rest tilt, eye at calm pulse.
 * - **Stalk** — body coils slightly; eye glows hotter; faint trail
 *   wake behind tail.
 * - **Charge** — windup posture: body S-curves, eye lights up to a
 *   hot orange, dust particles burst forward as the maw opens.
 *   `stateProgress` 0..1 drives the windup intensity.
 * - **Strike** — maw fully open, body straight-lined, motion blur
 *   trail behind. Brief and committed.
 * - **Recover** — body sags, eye dim; the predator is briefly
 *   vulnerable and visibly disoriented.
 * - **Flee** — tail lashes hard, body curves AWAY from forward, eye
 *   wide. Reads as "this thing is panicking."
 *
 * Renderer reads `p.aiState` + `p.stateProgress` from the sim. Both
 * fields are populated by the AIManager from each PredatorBrain's
 * StateMachine.
 */
function drawPredatorStateful(g: Graphics, p: Predator, totalTime: number): void {
  const state = p.aiState ?? "patrol";
  const progress = p.stateProgress ?? 0;

  // Visual modulation per state.
  // bodyTilt — sinusoidal undulation amplitude in radians.
  // bodyCoil — extra S-curve bend in the silhouette (radians).
  // eyeColor + eyeAlpha — emissive hint.
  // strokeAlpha — outline visibility.
  // mawOpen — 0..1 jaw separation.
  // trailIntensity — 0..1 tail wake density.
  let bodyTilt = 0.04;
  let bodyCoil = 0;
  let eyeColor = 0xfde68a;
  let eyeAlpha = 0.7 + 0.3 * Math.sin(totalTime * 1.4 + p.noiseOffset);
  let strokeAlpha = 0.36;
  let mawOpen = 0;
  let trailIntensity = 0.15;

  switch (state) {
    case "patrol":
      bodyTilt = 0.03 + 0.02 * Math.sin(totalTime * 0.8 + p.noiseOffset);
      break;
    case "stalk":
      bodyTilt = 0.05;
      bodyCoil = 0.12;
      eyeColor = 0xff9f4a;
      eyeAlpha = 0.85 + 0.15 * Math.sin(totalTime * 3 + p.noiseOffset);
      strokeAlpha = 0.5;
      trailIntensity = 0.35;
      break;
    case "charge":
      // Windup: body coils against a wall behind it, then springs
      // forward. progress 0..1 ramps tension.
      bodyTilt = 0.02;
      bodyCoil = 0.18 + 0.22 * progress;
      eyeColor = 0xff5a3a;
      eyeAlpha = 0.95;
      strokeAlpha = 0.7 + 0.3 * progress;
      mawOpen = progress * 0.8;
      trailIntensity = 0.2;
      break;
    case "strike":
      bodyTilt = 0.005;
      bodyCoil = -0.08; // straight-lined
      eyeColor = 0xff3a2a;
      eyeAlpha = 1;
      strokeAlpha = 1;
      mawOpen = 1;
      trailIntensity = 0.85;
      break;
    case "recover":
      bodyTilt = 0.08 * (1 - progress);
      bodyCoil = -0.04;
      eyeColor = 0x7a4520;
      eyeAlpha = 0.35 + 0.15 * Math.sin(totalTime * 1.2);
      strokeAlpha = 0.18;
      trailIntensity = 0.05;
      break;
    case "flee":
      bodyTilt = 0.12 + 0.08 * Math.sin(totalTime * 6);
      bodyCoil = -0.15;
      eyeColor = 0xfff2c4;
      eyeAlpha = 1;
      strokeAlpha = 0.4;
      trailIntensity = 0.65;
      break;
    case "ambient":
    default:
      bodyTilt = 0.02 + 0.02 * Math.sin(totalTime * 0.5);
      break;
  }

  const undulation = bodyTilt * Math.sin(totalTime * 4 + p.noiseOffset);
  const coilOffset = bodyCoil * p.size * 0.4;

  // ---- Trail wake (drawn first so it sits behind the body) -----------
  if (trailIntensity > 0.05) {
    const segments = 5;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = -p.size * (0.6 + t * 0.8);
      const y = Math.sin(totalTime * 5 + p.noiseOffset + t * 2) * p.size * 0.18 * trailIntensity;
      g.circle(x, y, p.size * 0.05 * (1 - t)).fill({
        color: 0x6be6c1,
        alpha: 0.18 * trailIntensity * (1 - t),
      });
    }
  }

  // ---- Body — bezier-coiled silhouette with vertical undulation -----
  const halfW = p.size * 0.7;
  const halfH = p.size * 0.3;

  g.moveTo(halfW, undulation);
  g.bezierCurveTo(
    halfW * 0.7,
    -halfH + undulation,
    -halfW * 0.4,
    -halfH * 1.1 + coilOffset,
    -halfW * 0.85,
    -halfH * 0.4 + undulation,
  );
  g.lineTo(-halfW * 0.85, halfH * 0.4 + undulation);
  g.bezierCurveTo(
    -halfW * 0.4,
    halfH * 1.1 + coilOffset,
    halfW * 0.7,
    halfH + undulation,
    halfW,
    undulation,
  );
  g.fill({ color: 0x0c0508, alpha: 0.95 });
  g.stroke({ color: 0xff6b6b, alpha: strokeAlpha, width: 1.4 });

  // ---- Dorsal + belly fins (slight coil response) -------------------
  g.moveTo(-p.size * 0.05, -p.size * 0.28 + undulation);
  g.lineTo(p.size * 0.15, -p.size * (0.5 + bodyCoil * 0.4) + undulation);
  g.lineTo(p.size * 0.3, -p.size * 0.28 + undulation);
  g.fill({ color: 0x050207, alpha: 0.98 });

  g.moveTo(p.size * 0.05, p.size * 0.22 + undulation);
  g.lineTo(p.size * 0.22, p.size * (0.42 + bodyCoil * 0.3) + undulation);
  g.lineTo(p.size * 0.34, p.size * 0.22 + undulation);
  g.fill({ color: 0x050207, alpha: 0.9 });

  // ---- Tail — fans wider during stalk/strike, stiff during recover -
  const tailFan = state === "strike" ? 0.42 : state === "stalk" ? 0.38 : 0.32;
  g.moveTo(-p.size * 0.55, undulation);
  g.lineTo(-p.size * 0.98, -p.size * tailFan + undulation);
  g.lineTo(-p.size * 0.78, undulation);
  g.lineTo(-p.size * 0.96, p.size * tailFan + undulation);
  g.lineTo(-p.size * 0.55, undulation);
  g.fill({ color: 0x050207, alpha: 0.97 });

  // ---- Gills — bright in charge, faint in recover -------------------
  const gillAlpha = state === "charge" ? 0.8 : state === "recover" ? 0.15 : 0.45;
  g.moveTo(p.size * 0.05, -p.size * 0.08 + undulation);
  g.lineTo(p.size * 0.15, p.size * 0.05 + undulation);
  g.lineTo(p.size * 0.12, -p.size * 0.12 + undulation);
  g.lineTo(p.size * 0.22, undulation);
  g.stroke({ color: 0xff6b6b, alpha: gillAlpha, width: 1 });

  // ---- Maw — opens during charge windup, fully open in strike ------
  if (mawOpen > 0.05) {
    const mawHeight = p.size * 0.18 * mawOpen;
    const mawX = p.size * 0.62;
    g.moveTo(mawX, -mawHeight + undulation);
    g.lineTo(p.size * 0.95, undulation);
    g.lineTo(mawX, mawHeight + undulation);
    g.fill({ color: 0x2a0410, alpha: 0.95 });
    // Teeth
    const toothCount = 5;
    for (let i = 0; i < toothCount; i++) {
      const tx = mawX + (i / toothCount) * (p.size * 0.32);
      const ty = -mawHeight * (1 - i / toothCount) + undulation;
      g.moveTo(tx, ty);
      g.lineTo(tx + p.size * 0.025, ty + mawHeight * 0.45);
      g.lineTo(tx + p.size * 0.05, ty);
      g.fill({ color: 0xfff2c4, alpha: 0.8 });
      // Mirror on lower jaw
      g.moveTo(tx, -ty + 2 * undulation);
      g.lineTo(tx + p.size * 0.025, -ty + 2 * undulation - mawHeight * 0.45);
      g.lineTo(tx + p.size * 0.05, -ty + 2 * undulation);
      g.fill({ color: 0xfff2c4, alpha: 0.8 });
    }
  }

  // ---- Eye — colour modulated by state ------------------------------
  const eyeR = p.size * 0.1 * (state === "strike" || state === "charge" ? 1.15 : 1);
  g.circle(p.size * 0.55, -p.size * 0.08 + undulation, eyeR).fill({
    color: eyeColor,
    alpha: eyeAlpha,
  });
  g.circle(p.size * 0.58, -p.size * 0.08 + undulation, p.size * 0.045).fill({
    color: 0x050207,
    alpha: 1,
  });

  // ---- Eye glow halo during charge/strike — sells emissive intent --
  if (state === "charge" || state === "strike") {
    const haloR = p.size * 0.22 * (1 + 0.4 * progress);
    g.circle(p.size * 0.55, -p.size * 0.08 + undulation, haloR).fill({
      color: eyeColor,
      alpha: 0.18 * eyeAlpha,
    });
  }

  // ---- Death bubbles — emitted from the body during sink-and-fade
  //   so the player can SEE the kill instead of just noticing the
  //   silhouette vanish. Bubbles drift up + outward at a phase tied
  //   to the noiseOffset so each predator dies with its own pattern.
  const deathProg = p.deathProgress ?? 0;
  if (deathProg > 0.02) {
    const bubbleCount = 6;
    for (let i = 0; i < bubbleCount; i++) {
      const phase = (i / bubbleCount) * Math.PI * 2 + p.noiseOffset;
      // Bubble rise scales with progress — at progress=1 they've
      // drifted ~60px above the body's start position. Negate sin
      // so y decreases (visually "up").
      const rise = -deathProg * 60 - Math.sin(phase * 3) * 8;
      const drift = Math.cos(phase + deathProg * 4) * deathProg * 24;
      const r = p.size * 0.05 * (1 - deathProg * 0.5);
      g.circle(drift, rise, r).fill({
        color: 0xd9f2ec,
        alpha: 0.65 * (1 - deathProg),
      });
    }
  }

  // ---- Damage cracks — accumulate as the lamp wears the predator
  //   down. Three pseudo-random kerf lines across the body, each
  //   appearing at successive damage thresholds (33%, 66%, 95%) so
  //   the player visibly sees the lamp working before the predator
  //   actually breaks off.
  const dmg = p.damageFraction ?? 0;
  if (dmg > 0.05) {
    const noise = p.noiseOffset;
    const crackThresholds = [0.33, 0.66, 0.95];
    for (let i = 0; i < crackThresholds.length; i++) {
      if (dmg < crackThresholds[i] - 0.05) continue;
      const phase = noise + i * 1.7;
      const x0 = -p.size * 0.45 + Math.cos(phase) * p.size * 0.2;
      const y0 = Math.sin(phase * 1.3) * p.size * 0.18 + undulation;
      const x1 = -p.size * 0.15 + Math.cos(phase * 0.7) * p.size * 0.18;
      const y1 = Math.sin(phase * 0.9) * p.size * 0.14 + undulation;
      const x2 = p.size * 0.2 + Math.cos(phase * 1.1) * p.size * 0.18;
      const y2 = Math.sin(phase * 1.4) * p.size * 0.16 + undulation;
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.lineTo(x2, y2);
      const crackAlpha = Math.min(1, (dmg - (crackThresholds[i] - 0.1)) / 0.2);
      g.stroke({ color: 0xff8a4a, alpha: 0.85 * crackAlpha, width: 1.2 });
    }
  }
}
