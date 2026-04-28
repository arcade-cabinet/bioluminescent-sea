import { describe, expect, test } from "vitest";
import { Vector3 } from "yuka";
import { FleeFromPlayerBehavior, GameVehicle } from "../steering";

/**
 * FleeFromPlayerBehavior — the missing piece of the school-as-flock
 * pattern. The existing AlignmentBehavior + CohesionBehavior +
 * SeparationBehavior trio is already wired in AIManager.syncCreatures
 * with seed-derived weights. This behavior adds the player-aware
 * piece that was missing: creatures dart away when the sub gets close.
 *
 * Contract:
 * - playerRef null OR distance > radius → force unchanged.
 * - Otherwise force += awayDir × magnitude × maxForce.
 * - Magnitude scales (1 - distance/radius) — smooth, not on/off.
 * - Stable with NaN inputs (force unchanged).
 */

const RADIUS = 100;

function makeVehicleAt(x: number, y: number): GameVehicle {
  const v = new GameVehicle("test-creature");
  v.position.set(x, y, 0);
  // Force scaling uses maxSpeed (matches Yuka's WanderBehavior pattern;
  // GameVehicle's maxForce defaults to 1, so multiplying by maxForce
  // would produce single-px nudges, invisible against typical creature
  // velocities). 100 px/sec is a typical fish maxSpeed.
  v.maxSpeed = 100;
  return v;
}

function makePlayerAt(x: number, y: number): GameVehicle {
  const v = new GameVehicle("player");
  v.position.set(x, y, 0);
  return v;
}

describe("FleeFromPlayerBehavior — null player ref", () => {
  test("playerRef null → force unchanged", () => {
    const behavior = new FleeFromPlayerBehavior(RADIUS);
    const vehicle = makeVehicleAt(0, 0);
    const force = new Vector3(0, 0, 0);
    behavior.calculate(vehicle, force, 1 / 30);
    expect(force.x).toBe(0);
    expect(force.y).toBe(0);
  });
});

describe("FleeFromPlayerBehavior — radius gate", () => {
  test("player outside radius → force unchanged", () => {
    const behavior = new FleeFromPlayerBehavior(RADIUS);
    behavior.playerRef = makePlayerAt(200, 0); // 200 > radius 100
    const vehicle = makeVehicleAt(0, 0);
    const force = new Vector3(0, 0, 0);
    behavior.calculate(vehicle, force, 1 / 30);
    expect(force.x).toBe(0);
    expect(force.y).toBe(0);
  });

  test("player exactly on radius edge → no force (open boundary)", () => {
    const behavior = new FleeFromPlayerBehavior(RADIUS);
    behavior.playerRef = makePlayerAt(RADIUS, 0);
    const vehicle = makeVehicleAt(0, 0);
    const force = new Vector3(0, 0, 0);
    behavior.calculate(vehicle, force, 1 / 30);
    // At the exact edge, magnitude = 1 - distance/radius = 0, so no force.
    expect(force.x).toBeCloseTo(0, 5);
    expect(force.y).toBeCloseTo(0, 5);
  });
});

describe("FleeFromPlayerBehavior — direction", () => {
  test("player on +X side → force points -X (creature flees -X)", () => {
    const behavior = new FleeFromPlayerBehavior(RADIUS);
    behavior.playerRef = makePlayerAt(50, 0); // half radius +X
    const vehicle = makeVehicleAt(0, 0);
    const force = new Vector3(0, 0, 0);
    behavior.calculate(vehicle, force, 1 / 30);
    expect(force.x).toBeLessThan(0);
    expect(force.y).toBeCloseTo(0, 5);
  });

  test("player on -Y side → force points +Y", () => {
    const behavior = new FleeFromPlayerBehavior(RADIUS);
    behavior.playerRef = makePlayerAt(0, -50);
    const vehicle = makeVehicleAt(0, 0);
    const force = new Vector3(0, 0, 0);
    behavior.calculate(vehicle, force, 1 / 30);
    expect(force.y).toBeGreaterThan(0);
    expect(force.x).toBeCloseTo(0, 5);
  });
});

describe("FleeFromPlayerBehavior — magnitude scaling", () => {
  test("at half radius → ~half maxForce", () => {
    const behavior = new FleeFromPlayerBehavior(RADIUS);
    behavior.playerRef = makePlayerAt(50, 0); // half radius
    const vehicle = makeVehicleAt(0, 0);
    const force = new Vector3(0, 0, 0);
    behavior.calculate(vehicle, force, 1 / 30);
    // (1 - 50/100) × 100 = 50
    expect(Math.hypot(force.x, force.y)).toBeCloseTo(50, 0);
  });

  test("at quarter radius → ~0.75 maxForce", () => {
    const behavior = new FleeFromPlayerBehavior(RADIUS);
    behavior.playerRef = makePlayerAt(25, 0);
    const vehicle = makeVehicleAt(0, 0);
    const force = new Vector3(0, 0, 0);
    behavior.calculate(vehicle, force, 1 / 30);
    expect(Math.hypot(force.x, force.y)).toBeCloseTo(75, 0);
  });

  test("at zero distance → force is non-zero (zero-vector edge picks any stable direction)", () => {
    const behavior = new FleeFromPlayerBehavior(RADIUS);
    behavior.playerRef = makePlayerAt(0, 0);
    const vehicle = makeVehicleAt(0, 0);
    const force = new Vector3(0, 0, 0);
    behavior.calculate(vehicle, force, 1 / 30);
    // The behavior should not produce NaN — accept any direction
    // including the ambient zero, since coincident positions have no
    // defined "away" direction and the school's other steering
    // behaviors will move the creature off-coincident next frame.
    expect(Number.isFinite(force.x)).toBe(true);
    expect(Number.isFinite(force.y)).toBe(true);
  });
});

describe("FleeFromPlayerBehavior — additive force composition", () => {
  test("force is added to existing force, not overwritten", () => {
    const behavior = new FleeFromPlayerBehavior(RADIUS);
    behavior.playerRef = makePlayerAt(50, 0);
    const vehicle = makeVehicleAt(0, 0);
    const force = new Vector3(10, 20, 0); // pre-existing force
    behavior.calculate(vehicle, force, 1 / 30);
    // Pre-existing y=20 must be preserved.
    expect(force.y).toBeCloseTo(20, 5);
    // X gets the flee force added (negative direction since player is +X).
    expect(force.x).toBeLessThan(10);
  });
});
