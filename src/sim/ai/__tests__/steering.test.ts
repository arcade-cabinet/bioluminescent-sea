import { describe, expect, test } from "vitest";
import { Vector3 } from "yuka";
import { GameVehicle, StalkAndDashBehavior } from "../steering";

/**
 * StalkAndDashBehavior tests — verify the patrol/alert/commit/cooldown
 * state machine. The contract that matters in production:
 *
 *   - A predator outside detection radius drifts on its own loop and
 *     never accelerates toward the player.
 *   - A predator entering detection radius transitions through
 *     alert (slow approach) before committing to pursuit.
 *   - Commit lasts the instance's `commitSeconds`, then the predator
 *     drops into cooldown and drifts AWAY for `cooldownSeconds` so the
 *     next contact is a clean re-engagement, not continuous nuisance.
 *   - Cooldown ends with the predator returning to patrol if the
 *     player has wandered out of range.
 *
 * Per-instance tuning (commitSeconds, cooldownSeconds,
 * alertToCommitSeconds, dashSpeed, dashDistance, detectionRadius) is
 * seed-derived inside the constructor — the test reads those values off
 * the instance instead of asserting hardcoded magic numbers.
 */

const TEST_SEED = 0xC0FFEE;

function setup({
  predatorAt,
  playerAt,
  baseSpeed = 60,
  seed = TEST_SEED,
}: {
  predatorAt: { x: number; y: number };
  playerAt: { x: number; y: number };
  baseSpeed?: number;
  seed?: number;
}) {
  const target = new Vector3(playerAt.x, playerAt.y, 0);
  const behavior = new StalkAndDashBehavior(target, baseSpeed, seed);
  const vehicle = new GameVehicle("test-predator");
  vehicle.position.set(predatorAt.x, predatorAt.y, 0);
  vehicle.velocity.set(0, 0, 0);
  vehicle.maxSpeed = baseSpeed;
  return { behavior, vehicle, target };
}

function step(
  behavior: StalkAndDashBehavior,
  vehicle: GameVehicle,
  delta: number,
): Vector3 {
  const force = new Vector3();
  return behavior.calculate(vehicle, force, delta);
}

describe("StalkAndDashBehavior — state machine", () => {
  test("seeded tuning ranges land in their authored envelopes", () => {
    // Authored ranges from the constructor:
    //   dashSpeed:     baseSpeed * [2.0, 2.8]
    //   dashDistance:  [140, 220]
    //   detectionRadius: [320, 440]
    //   commitSeconds: [1.2, 2.0]
    //   cooldownSeconds: [2.8, 4.2]
    //   alertToCommitSeconds: [0.4, 0.8]
    for (let s = 1; s <= 16; s++) {
      const { behavior } = setup({ predatorAt: { x: 0, y: 0 }, playerAt: { x: 0, y: 0 }, seed: s });
      expect(behavior.commitSeconds).toBeGreaterThanOrEqual(1.2);
      expect(behavior.commitSeconds).toBeLessThanOrEqual(2.0);
      expect(behavior.cooldownSeconds).toBeGreaterThanOrEqual(2.8);
      expect(behavior.cooldownSeconds).toBeLessThanOrEqual(4.2);
      expect(behavior.alertToCommitSeconds).toBeGreaterThanOrEqual(0.4);
      expect(behavior.alertToCommitSeconds).toBeLessThanOrEqual(0.8);
    }
  });

  test("two different seeds produce independent tunings", () => {
    const a = new StalkAndDashBehavior(new Vector3(), 60, 1);
    const b = new StalkAndDashBehavior(new Vector3(), 60, 2);
    const equal =
      a.commitSeconds === b.commitSeconds &&
      a.cooldownSeconds === b.cooldownSeconds &&
      a.alertToCommitSeconds === b.alertToCommitSeconds;
    expect(equal).toBe(false);
  });

  test("patrol: predator outside detection ignores the player", () => {
    const { behavior, vehicle } = setup({
      predatorAt: { x: 1000, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    const force = step(behavior, vehicle, 1 / 60);
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.7, 5);
    expect(force.length()).toBeGreaterThan(0);
  });

  test("alert: predator inside detection slows and faces the player", () => {
    // Use a predator position guaranteed inside the seeded
    // detectionRadius envelope's lower bound. detectionRadius is at
    // least 320, so 200 is always inside.
    const { behavior, vehicle } = setup({
      predatorAt: { x: 200, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    step(behavior, vehicle, 1 / 60);
    const force = step(behavior, vehicle, 1 / 60);
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.55, 5);
    expect(force.x).toBeLessThan(0);
  });

  test("alert → commit: after the instance's alertToCommitSeconds the predator commits", () => {
    const { behavior, vehicle } = setup({
      predatorAt: { x: 200, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    step(behavior, vehicle, 1 / 60);
    const framesIntoCommit = Math.ceil(behavior.alertToCommitSeconds * 60) + 4;
    for (let i = 0; i < framesIntoCommit; i++) {
      step(behavior, vehicle, 1 / 60);
    }
    // Commit at this distance (200 may be > or < dashDistance — check both).
    const expectedSpeed =
      200 < behavior["dashDistance"] ? 60 * (behavior["dashSpeed"] / 60) : 60 * 1.4;
    expect(vehicle.maxSpeed).toBeCloseTo(expectedSpeed, 4);
  });

  test("commit → cooldown: after the instance's commitSeconds the predator breaks off", () => {
    const { behavior, vehicle } = setup({
      predatorAt: { x: 100, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    const totalSeconds =
      behavior.alertToCommitSeconds + behavior.commitSeconds + 0.1;
    const frames = Math.ceil(totalSeconds * 60);
    let lastForce = new Vector3();
    for (let i = 0; i < frames; i++) {
      lastForce = step(behavior, vehicle, 1 / 60);
    }
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.5, 5);
    // Cooldown drifts AWAY from the player.
    expect(lastForce.x).toBeGreaterThan(0);
  });

  test("cooldown → patrol: after cooldownSeconds the predator returns to patrol if it's far from the player", () => {
    const { behavior, vehicle, target } = setup({
      predatorAt: { x: 100, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    const intoCommit = behavior.alertToCommitSeconds + 0.2;
    for (let i = 0; i < Math.ceil(intoCommit * 60); i++) {
      step(behavior, vehicle, 1 / 60);
    }
    target.set(5000, 0, 0);
    const remaining = behavior.commitSeconds + behavior.cooldownSeconds + 0.2;
    for (let i = 0; i < Math.ceil(remaining * 60); i++) {
      step(behavior, vehicle, 1 / 60);
    }
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.7, 5);
  });

  test("cooldown re-engages alert when the player is still in range", () => {
    const { behavior, vehicle } = setup({
      predatorAt: { x: 100, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    const totalSeconds =
      behavior.alertToCommitSeconds +
      behavior.commitSeconds +
      behavior.cooldownSeconds +
      0.2;
    for (let i = 0; i < Math.ceil(totalSeconds * 60); i++) {
      step(behavior, vehicle, 1 / 60);
    }
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.55, 5);
  });

  test("alert → patrol: predator that wanders out of detection drops back to patrol", () => {
    const { behavior, vehicle, target } = setup({
      predatorAt: { x: 200, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    step(behavior, vehicle, 1 / 60);
    target.set(2000, 0, 0);
    step(behavior, vehicle, 1 / 60);
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.7, 5);
  });
});
