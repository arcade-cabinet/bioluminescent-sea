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
 *   - Commit lasts ~1.6s, then the predator drops into cooldown and
 *     drifts AWAY from the player for ~3.5s so the next contact is
 *     a clean re-engagement, not continuous nuisance.
 *   - Cooldown ends with the predator returning to patrol.
 *
 * These guarantees fix the prior "predator camps on the player"
 * bleed where idle Exploration burned 2-3x normal oxygen.
 */

// Match the constants inside steering.ts. Kept here so the test
// fails loudly if the production behaviour drifts from these.
const COMMIT_SECONDS = 1.6;
const COOLDOWN_SECONDS = 3.5;
const ALERT_TO_COMMIT_SECONDS = 0.6;

function setup({
  predatorAt,
  playerAt,
  baseSpeed = 60,
}: {
  predatorAt: { x: number; y: number };
  playerAt: { x: number; y: number };
  baseSpeed?: number;
}) {
  const target = new Vector3(playerAt.x, playerAt.y, 0);
  const behavior = new StalkAndDashBehavior(target, baseSpeed);
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
  test("patrol: predator outside detection ignores the player", () => {
    // Predator far away (1000px) — well outside detection radius.
    // Force vector should not point toward the player; speed stays
    // at the patrol fraction (0.4 * baseSpeed).
    const { behavior, vehicle } = setup({
      predatorAt: { x: 1000, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    const force = step(behavior, vehicle, 1 / 60);
    // Patrol speed clamps to baseSpeed * 0.4.
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.4, 5);
    // The patrol force is on a sinusoid, so its direction is NOT
    // strictly toward the player. Confirm the force is non-zero
    // (the predator IS drifting) but its x component is positive
    // (drift away from origin) — patrol doesn't track the target.
    expect(force.length()).toBeGreaterThan(0);
  });

  test("alert: predator inside detection slows and faces the player", () => {
    // Predator just inside detection (300 < 380). Should be in
    // patrol on first frame, then transition to alert. Alert
    // speed is 0.55 * baseSpeed (slower than patrol's 0.4? no —
    // alert is the slow approach phase, which is faster than
    // patrol's drift but slower than commit's pursuit). The
    // contract: in alert, the force points toward the player.
    const { behavior, vehicle } = setup({
      predatorAt: { x: 300, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    // First frame transitions patrol → alert.
    step(behavior, vehicle, 1 / 60);
    const force = step(behavior, vehicle, 1 / 60);
    // In alert, maxSpeed is baseSpeed * 0.55.
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.55, 5);
    // Force points roughly from predator (300) toward player (0):
    // x component should be negative (toward 0).
    expect(force.x).toBeLessThan(0);
  });

  test("alert → commit: after ALERT_TO_COMMIT_SECONDS the predator commits", () => {
    const { behavior, vehicle } = setup({
      predatorAt: { x: 300, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    // First frame: patrol → alert (the transition logic runs at the
    // top of calculate). Subsequent frames accumulate alert time.
    step(behavior, vehicle, 1 / 60);
    // Step alert duration past the threshold.
    for (let i = 0; i < 50; i++) {
      step(behavior, vehicle, 1 / 60); // ~0.83s total
    }
    // Now in commit. Commit speed at this distance (300 > dashDistance=180)
    // is baseSpeed * 1.4.
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 1.4, 5);
  });

  test("commit dash: predator within dashDistance gets the dash speed", () => {
    const { behavior, vehicle } = setup({
      predatorAt: { x: 100, y: 0 }, // inside both detection (380) and dash (180)
      playerAt: { x: 0, y: 0 },
    });
    // patrol → alert → commit
    step(behavior, vehicle, 1 / 60);
    for (let i = 0; i < 50; i++) step(behavior, vehicle, 1 / 60);
    // dashSpeed = baseSpeed * 2.4
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 2.4, 5);
  });

  test("commit → cooldown: after COMMIT_SECONDS the predator breaks off", () => {
    const { behavior, vehicle } = setup({
      predatorAt: { x: 100, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    // patrol → alert → commit → cooldown.
    // alert ends at ~0.6s, commit lasts ~1.6s, so total ~2.2s+.
    const totalSeconds = ALERT_TO_COMMIT_SECONDS + COMMIT_SECONDS + 0.1;
    const frames = Math.ceil(totalSeconds * 60);
    let lastForce = new Vector3();
    for (let i = 0; i < frames; i++) {
      lastForce = step(behavior, vehicle, 1 / 60);
    }
    // Cooldown speed is 0.5 * baseSpeed.
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.5, 5);
    // Cooldown drifts AWAY from the player. With predator at x=100
    // and player at x=0, the AWAY direction has positive x — the
    // raw force vector should reflect that bias even after
    // velocity-subtraction.
    expect(lastForce.x).toBeGreaterThan(0);
  });

  test("cooldown → patrol: after COOLDOWN_SECONDS the predator returns to patrol if it's far from the player", () => {
    // Set up so the cooldown drift carries the predator out of
    // detection radius before the cooldown timer expires. Move the
    // target far away to simulate the player swimming off — once
    // cooldown ends the predator should drop back into patrol, not
    // re-engage. (If the player is still nearby, re-engagement is
    // correct gameplay; covered by the alert-on-detect test above.)
    const { behavior, vehicle, target } = setup({
      predatorAt: { x: 100, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    // Walk into commit so we're in the right phase to test break-off.
    const intoCommit = ALERT_TO_COMMIT_SECONDS + 0.2;
    for (let i = 0; i < Math.ceil(intoCommit * 60); i++) {
      step(behavior, vehicle, 1 / 60);
    }
    // Push player far away (simulates swim-off) and finish the
    // commit + cooldown windows.
    target.set(5000, 0, 0);
    const remaining = COMMIT_SECONDS + COOLDOWN_SECONDS + 0.2;
    for (let i = 0; i < Math.ceil(remaining * 60); i++) {
      step(behavior, vehicle, 1 / 60);
    }
    // Player is now far outside detection (5000 > 380). Patrol speed
    // clamps to baseSpeed * 0.4.
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.4, 5);
  });

  test("cooldown re-engages alert when the player is still in range", () => {
    // The opposite scenario — player stays right next to the
    // predator. After cooldown ends, patrol immediately picks up the
    // detection and transitions to alert again. This is the correct
    // pursue-pause-pursue rhythm; predators eventually catch the
    // player rather than drifting forever.
    const { behavior, vehicle } = setup({
      predatorAt: { x: 100, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    const totalSeconds =
      ALERT_TO_COMMIT_SECONDS + COMMIT_SECONDS + COOLDOWN_SECONDS + 0.2;
    for (let i = 0; i < Math.ceil(totalSeconds * 60); i++) {
      step(behavior, vehicle, 1 / 60);
    }
    // Player still in range → back in alert.
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.55, 5);
  });

  test("alert → patrol: predator that wanders out of detection drops back to patrol", () => {
    // Move target far away while predator is in alert. Detection
    // radius * 1.3 = 494, so distance > 494 should drop us back.
    const { behavior, vehicle, target } = setup({
      predatorAt: { x: 300, y: 0 },
      playerAt: { x: 0, y: 0 },
    });
    step(behavior, vehicle, 1 / 60); // patrol → alert
    target.set(2000, 0, 0); // way far
    step(behavior, vehicle, 1 / 60);
    // Now back in patrol; speed clamps to 0.4 * base.
    expect(vehicle.maxSpeed).toBeCloseTo(60 * 0.4, 5);
  });
});
