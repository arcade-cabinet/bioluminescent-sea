import { describe, expect, test } from "vitest";
import { SESSION_MODES } from "@/sim/_shared/sessionMode";
import { MODE_TEMPLATES, resolveModeSlots } from "./slots";
import { getDiveModeTuning } from "@/sim/engine/mode";
import { GAME_DURATION } from "@/sim/dive/constants";

const SAMPLE_SEED = 0xc0ffee;

function envelope(t: number | readonly [number, number]): [number, number] {
  return typeof t === "number" ? [t, t] : [t[0], t[1]];
}

describe("dive mode slot system", () => {
  test("every SessionMode has a template", () => {
    for (const mode of SESSION_MODES) {
      expect(MODE_TEMPLATES[mode]).toBeDefined();
    }
  });

  test("resolution is deterministic per seed", () => {
    for (const mode of SESSION_MODES) {
      const a = resolveModeSlots(mode, 12345);
      const b = resolveModeSlots(mode, 12345);
      expect(a).toEqual(b);
    }
  });

  test("two different seeds produce independent draws", () => {
    // Statistical: across many seeds, descent's targetDepthMeters
    // should land at distinct values most of the time. A handful of
    // collisions is fine — a single point would mean the seed isn't
    // wired through.
    const depths = new Set<number>();
    for (let s = 1; s <= 20; s++) {
      const target = resolveModeSlots("descent", s).targetDepthMeters;
      if (target !== null) depths.add(target);
    }
    expect(depths.size).toBeGreaterThan(10);
  });

  test("exploration: drift the photic shelf — free movement, soft threats", () => {
    const slots = resolveModeSlots("exploration", SAMPLE_SEED);
    expect(slots.verticalMovement).toBe("free");
    expect(slots.lateralMovement).toBe("free");
    expect(slots.collisionEndsDive).toBe(false);
    expect(slots.respawnThreats).toBe(false);
    expect(slots.completionCondition).toBe("infinite");
    expect(slots.difficultyScaling).toBe("none");
    // Numeric assertions check the *envelope*, not a fixed value.
    const [predLo, predHi] = envelope(MODE_TEMPLATES.exploration.predatorSpeedScale);
    expect(slots.predatorSpeedScale).toBeGreaterThanOrEqual(predLo);
    expect(slots.predatorSpeedScale).toBeLessThanOrEqual(predHi);
    expect(slots.collectionOxygenScale).toBeGreaterThan(1);
  });

  test("descent: lateral-locked plunge toward a seed-derived depth goal", () => {
    const slots = resolveModeSlots("descent", SAMPLE_SEED);
    expect(slots.verticalMovement).toBe("free");
    expect(slots.lateralMovement).toBe("locked");
    expect(slots.completionCondition).toBe("depth_goal");
    const targetDepthTemplate = MODE_TEMPLATES.descent.targetDepthMeters;
    if (targetDepthTemplate === null) throw new Error("descent must have a target depth template");
    const [depthLo, depthHi] = envelope(targetDepthTemplate);
    expect(slots.targetDepthMeters).toBeGreaterThanOrEqual(depthLo);
    expect(slots.targetDepthMeters).toBeLessThanOrEqual(depthHi);
    expect(slots.collisionEndsDive).toBe(false);
    expect(slots.respawnThreats).toBe(true);
    expect(slots.difficultyScaling).toBe("logarithmic");
    // Duration envelope around GAME_DURATION.
    const [durLo, durHi] = envelope(MODE_TEMPLATES.descent.durationSeconds);
    expect(slots.durationSeconds).toBeGreaterThanOrEqual(durLo);
    expect(slots.durationSeconds).toBeLessThanOrEqual(durHi);
    expect(slots.durationSeconds).toBeGreaterThan(GAME_DURATION - 120);
  });

  test("arena: infinite-traversal pockets, instant collision-fail, shoal-press threats", () => {
    const slots = resolveModeSlots("arena", SAMPLE_SEED);
    expect(slots.collisionEndsDive).toBe(true);
    expect(slots.completionCondition).toBe("infinite");
    expect(slots.threatPattern).toBe("shoal-press");
    // Arena's grace + penalty stay fixed at 0 — that IS arena's contract.
    expect(slots.impactGraceSeconds).toBe(0);
    expect(slots.impactOxygenPenaltySeconds).toBe(0);
    expect(slots.threatRadiusScale).toBeGreaterThan(1);
    expect(slots.predatorSpeedScale).toBeGreaterThan(1);
    expect(slots.respawnThreats).toBe(true);
  });

  test("legacy DiveModeTuning is composed from resolved slots", () => {
    for (const mode of SESSION_MODES) {
      const slots = resolveModeSlots(mode, SAMPLE_SEED);
      const tuning = getDiveModeTuning(mode, SAMPLE_SEED);
      expect(tuning.collisionEndsDive).toBe(slots.collisionEndsDive);
      expect(tuning.respawnThreats).toBe(slots.respawnThreats);
      expect(tuning.completionCondition).toBe(slots.completionCondition);
      expect(tuning.threatRadiusScale).toBe(slots.threatRadiusScale);
      expect(tuning.collectionOxygenScale).toBe(slots.collectionOxygenScale);
      expect(tuning.freeLateralMovement).toBe(slots.lateralMovement === "free");
      expect(tuning.freeVerticalMovement).toBe(slots.verticalMovement === "free");
    }
  });

  test("battery upgrade extends durationSeconds linearly on top of the seed-derived base", () => {
    const base = getDiveModeTuning("descent", SAMPLE_SEED).durationSeconds;
    const upgraded = getDiveModeTuning("descent", SAMPLE_SEED, {
      hull: 0,
      battery: 3,
      motor: 0,
      lamp: 0,
    }).durationSeconds;
    expect(upgraded - base).toBe(180);
  });

  test("hull upgrade reduces seed-derived impact penalty with a floor at 0", () => {
    const baseTuning = getDiveModeTuning("descent", SAMPLE_SEED);
    const basePenalty = baseTuning.impactOxygenPenaltySeconds;

    const lvl1 = getDiveModeTuning("descent", SAMPLE_SEED, {
      hull: 1, battery: 0, motor: 0, lamp: 0,
    });
    expect(lvl1.impactOxygenPenaltySeconds).toBe(Math.max(0, basePenalty - 10));

    // Beyond what the base can absorb — clamps at 0, never goes negative.
    const lvl5 = getDiveModeTuning("descent", SAMPLE_SEED, {
      hull: 5, battery: 0, motor: 0, lamp: 0,
    });
    expect(lvl5.impactOxygenPenaltySeconds).toBe(0);
  });
});
