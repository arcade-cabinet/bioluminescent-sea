import { describe, expect, test } from "vitest";
import {
  createTorpedoLauncher,
  advanceTorpedo,
  TORPEDO_SPEED_PX_PER_SEC,
  TORPEDO_LIFESPAN_SECONDS,
  TORPEDO_COOLDOWN_SECONDS,
  type Torpedo,
} from "../torpedo";

/**
 * Torpedo launcher + projectile motion.
 *
 * Folded review findings:
 *  - createTorpedoLauncher returns a callable directly, not a {fire}
 *    object — single-method interface ceremony dropped (simplifier #1).
 *  - lastFireTime AND nextId both live inside the closure — module-
 *    level mutable nextId would break determinism across tests
 *    (security HIGH + quality #1).
 *  - advanceTorpedo (renamed from stepTorpedo) is pure motion: no
 *    expiry check, caller owns lifecycle (simplifier #4).
 *  - dt is required; no default that hides intent (quality #2 +
 *    simplifier #3).
 *  - NaN guards on torpedo.vx/vy/x/y in advance, not just dt
 *    (security MED).
 */

describe("createTorpedoLauncher — fire and cooldown", () => {
  test("first fire returns a torpedo at the player's position", () => {
    const fire = createTorpedoLauncher();
    const t = fire({ x: 100, y: 200 }, 0, 0);
    expect(t).not.toBeNull();
    if (!t) throw new Error("unreachable");
    expect(t.x).toBe(100);
    expect(t.y).toBe(200);
    expect(t.launchedAt).toBe(0);
    expect(t.expiresAt).toBeCloseTo(TORPEDO_LIFESPAN_SECONDS, 5);
  });

  test("fire within cooldown is rejected (returns null)", () => {
    const fire = createTorpedoLauncher();
    expect(fire({ x: 0, y: 0 }, 0, 0)).not.toBeNull();
    expect(fire({ x: 0, y: 0 }, 0, 0.1)).toBeNull();
    expect(fire({ x: 0, y: 0 }, 0, 0.5)).toBeNull();
  });

  test("fire after cooldown succeeds", () => {
    const fire = createTorpedoLauncher();
    expect(fire({ x: 0, y: 0 }, 0, 0)).not.toBeNull();
    const after = fire({ x: 0, y: 0 }, 0, TORPEDO_COOLDOWN_SECONDS + 0.01);
    expect(after).not.toBeNull();
  });

  test("double-call within the same frame cannot bypass cooldown", () => {
    const fire = createTorpedoLauncher();
    const t1 = fire({ x: 0, y: 0 }, 0, 0);
    const t2 = fire({ x: 0, y: 0 }, 0, 0);
    expect(t1).not.toBeNull();
    expect(t2).toBeNull();
  });

  test("each launcher instance has its own counter (no module-level state)", () => {
    const fireA = createTorpedoLauncher();
    const fireB = createTorpedoLauncher();
    const tA = fireA({ x: 0, y: 0 }, 0, 0);
    const tB = fireB({ x: 0, y: 0 }, 0, 0);
    expect(tA?.id).toBe("torpedo-1");
    expect(tB?.id).toBe("torpedo-1");
  });
});

describe("createTorpedoLauncher — aim", () => {
  test("torpedo velocity tracks the aim arg, not player heading", () => {
    const fire = createTorpedoLauncher();
    const t = fire({ x: 0, y: 0 }, 0, 0);
    expect(t).not.toBeNull();
    if (!t) throw new Error("unreachable");
    expect(t.vx).toBeCloseTo(TORPEDO_SPEED_PX_PER_SEC, 1);
    expect(t.vy).toBeCloseTo(0, 5);
  });

  test("aim=PI/2 → torpedo flies +Y", () => {
    const fire = createTorpedoLauncher();
    const t = fire({ x: 0, y: 0 }, Math.PI / 2, 0);
    expect(t).not.toBeNull();
    if (!t) throw new Error("unreachable");
    expect(t.vx).toBeCloseTo(0, 5);
    expect(t.vy).toBeCloseTo(TORPEDO_SPEED_PX_PER_SEC, 1);
  });

  test("aim is decoupled from player heading", () => {
    const fire = createTorpedoLauncher();
    const t = fire({ x: 0, y: 0 }, Math.PI / 4, 0);
    expect(t).not.toBeNull();
    if (!t) throw new Error("unreachable");
    expect(Math.hypot(t.vx, t.vy)).toBeCloseTo(TORPEDO_SPEED_PX_PER_SEC, 1);
  });
});

describe("createTorpedoLauncher — NaN guards", () => {
  test("NaN player.x rejects fire AND advances no internal state", () => {
    const fire = createTorpedoLauncher();
    expect(fire({ x: NaN, y: 0 }, 0, 0)).toBeNull();
    expect(fire({ x: 0, y: 0 }, 0, 0)).not.toBeNull();
  });

  test("NaN aim rejects fire", () => {
    const fire = createTorpedoLauncher();
    expect(fire({ x: 0, y: 0 }, NaN, 0)).toBeNull();
  });

  test("NaN simTime rejects fire", () => {
    const fire = createTorpedoLauncher();
    expect(fire({ x: 0, y: 0 }, 0, NaN)).toBeNull();
  });

  test("Infinity coords reject fire", () => {
    const fire = createTorpedoLauncher();
    expect(fire({ x: Infinity, y: 0 }, 0, 0)).toBeNull();
  });
});

describe("advanceTorpedo — projectile motion", () => {
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

  test("advance shifts position by velocity × dt", () => {
    const next = advanceTorpedo(makeTorpedo(), 0.5);
    expect(next).not.toBeNull();
    if (!next) throw new Error("unreachable");
    expect(next.x).toBeCloseTo(TORPEDO_SPEED_PX_PER_SEC * 0.5, 1);
    expect(next.y).toBeCloseTo(0, 5);
  });

  test("advance preserves velocity (no drag)", () => {
    const t = makeTorpedo();
    const next = advanceTorpedo(t, 0.5);
    expect(next).not.toBeNull();
    if (!next) throw new Error("unreachable");
    expect(next.vx).toBe(t.vx);
    expect(next.vy).toBe(t.vy);
  });

  test("advance with NaN dt returns null", () => {
    expect(advanceTorpedo(makeTorpedo(), NaN)).toBeNull();
  });

  test("advance with NaN velocity returns null (defensive)", () => {
    expect(advanceTorpedo(makeTorpedo({ vx: NaN }), 0.5)).toBeNull();
    expect(advanceTorpedo(makeTorpedo({ vy: NaN }), 0.5)).toBeNull();
  });

  test("advance with NaN position returns null", () => {
    expect(advanceTorpedo(makeTorpedo({ x: NaN }), 0.5)).toBeNull();
  });
});
