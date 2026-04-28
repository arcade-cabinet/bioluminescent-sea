import { describe, expect, test } from "vitest";
import { collectOccluders, type Occluder } from "../occluders";
import type { Anomaly, Predator } from "@/sim/entities/types";
import { createInitialScene, type SceneState, type ViewportDimensions } from "@/sim/dive";

/**
 * `collectOccluders(scene, dimensions, perceiverEntityId?, lockedRoom?)`
 * is a pure scene → Occluder[] reduction.
 *
 * Three occluder classes:
 * - debris: scene.anomalies.filter(a => a.type === "repel"), radius = size × 1.4
 * - leviathan: scene.predators.filter(p => p.isLeviathan), radius = p.size
 * - wall: 4 segments framing the viewport rect when lockedRoom === true
 *
 * The optional `perceiverEntityId` parameter excludes that entity's own
 * leviathan entry so a leviathan doesn't occlude its own line-of-sight.
 */

const VIEWPORT: ViewportDimensions = { width: 800, height: 600 };

function makeScene(overrides: Partial<SceneState> = {}): SceneState {
  // Use the engine's own initial-scene factory so Player and friends
  // are fully populated, then layer overrides.
  return { ...createInitialScene(VIEWPORT), ...overrides };
}

const isDebris = (o: Occluder): o is Extract<Occluder, { kind: "debris" }> => o.kind === "debris";
const isLeviathan = (o: Occluder): o is Extract<Occluder, { kind: "leviathan" }> => o.kind === "leviathan";
const isWall = (o: Occluder): o is Extract<Occluder, { kind: "wall" }> => o.kind === "wall";

describe("collectOccluders — debris", () => {
  test("scene with no anomalies yields no debris occluders", () => {
    expect(collectOccluders(makeScene(), VIEWPORT).filter(isDebris)).toEqual([]);
  });

  test("repel anomaly produces a debris occluder", () => {
    const a: Anomaly = {
      id: "rep-1",
      type: "repel",
      x: 100,
      y: 100,
      size: 20,
      pulsePhase: 0,
    };
    const out = collectOccluders(makeScene({ anomalies: [a] }), VIEWPORT);
    const debris = out.filter(isDebris);
    expect(debris.length).toBe(1);
    expect(debris[0]).toMatchObject({ kind: "debris", x: 100, y: 100, radius: 28 }); // 20 × 1.4
  });

  test("non-repel anomalies do not occlude", () => {
    const types = ["overdrive", "breath", "lure", "lamp-flare"] as const;
    const anomalies: Anomaly[] = types.map((type, i) => ({
      id: `a-${i}`,
      type,
      x: i * 50,
      y: 0,
      size: 20,
      pulsePhase: 0,
    }));
    expect(collectOccluders(makeScene({ anomalies }), VIEWPORT).filter(isDebris)).toEqual([]);
  });

  test("multiple repel anomalies produce multiple debris occluders", () => {
    const anomalies: Anomaly[] = Array.from({ length: 3 }, (_, i) => ({
      id: `rep-${i}`,
      type: "repel",
      x: i * 100,
      y: 0,
      size: 10,
      pulsePhase: 0,
    }));
    expect(collectOccluders(makeScene({ anomalies }), VIEWPORT).filter(isDebris).length).toBe(3);
  });
});

describe("collectOccluders — leviathan", () => {
  function makePredator(id: string, isLev: boolean, x = 0, y = 0, size = 80): Predator {
    return { id, x, y, size, speed: 10, noiseOffset: 0, angle: 0, isLeviathan: isLev };
  }

  test("isLeviathan=true predator produces a leviathan occluder", () => {
    const out = collectOccluders(
      makeScene({ predators: [makePredator("lev-1", true, 200, 200, 80)] }),
      VIEWPORT,
    );
    const lev = out.filter(isLeviathan);
    expect(lev.length).toBe(1);
    expect(lev[0]).toMatchObject({ kind: "leviathan", x: 200, y: 200, radius: 80 });
  });

  test("isLeviathan=false predator does NOT occlude", () => {
    expect(
      collectOccluders(makeScene({ predators: [makePredator("nope", false)] }), VIEWPORT)
        .filter(isLeviathan),
    ).toEqual([]);
  });

  test("perceiverEntityId excludes self-leviathan from occluder list", () => {
    const scene = makeScene({
      predators: [
        makePredator("lev-1", true, 100, 0, 80),
        makePredator("lev-2", true, 200, 0, 80),
      ],
    });
    expect(collectOccluders(scene, VIEWPORT).filter(isLeviathan).length).toBe(2);
    const excluded = collectOccluders(scene, VIEWPORT, "lev-1");
    const remaining = excluded.filter(isLeviathan);
    expect(remaining.length).toBe(1);
    expect(remaining[0]).toMatchObject({ x: 200 });
  });

  test("perceiverEntityId not matching any leviathan returns full list", () => {
    const scene = makeScene({ predators: [makePredator("lev-1", true)] });
    expect(collectOccluders(scene, VIEWPORT, "player").filter(isLeviathan).length).toBe(1);
  });
});

describe("collectOccluders — locked-room walls", () => {
  test("non-locked chunk produces no walls", () => {
    expect(collectOccluders(makeScene(), VIEWPORT, undefined, false).filter(isWall)).toEqual([]);
  });

  test("locked-room chunk produces 4 wall segments framing viewport rect", () => {
    const walls = collectOccluders(makeScene(), VIEWPORT, undefined, true).filter(isWall);
    expect(walls.length).toBe(4);
    const w = VIEWPORT.width;
    const h = VIEWPORT.height;
    const expected = [
      { x1: 0, y1: 0, x2: w, y2: 0 },     // top
      { x1: w, y1: 0, x2: w, y2: h },     // right
      { x1: 0, y1: h, x2: w, y2: h },     // bottom
      { x1: 0, y1: 0, x2: 0, y2: h },     // left
    ];
    type Wall = Extract<Occluder, { kind: "wall" }>;
    for (const exp of expected) {
      const found = walls.find(
        (wall: Wall) =>
          wall.x1 === exp.x1 &&
          wall.y1 === exp.y1 &&
          wall.x2 === exp.x2 &&
          wall.y2 === exp.y2,
      );
      expect(found, `wall ${JSON.stringify(exp)} missing`).toBeDefined();
    }
  });
});

describe("collectOccluders — composition", () => {
  test("debris + leviathan + walls together produce the union", () => {
    const scene = makeScene({
      anomalies: [
        { id: "r-1", type: "repel", x: 100, y: 100, size: 10, pulsePhase: 0 },
      ],
      predators: [
        { id: "lev-1", x: 50, y: 50, size: 80, speed: 5, noiseOffset: 0, angle: 0, isLeviathan: true },
      ],
    });
    const out = collectOccluders(scene, VIEWPORT, undefined, true);
    expect(out.filter(isDebris).length).toBe(1);
    expect(out.filter(isLeviathan).length).toBe(1);
    expect(out.filter(isWall).length).toBe(4);
  });
});
