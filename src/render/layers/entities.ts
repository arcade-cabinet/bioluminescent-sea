import { Container, Graphics } from "pixi.js";
import type { Camera } from "@/render/camera";
import type {
  Creature,
  Pirate,
  Predator,
} from "@/sim/entities/types";

/**
 * Entity layer — creatures, predators, pirates.
 *
 * Each simulation entity has a persistent pixi Graphics; the bridge
 * updates its position/rotation/alpha each frame. Entities that
 * disappear from the simulation (collected creature, retired pirate)
 * get removed from the stage in the same sync pass.
 *
 * When a creature carries `worldYMeters` (emitted by chunked-spawn
 * but not by the legacy seeded spawner), the layer projects it
 * through `camera.project({ x, y: worldYMeters, z: 0 })` so the
 * creature scrolls with descent. Creatures without `worldYMeters`
 * keep using their viewport-space `y` — that's how the legacy
 * 18-fixed-creatures scene stays playable until the sim migration.
 * Predators and pirates stay viewport-space for now; they move to
 * world-space in a follow-up.
 */

export interface EntityController {
  sync(args: {
    creatures: readonly Creature[];
    predators: readonly Predator[];
    pirates: readonly Pirate[];
    totalTime: number;
    /**
     * Live camera from the bridge. Used to project creatures whose
     * trait carries `worldYMeters`. Optional for tests that mount
     * the layer in isolation.
     */
    camera?: Camera;
  }): void;
  destroy(): void;
}

export function mountEntities(parent: Container): EntityController {
  const creatures = new Map<string, Graphics>();
  const predators = new Map<string, Graphics>();
  const pirates = new Map<string, Graphics>();

  return {
    sync({ creatures: cs, predators: ps, pirates: ks, totalTime, camera }) {
      syncCreatures(parent, creatures, cs, camera);
      syncPredators(parent, predators, ps);
      syncPirates(parent, pirates, ks, totalTime);
    },
    destroy() {
      for (const g of creatures.values()) g.destroy();
      for (const g of predators.values()) g.destroy();
      for (const g of pirates.values()) g.destroy();
      creatures.clear();
      predators.clear();
      pirates.clear();
    },
  };
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
    // When the creature was spawned by a chunk-aware factory it
    // carries `worldYMeters`; project the Y through the camera so
    // the creature scrolls vertically with descent. X stays in
    // the sim-provided viewport-pixel space — the sim + X-axis
    // are still viewport-bound until the full world-space
    // migration lands. Legacy seeded creatures (no
    // `worldYMeters`) keep using their viewport-space y unchanged.
    if (camera && c.worldYMeters !== undefined) {
      const projected = camera.project({ x: 0, y: c.worldYMeters, z: 0 });
      g.position.set(c.x, projected.y);
    } else {
      g.position.set(c.x, c.y);
    }
    g.rotation = Math.sin(c.pulsePhase * 0.45) * 0.16;

    const glowRadius = c.size * 2.4;
    const glowColor = parseHex(c.glowColor);
    // Soft glow halo — stacked alpha rings cheaper than blurFilter.
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 3;
      g.circle(0, 0, glowRadius * t).fill({
        color: glowColor,
        alpha: c.glowIntensity * 0.12 * (1 - t),
      });
    }

    if (c.type === "jellyfish") drawJellyfish(g, c);
    else if (c.type === "plankton") drawPlankton(g, c);
    else drawGlowFish(g, c);
  }

  for (const [id, g] of cache) {
    if (!seen.has(id)) {
      g.destroy();
      cache.delete(id);
    }
  }
}

function drawJellyfish(g: Graphics, c: Creature): void {
  const bellColor = parseHex(c.color);
  const strokeColor = parseHex(c.glowColor);

  // Pulse-driven bell squash — 6% swell on contraction gives the
  // jellyfish a living rhythm instead of a static ellipse.
  const pulse = 1 + Math.sin(c.pulsePhase) * 0.06;
  const bellW = c.size * 0.58 * pulse;
  const bellH = c.size * 0.44 * (2 - pulse);

  // Dome body — layered fills: dark rim, mid body, bright crown.
  g.ellipse(0, -c.size * 0.08, bellW, bellH).fill({ color: bellColor, alpha: 0.88 });
  g.ellipse(0, -c.size * 0.14, bellW * 0.82, bellH * 0.72).fill({
    color: strokeColor,
    alpha: 0.22,
  });
  g.ellipse(0, -c.size * 0.08, bellW, bellH).stroke({
    color: strokeColor,
    alpha: 0.85,
    width: 1.4,
  });
  // Crown highlight — one pixel of life on top.
  g.ellipse(-c.size * 0.12, -c.size * 0.22, bellW * 0.3, bellH * 0.22).fill({
    color: 0xd9f2ec,
    alpha: 0.35,
  });

  // Trailing tentacles — five strands with sinusoidal sway.
  for (let i = -2; i <= 2; i++) {
    const x = i * c.size * 0.18;
    const sway = Math.sin(c.pulsePhase * 0.8 + i * 0.7) * c.size * 0.14;
    g.moveTo(x, c.size * 0.1);
    g.bezierCurveTo(
      x + sway,
      c.size * 0.55,
      x - sway * 0.9,
      c.size * 1.0,
      x + sway * 0.3,
      c.size * 1.45
    );
    const alpha = i === 0 ? 0.7 : 0.5;
    const width = i === 0 ? 1.35 : 1.05;
    g.stroke({ color: strokeColor, alpha, width });
  }
}

function drawPlankton(g: Graphics, c: Creature): void {
  const color = parseHex(c.glowColor);
  const count = 5;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + c.pulsePhase * 0.3;
    const dist = c.size * 0.7;
    g.circle(Math.cos(angle) * dist, Math.sin(angle) * dist, c.size * 0.22).fill({
      color,
      alpha: 0.85,
    });
  }
  g.circle(0, 0, c.size * 0.35).fill({ color, alpha: 0.6 });
}

function drawGlowFish(g: Graphics, c: Creature): void {
  const body = parseHex(c.color);
  const glow = parseHex(c.glowColor);

  // Tail beat drives a subtle longitudinal squash.
  const beat = Math.sin(c.pulsePhase * 2) * 0.04;
  const bodyLen = c.size * 0.72 * (1 + beat);
  const bodyH = c.size * 0.3 * (1 - beat * 0.4);

  // Teardrop body — ellipse + nose taper up front.
  g.ellipse(c.size * 0.05, 0, bodyLen, bodyH).fill({ color: body, alpha: 0.96 });
  g.ellipse(c.size * 0.05, 0, bodyLen, bodyH).stroke({
    color: glow,
    alpha: 0.85,
    width: 1.2,
  });

  // Dorsal fin — single triangle on top, gives the fish a top silhouette.
  g.moveTo(-c.size * 0.08, -bodyH * 0.85);
  g.lineTo(c.size * 0.05, -bodyH * 1.6);
  g.lineTo(c.size * 0.2, -bodyH * 0.85);
  g.fill({ color: body, alpha: 0.85 });

  // Ventral fin — mirror, slightly smaller.
  g.moveTo(-c.size * 0.02, bodyH * 0.85);
  g.lineTo(c.size * 0.08, bodyH * 1.35);
  g.lineTo(c.size * 0.18, bodyH * 0.85);
  g.fill({ color: body, alpha: 0.75 });

  // Forked tail with beat offset — sway syncs to body beat.
  const tailSway = Math.sin(c.pulsePhase * 2) * c.size * 0.08;
  g.moveTo(-bodyLen * 0.75, 0);
  g.lineTo(-bodyLen * 1.35, -bodyH * 0.9 + tailSway);
  g.lineTo(-bodyLen * 1.15, 0);
  g.lineTo(-bodyLen * 1.35, bodyH * 0.9 + tailSway);
  g.lineTo(-bodyLen * 0.75, 0);
  g.fill({ color: body, alpha: 0.9 });

  // Bioluminescent stripe along the belly — the name's payoff.
  g.moveTo(-bodyLen * 0.55, bodyH * 0.55);
  g.lineTo(bodyLen * 0.55, bodyH * 0.35);
  g.stroke({ color: glow, alpha: 0.75, width: 1.3 });

  // Eye — white with a dark pupil for contrast.
  g.circle(c.size * 0.34, -c.size * 0.06, c.size * 0.07).fill({
    color: 0xfffbea,
    alpha: 1,
  });
  g.circle(c.size * 0.37, -c.size * 0.06, c.size * 0.03).fill({
    color: 0x050a14,
    alpha: 1,
  });
}

function syncPredators(
  parent: Container,
  cache: Map<string, Graphics>,
  list: readonly Predator[]
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

    // Main body — darker than any creature so the silhouette
    // reads as a threat against the glow.
    g.ellipse(0, 0, p.size * 0.7, p.size * 0.3).fill({
      color: 0x081018,
      alpha: 0.92,
    });
    g.ellipse(0, 0, p.size * 0.7, p.size * 0.3).stroke({
      color: 0x6be6c1,
      alpha: 0.28,
      width: 1.4,
    });

    // Dorsal fin — the first thing a player should recognize.
    g.moveTo(-p.size * 0.05, -p.size * 0.28);
    g.lineTo(p.size * 0.15, -p.size * 0.55);
    g.lineTo(p.size * 0.3, -p.size * 0.28);
    g.fill({ color: 0x050a12, alpha: 0.98 });

    // Pectoral fin — under-hang that reads as "not a fish."
    g.moveTo(p.size * 0.05, p.size * 0.22);
    g.lineTo(p.size * 0.22, p.size * 0.45);
    g.lineTo(p.size * 0.34, p.size * 0.22);
    g.fill({ color: 0x050a12, alpha: 0.9 });

    // Forked tail — sharp triangular cut.
    g.moveTo(-p.size * 0.55, 0);
    g.lineTo(-p.size * 0.98, -p.size * 0.32);
    g.lineTo(-p.size * 0.78, 0);
    g.lineTo(-p.size * 0.96, p.size * 0.32);
    g.lineTo(-p.size * 0.55, 0);
    g.fill({ color: 0x050a12, alpha: 0.97 });

    // Jagged gill line — adds menace without ink-draw overhead.
    g.moveTo(p.size * 0.05, -p.size * 0.08);
    g.lineTo(p.size * 0.15, p.size * 0.05);
    g.lineTo(p.size * 0.12, -p.size * 0.12);
    g.lineTo(p.size * 0.22, 0);
    g.stroke({ color: 0x6be6c1, alpha: 0.35, width: 1 });

    // Eye — amber, warm-cold contrast against the hull.
    g.circle(p.size * 0.55, -p.size * 0.08, p.size * 0.1).fill({
      color: 0xfde68a,
      alpha: 0.9,
    });
    g.circle(p.size * 0.58, -p.size * 0.08, p.size * 0.045).fill({
      color: 0x050a12,
      alpha: 1,
    });
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

    // Hull silhouette
    g.moveTo(-34, 0);
    g.bezierCurveTo(-28, -14, 20, -14, 34, 0);
    g.bezierCurveTo(28, 12, -26, 12, -34, 0);
    g.fill({ color: 0x061018, alpha: 0.95 });

    // Lantern cone
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
