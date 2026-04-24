import { Graphics } from "pixi.js";
import type { Creature } from "@/sim/entities/types";

// Very simple string hash for seed generation
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h;
}

// Simple LCG PRNG
export function createLocalRng(seed: number) {
  let state = seed >>> 0;
  return function nextFloat() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function drawProceduralCreature(g: Graphics, c: Creature, bodyColor: number, glowColor: number) {
  const rng = createLocalRng(hashString(c.id));
  
  if (c.type === "jellyfish") {
    drawProceduralJellyfish(g, c, rng, bodyColor, glowColor);
  } else if (c.type === "plankton") {
    drawProceduralPlankton(g, c, rng, glowColor);
  } else {
    drawProceduralFish(g, c, rng, bodyColor, glowColor);
  }
}

function drawProceduralJellyfish(g: Graphics, c: Creature, rng: () => number, bodyColor: number, glowColor: number) {
  const pulse = 1 + Math.sin(c.pulsePhase) * 0.06;
  const bellW = c.size * 0.58 * pulse;
  
  // Procedural features
  const isElongated = rng() > 0.5;
  const bellH = c.size * (isElongated ? 0.6 : 0.44) * (2 - pulse);
  const tentacleCount = 4 + Math.floor(rng() * 5); // 4 to 8
  const hasInnerGlow = rng() > 0.3;
  const bellShape = rng(); // 0-0.33 round, 0.33-0.66 flat, 0.66-1.0 pointy

  // Dome body
  g.ellipse(0, -c.size * 0.08, bellW, bellH).fill({ color: bodyColor, alpha: 0.88 });
  
  if (hasInnerGlow) {
    g.ellipse(0, -c.size * 0.14, bellW * 0.82, bellH * 0.72).fill({
      color: glowColor,
      alpha: 0.22,
    });
  }
  
  // Pointy or flat top variation
  if (bellShape > 0.66) {
    g.moveTo(-bellW * 0.5, -c.size * 0.08);
    g.bezierCurveTo(-bellW * 0.2, -c.size * 0.3, bellW * 0.2, -c.size * 0.3, bellW * 0.5, -c.size * 0.08);
    g.stroke({ color: glowColor, alpha: 0.85, width: 1.4 });
  } else {
    g.ellipse(0, -c.size * 0.08, bellW, bellH).stroke({
      color: glowColor,
      alpha: 0.85,
      width: 1.4,
    });
  }
  
  // Crown highlight
  g.ellipse(-c.size * 0.12, -c.size * 0.22, bellW * 0.3, bellH * 0.22).fill({
    color: 0xd9f2ec,
    alpha: 0.35,
  });

  // Trailing tentacles
  for (let i = 0; i < tentacleCount; i++) {
    const xRatio = (i / (tentacleCount - 1)) * 2 - 1; // -1 to 1
    const x = xRatio * c.size * 0.25;
    const sway = Math.sin(c.pulsePhase * 0.8 + i * 0.7) * c.size * 0.14;
    g.moveTo(x, c.size * 0.1);
    
    // Some tentacles are longer
    const lengthMult = 1.0 + rng() * 0.8;
    g.bezierCurveTo(
      x + sway,
      c.size * 0.55 * lengthMult,
      x - sway * 0.9,
      c.size * 1.0 * lengthMult,
      x + sway * 0.3,
      c.size * 1.45 * lengthMult
    );
    const alpha = (i === 0 || i === tentacleCount - 1) ? 0.7 : 0.5;
    const width = rng() > 0.5 ? 1.35 : 0.8;
    g.stroke({ color: glowColor, alpha, width });
  }
}

function drawProceduralPlankton(g: Graphics, c: Creature, rng: () => number, glowColor: number) {
  const count = 3 + Math.floor(rng() * 5); // 3 to 7 nodes
  const spread = 0.5 + rng() * 0.5;
  const centralCore = rng() > 0.5;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + c.pulsePhase * 0.3;
    const dist = c.size * spread;
    g.circle(Math.cos(angle) * dist, Math.sin(angle) * dist, c.size * (0.15 + rng() * 0.1)).fill({
      color: glowColor,
      alpha: 0.7 + rng() * 0.2,
    });
    
    // Connecting filaments
    if (centralCore) {
      g.moveTo(0, 0);
      g.lineTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
      g.stroke({ color: glowColor, alpha: 0.3, width: 1 });
    }
  }
  
  if (centralCore) {
    g.circle(0, 0, c.size * 0.3).fill({ color: glowColor, alpha: 0.6 });
  }
}

function drawProceduralFish(g: Graphics, c: Creature, rng: () => number, bodyColor: number, glowColor: number) {
  const beat = Math.sin(c.pulsePhase * 2) * 0.04;
  
  // Body shape parameters
  const isElongated = rng() > 0.6;
  const isChunky = rng() > 0.7;
  const bodyLen = c.size * (isElongated ? 0.9 : 0.72) * (1 + beat);
  const bodyH = c.size * (isChunky ? 0.45 : 0.3) * (1 - beat * 0.4);

  // Fin parameters
  const hasDorsal = rng() > 0.2;
  const dorsalType = rng();
  const hasVentral = rng() > 0.3;
  const tailType = rng(); // 0-0.33 forked, 0.33-0.66 rounded, 0.66-1.0 ribbon
  
  // Extra features
  const hasAnglerLight = rng() > 0.8;
  const hasJaws = rng() > 0.7;
  const glowingSpots = rng() > 0.5;
  const stripeStyle = rng(); // 0-0.33 bottom, 0.33-0.66 middle, 0.66-1.0 none

  // Tail
  const tailSway = Math.sin(c.pulsePhase * 2) * c.size * 0.08;
  if (tailType < 0.33) {
    // Forked
    g.moveTo(-bodyLen * 0.75, 0);
    g.lineTo(-bodyLen * 1.35, -bodyH * 0.9 + tailSway);
    g.lineTo(-bodyLen * 1.15, 0);
    g.lineTo(-bodyLen * 1.35, bodyH * 0.9 + tailSway);
    g.fill({ color: bodyColor, alpha: 0.9 });
  } else if (tailType < 0.66) {
    // Rounded / Fan
    g.moveTo(-bodyLen * 0.75, 0);
    g.bezierCurveTo(
      -bodyLen * 1.4, -bodyH * 0.8 + tailSway,
      -bodyLen * 1.4, bodyH * 0.8 + tailSway,
      -bodyLen * 0.75, 0
    );
    g.fill({ color: bodyColor, alpha: 0.9 });
  } else {
    // Ribbon
    g.moveTo(-bodyLen * 0.75, 0);
    g.quadraticCurveTo(-bodyLen * 1.2, tailSway, -bodyLen * 1.6, tailSway * 2);
    g.stroke({ color: bodyColor, width: bodyH * 0.5, alpha: 0.9 });
  }

  // Dorsal fin
  if (hasDorsal) {
    if (dorsalType < 0.5) {
      // Triangle
      g.moveTo(-c.size * 0.08, -bodyH * 0.85);
      g.lineTo(c.size * 0.05, -bodyH * 1.6);
      g.lineTo(c.size * 0.2, -bodyH * 0.85);
      g.fill({ color: bodyColor, alpha: 0.85 });
    } else {
      // Long sweeping
      g.moveTo(-bodyLen * 0.4, -bodyH * 0.7);
      g.quadraticCurveTo(0, -bodyH * 1.5, bodyLen * 0.3, -bodyH * 0.8);
      g.fill({ color: bodyColor, alpha: 0.85 });
    }
  }

  // Ventral fin
  if (hasVentral) {
    g.moveTo(-c.size * 0.02, bodyH * 0.85);
    g.lineTo(c.size * 0.08, bodyH * 1.4);
    g.lineTo(c.size * 0.18, bodyH * 0.85);
    g.fill({ color: bodyColor, alpha: 0.75 });
  }

  // Body
  g.ellipse(c.size * 0.05, 0, bodyLen, bodyH).fill({ color: bodyColor, alpha: 0.96 });
  g.ellipse(c.size * 0.05, 0, bodyLen, bodyH).stroke({
    color: glowColor,
    alpha: 0.85,
    width: 1.2,
  });

  // Jaws
  if (hasJaws) {
    g.moveTo(bodyLen * 0.8, -bodyH * 0.2);
    g.lineTo(bodyLen * 1.1, -bodyH * 0.1);
    g.lineTo(bodyLen * 0.8, 0);
    g.lineTo(bodyLen * 1.05, bodyH * 0.1);
    g.lineTo(bodyLen * 0.8, bodyH * 0.2);
    g.stroke({ color: 0xd9f2ec, width: 1, alpha: 0.8 });
  }

  // Angler Light
  if (hasAnglerLight) {
    g.moveTo(bodyLen * 0.5, -bodyH * 0.8);
    g.quadraticCurveTo(bodyLen * 1.0, -bodyH * 1.8, bodyLen * 1.3, -bodyH * 0.5);
    g.stroke({ color: bodyColor, width: 1.5, alpha: 0.9 });
    
    // Bulb
    g.circle(bodyLen * 1.3, -bodyH * 0.5, c.size * 0.15).fill({ color: glowColor, alpha: 0.9 });
    g.circle(bodyLen * 1.3, -bodyH * 0.5, c.size * 0.05).fill({ color: 0xffffff, alpha: 1.0 });
  }

  // Bioluminescent patterns
  if (stripeStyle < 0.33) {
    // Belly stripe
    g.moveTo(-bodyLen * 0.55, bodyH * 0.55);
    g.lineTo(bodyLen * 0.55, bodyH * 0.35);
    g.stroke({ color: glowColor, alpha: 0.75, width: 1.3 });
  } else if (stripeStyle < 0.66) {
    // Midline stripe
    g.moveTo(-bodyLen * 0.6, 0);
    g.quadraticCurveTo(0, -bodyH * 0.2, bodyLen * 0.6, 0);
    g.stroke({ color: glowColor, alpha: 0.75, width: 1.3 });
  }

  if (glowingSpots) {
    const spotCount = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < spotCount; i++) {
      const sx = -bodyLen * 0.5 + (i / spotCount) * bodyLen;
      const sy = -bodyH * 0.4 + rng() * bodyH * 0.8;
      g.circle(sx, sy, c.size * 0.04).fill({ color: glowColor, alpha: 0.8 });
    }
  }

  // Eye
  const eyeX = c.size * 0.34;
  const eyeY = -c.size * 0.06;
  g.circle(eyeX, eyeY, c.size * 0.07).fill({ color: 0xfffbea, alpha: 1 });
  
  // Pupil direction slightly varies
  const pupilOffset = hasJaws ? c.size * 0.03 : 0;
  g.circle(eyeX + pupilOffset, eyeY, c.size * 0.03).fill({ color: 0x050a14, alpha: 1 });
}
