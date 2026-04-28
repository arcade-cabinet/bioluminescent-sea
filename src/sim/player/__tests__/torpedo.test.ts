import { describe, expect, test } from "vitest";
import {
  createTorpedoLauncher,
  stepTorpedo,
  TORPEDO_SPEED_PX_PER_SEC,
  TORPEDO_LIFESPAN_SECONDS,
  TORPEDO_COOLDOWN_SECONDS,
  type Torpedo,
} from "../torpedo";

/**
 * Torpedo launcher + projectile motion.
 *
 * Folded review findings:
 *  - createTorpedoLauncher returns {fire} with internal cooldown
 *    state (closure). Caller cannot double-fire — the emitter pattern
 *    makes the cooldown an invariant (security HIGH #1).
 *  - fire() returns Torpedo | null directly — no FireTorpedoResult
 *    interface (simplifier #1).
 *  - Internal NaN guard rejects bad player coords + heading
 *    BEFORE any side-effect (security HIGH #2).
 *  - Sim-time only (security MED).
 *  - File lives at src/sim/player/torpedo.ts alongside other player
 *    sim infrastructure (vehicle.ts, cavitation.ts) — same pattern,
 *    same neighbours, no new package boundary.
 */

describe("createTorpedoLauncher — fire and cooldown", () => {
  test("first fire returns a torpedo at the player's position", () => {
    const launcher = createTorpedoLauncher();
    const t = launcher.fire({ x: 100, y: 200 }, 0, 0);
    expect(t).not.toBeNull();
    if (!t) throw new Error("unreachable");
    expect(t.x).toBe(100);
    expect(t.y).toBe(200);
    expect(t.launchedAt).toBe(0);
    expect(t.expiresAt).toBeCloseTo(TORPEDO_LIFESPAN_SECONDS, 5);
  });

  test("fire within cooldown is rejected (returns null)", () => {
    const launcher = createTorpedoLauncher();
    expect(launcher.fire({ x: 0, y: 0 }, 0, 0)).not.toBeNull();
    expect(launcher.fire({ x: 0, y: 0 }, 0, 0.1)).toBeNull();
    expect(launcher.fire({ x: 0, y: 0 }, 0, 0.5)).toBeNull();
  });

  test("fire after cooldown succeeds", () => {
    const launcher = createTorpedoLauncher();
    expect(launcher.fire({ x: 0, y: 0 }, 0, 0)).not.toBeNull();
    const after = launcher.fire(
      { x: 0, y: 0 },
      0,
      TORPEDO_COOLDOWN_SECONDS + 0.01,
    );
    expect(after).not.toBeNull();
  });

  test("double-call within the same frame cannot bypass cooldown (security HIGH #1)", () => {
    const launcher = createTorpedoLauncher();
    const t1 = launcher.fire({ x: 0, y: 0 }, 0, 0);
    const t2 = launcher.fire({ x: 0, y: 0 }, 0, 0);
    expect(t1).not.toBeNull();
    expect(t2).toBeNull();
  });
});

describe("createTorpedoLauncher — aim (folds quality CRITICAL #3)", () => {
  test("torpedo velocity tracks the aim arg, not player heading", () => {
    const launcher = createTorpedoLauncher();
    // aim=0 → +X
    const t = launcher.fire({ x: 0, y: 0 }, 0, 0)!;
    expect(t.vx).toBeCloseTo(TORPEDO_SPEED_PX_PER_SEC, 1);
    expect(t.vy).toBeCloseTo(0, 5);
  });

  test("aim=PI/2 → torpedo flies +Y", () => {
    const launcher = createTorpedoLauncher();
    const t = launcher.fire({ x: 0, y: 0 }, Math.PI / 2, 0)!;
    expect(t.vx).toBeCloseTo(0, 5);
    expect(t.vy).toBeCloseTo(TORPEDO_SPEED_PX_PER_SEC, 1);
  });

  test("aim is decoupled from player heading — caller passes whichever they choose", () => {
    // Mobile right-stick aim and sub-heading can differ. The
    // launcher takes aim explicitly so the runtime can pass aim
    // when set, falling back to heading when not.
    const launcher = createTorpedoLauncher();
    const t = launcher.fire({ x: 0, y: 0 }, Math.PI / 4, 0)!;
    const speed = Math.hypot(t.vx, t.vy);
    expect(speed).toBeCloseTo(TORPEDO_SPEED_PX_PER_SEC, 1);
  });
});

describe("createTorpedoLauncher — NaN guards (security HIGH #2)", () => {
  test("NaN player.x rejects fire AND advances no internal state", () => {
    const launcher = createTorpedoLauncher();
    expect(launcher.fire({ x: NaN, y: 0 }, 0, 0)).toBeNull();
    // The valid fire that follows must succeed — proves the
    // rejected call did NOT advance lastFireTime.
    expect(launcher.fire({ x: 0, y: 0 }, 0, 0)).not.toBeNull();
  });

  test("NaN aim rejects fire", () => {
    const launcher = createTorpedoLauncher();
    expect(launcher.fire({ x: 0, y: 0 }, NaN, 0)).toBeNull();
  });

  test("NaN simTime rejects fire", () => {
    const launcher = createTorpedoLauncher();
    expect(launcher.fire({ x: 0, y: 0 }, 0, NaN)).toBeNull();
  });

  test("Infinity coords reject fire", () => {
    const launcher = createTorpedoLauncher();
    expect(launcher.fire({ x: Infinity, y: 0 }, 0, 0)).toBeNull();
  });
});

describe("stepTorpedo — projectile motion", () => {
  function makeTorpedo(overrides: Partial<Torpedo> = {}): Torpedo {
    return {
      id: "t-1",
      x: 0,
      y: 0,
      vx: TORPEDO_SPEED_PX_PER_SEC,
      vy: 0,
      launchedAt: 0,
      expiresAt: TORPEDO_LIFESPAN_SECONDS,
      ...overrides,
    };
  }

  test("step advances position by velocity × dt", () => {
    const t = makeTorpedo();
    const next = stepTorpedo(t, 0.5);
    expect(next).not.toBeNull();
    if (!next) throw new Error("unreachable");
    expect(next.x).toBeCloseTo(TORPEDO_SPEED_PX_PER_SEC * 0.5, 1);
    expect(next.y).toBeCloseTo(0, 5);
  });

  test("step preserves velocity (no drag)", () => {
    const t = makeTorpedo();
    const next = stepTorpedo(t, 0.5)!;
    expect(next.vx).toBe(t.vx);
    expect(next.vy).toBe(t.vy);
  });

  test("step at simTime past expiresAt returns null (despawn)", () => {
    const t = makeTorpedo({ expiresAt: 1 });
    const next = stepTorpedo(t, 1.5); // 1.5s elapsed > 1s lifespan
    expect(next).toBeNull();
  });
});
