import { describe, expect, test } from "vitest";
import { SESSION_MODES } from "@/sim/_shared/sessionMode";
import { getModeSlots, MODE_SLOTS } from "./slots";
import { getDiveModeTuning } from "@/sim/engine/mode";
import { GAME_DURATION } from "@/sim/dive/constants";

describe("dive mode slot system", () => {
  test("every SessionMode has a slot record", () => {
    for (const mode of SESSION_MODES) {
      expect(MODE_SLOTS[mode]).toBeDefined();
    }
  });

  test("exploration: drift the photic shelf — free movement, soft threats, no collision-fail", () => {
    const slots = getModeSlots("exploration");
    expect(slots.verticalMovement).toBe("free");
    expect(slots.lateralMovement).toBe("free");
    expect(slots.collisionEndsDive).toBe(false);
    expect(slots.respawnThreats).toBe(false);
    expect(slots.completionCondition).toBe("infinite");
    expect(slots.difficultyScaling).toBe("none");
    expect(slots.predatorSpeedScale).toBeLessThan(1);
    expect(slots.collectionOxygenScale).toBeGreaterThan(1);
    // Exploration is the most generous oxygen budget.
    expect(slots.durationSeconds).toBeGreaterThan(getModeSlots("descent").durationSeconds);
    expect(slots.durationSeconds).toBeGreaterThan(getModeSlots("arena").durationSeconds);
  });

  test("descent: lateral-locked plunge toward a depth goal with logarithmic pressure", () => {
    const slots = getModeSlots("descent");
    expect(slots.verticalMovement).toBe("free");
    expect(slots.lateralMovement).toBe("locked");
    expect(slots.completionCondition).toBe("depth_goal");
    expect(slots.targetDepthMeters).toBeGreaterThan(0);
    expect(slots.collisionEndsDive).toBe(false);
    expect(slots.respawnThreats).toBe(true);
    expect(slots.difficultyScaling).toBe("logarithmic");
    expect(slots.predatorSpeedScale).toBe(1);
    // Descent's tuning gets its base oxygen from GAME_DURATION via mode.ts.
    expect(getDiveModeTuning("descent").durationSeconds).toBe(GAME_DURATION);
  });

  test("arena: infinite-traversal pockets, instant collision-fail, shoal-press threats", () => {
    const slots = getModeSlots("arena");
    expect(slots.collisionEndsDive).toBe(true);
    // Arena is infinite — clear-to-advance lives at the chunk-archetype
    // layer (locked-room travel), not the dive completion slot.
    expect(slots.completionCondition).toBe("infinite");
    expect(slots.threatPattern).toBe("shoal-press");
    expect(slots.impactGraceSeconds).toBe(0);
    expect(slots.threatRadiusScale).toBeGreaterThan(1);
    expect(slots.predatorSpeedScale).toBeGreaterThan(1);
    expect(slots.respawnThreats).toBe(true);
  });

  test("legacy DiveModeTuning is composed from slots", () => {
    for (const mode of SESSION_MODES) {
      const slots = getModeSlots(mode);
      const tuning = getDiveModeTuning(mode);
      expect(tuning.collisionEndsDive).toBe(slots.collisionEndsDive);
      expect(tuning.respawnThreats).toBe(slots.respawnThreats);
      expect(tuning.completionCondition).toBe(slots.completionCondition);
      expect(tuning.threatRadiusScale).toBe(slots.threatRadiusScale);
      expect(tuning.collectionOxygenScale).toBe(slots.collectionOxygenScale);
      expect(tuning.freeLateralMovement).toBe(slots.lateralMovement === "free");
      expect(tuning.freeVerticalMovement).toBe(slots.verticalMovement === "free");
    }
  });

  test("battery upgrade extends durationSeconds linearly", () => {
    const base = getDiveModeTuning("descent").durationSeconds;
    const upgraded = getDiveModeTuning("descent", {
      hull: 0,
      battery: 3,
      motor: 0,
      lamp: 0,
    }).durationSeconds;
    expect(upgraded - base).toBe(180);
  });

  test("hull upgrade reduces impact penalty with a floor at 0", () => {
    // Descent's base penalty is 25s after the balance pass (was 45s).
    // Hull upgrade still subtracts 10s per level with a floor at 0.
    const baseSlots = getModeSlots("descent");
    expect(baseSlots.impactOxygenPenaltySeconds).toBe(25);

    const lvl1 = getDiveModeTuning("descent", { hull: 1, battery: 0, motor: 0, lamp: 0 });
    expect(lvl1.impactOxygenPenaltySeconds).toBe(15);

    const lvl2 = getDiveModeTuning("descent", { hull: 2, battery: 0, motor: 0, lamp: 0 });
    expect(lvl2.impactOxygenPenaltySeconds).toBe(5);

    // Beyond what the slot can absorb — clamps at 0, never goes negative.
    const lvl5 = getDiveModeTuning("descent", { hull: 5, battery: 0, motor: 0, lamp: 0 });
    expect(lvl5.impactOxygenPenaltySeconds).toBe(0);
  });
});
