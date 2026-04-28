import { describe, expect, test } from "vitest";
import {
  createPlayerVehicle,
  applyThrust,
  type PlayerVehicleConfig,
} from "../vehicle";

/**
 * Player Vehicle + thrust math.
 *
 * Per the simplified contract (folded from the simplifier review):
 *  - PlayerVehicle is a factory that returns a configured GameVehicle.
 *    No subclass; no Yuka dependency leaked into the sim contract.
 *  - applyThrust is a free function exported from vehicle.ts (the
 *    "single file" boundary the simplifier called for — no separate
 *    thrust.ts).
 *  - NaN guards on inputs (security HIGH).
 */

const CONFIG: PlayerVehicleConfig = {
  cruiseMaxSpeed: 200,
  sprintMultiplier: 2,
  drag: 1.5,
  mass: 1,
};

describe("createPlayerVehicle", () => {
  test("returns a vehicle at the configured starting position", () => {
    const v = createPlayerVehicle(CONFIG, { x: 100, y: 200 });
    expect(v.position.x).toBe(100);
    expect(v.position.y).toBe(200);
    expect(v.maxSpeed).toBe(CONFIG.cruiseMaxSpeed);
  });

  test("starts at rest", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    expect(v.velocity.x).toBe(0);
    expect(v.velocity.y).toBe(0);
  });
});

describe("applyThrust — basic motion", () => {
  test("idle input → velocity decays toward zero (drag)", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    v.velocity.set(100, 0, 0);
    for (let i = 0; i < 100; i++) {
      applyThrust(v, CONFIG, { tx: 0, ty: 0, sprint: false }, 1 / 30);
    }
    expect(Math.hypot(v.velocity.x, v.velocity.y)).toBeLessThan(1);
  });

  test("constant input at magnitude 1 → speed converges to cruiseMaxSpeed", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    for (let i = 0; i < 200; i++) {
      applyThrust(v, CONFIG, { tx: 1, ty: 0, sprint: false }, 1 / 30);
    }
    expect(v.velocity.x).toBeCloseTo(CONFIG.cruiseMaxSpeed, 0);
  });

  test("sprint hold → speed converges to cruiseMaxSpeed × sprintMultiplier", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    for (let i = 0; i < 200; i++) {
      applyThrust(v, CONFIG, { tx: 1, ty: 0, sprint: true }, 1 / 30);
    }
    expect(v.velocity.x).toBeCloseTo(CONFIG.cruiseMaxSpeed * CONFIG.sprintMultiplier, 0);
  });

  test("input release at speed → velocity decays exponentially", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    v.velocity.set(CONFIG.cruiseMaxSpeed, 0, 0);
    const initialSpeed = CONFIG.cruiseMaxSpeed;
    for (let i = 0; i < 30; i++) {
      applyThrust(v, CONFIG, { tx: 0, ty: 0, sprint: false }, 1 / 30);
    }
    // After ~1 second of drag at coefficient 1.5, speed should be
    // significantly reduced but still positive.
    const speed = Math.hypot(v.velocity.x, v.velocity.y);
    expect(speed).toBeLessThan(initialSpeed * 0.5);
    expect(speed).toBeGreaterThan(0);
  });

  test("joystick magnitude below deadzone → no force applied", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    // Magnitude 0.05 — below the conventional 0.1 deadzone.
    applyThrust(v, CONFIG, { tx: 0.05, ty: 0, sprint: false }, 1 / 30);
    expect(v.velocity.x).toBe(0);
  });

  test("joystick magnitude above deadzone → proportional force", () => {
    const v1 = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    const v2 = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    applyThrust(v1, CONFIG, { tx: 0.5, ty: 0, sprint: false }, 1 / 30);
    applyThrust(v2, CONFIG, { tx: 1.0, ty: 0, sprint: false }, 1 / 30);
    expect(v2.velocity.x).toBeGreaterThan(v1.velocity.x);
  });
});

describe("applyThrust — NaN guards (security HIGH)", () => {
  test("NaN tx is rejected, no movement", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    applyThrust(v, CONFIG, { tx: NaN, ty: 0, sprint: false }, 1 / 30);
    expect(v.velocity.x).toBe(0);
    expect(v.velocity.y).toBe(0);
  });

  test("NaN ty is rejected", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    applyThrust(v, CONFIG, { tx: 0, ty: NaN, sprint: false }, 1 / 30);
    expect(v.velocity.x).toBe(0);
    expect(v.velocity.y).toBe(0);
  });

  test("Infinity is rejected", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    applyThrust(v, CONFIG, { tx: Infinity, ty: 0, sprint: false }, 1 / 30);
    expect(Number.isFinite(v.velocity.x)).toBe(true);
    expect(Number.isFinite(v.velocity.y)).toBe(true);
  });

  test("NaN deltaTime is rejected", () => {
    const v = createPlayerVehicle(CONFIG, { x: 0, y: 0 });
    v.velocity.set(50, 50, 0);
    applyThrust(v, CONFIG, { tx: 1, ty: 0, sprint: false }, NaN);
    expect(Number.isFinite(v.velocity.x)).toBe(true);
    expect(Number.isFinite(v.velocity.y)).toBe(true);
  });
});
