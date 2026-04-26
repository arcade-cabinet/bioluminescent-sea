import { describe, expect, test } from "vitest";
import { advanceRunStats, ZERO_STATS, ensureRunStats } from "./runStats";

const baseFrame = {
  predatorKillsThisFrame: 0,
  anomalyPickupsThisFrame: 0,
  currentBiomeId: "photic-gate",
  currentMultiplier: 1,
  collidedThisFrame: false,
  adrenalineRisingEdge: false,
};

describe("runStats — initial state", () => {
  test("ZERO_STATS represents a fresh dive", () => {
    expect(ZERO_STATS.predatorsKilled).toBe(0);
    expect(ZERO_STATS.buffsCollected).toBe(0);
    expect(ZERO_STATS.biomesTraversed).toEqual([]);
    expect(ZERO_STATS.maxChain).toBe(1);
    expect(ZERO_STATS.impactsTaken).toBe(0);
    expect(ZERO_STATS.adrenalineTriggers).toBe(0);
  });

  test("ensureRunStats returns ZERO_STATS for undefined input", () => {
    expect(ensureRunStats(undefined)).toBe(ZERO_STATS);
  });

  test("ensureRunStats returns the input unchanged for defined input", () => {
    const custom = { ...ZERO_STATS, predatorsKilled: 5 };
    expect(ensureRunStats(custom)).toBe(custom);
  });
});

describe("runStats — accumulators", () => {
  test("predator kills accumulate", () => {
    const after = advanceRunStats(ZERO_STATS, {
      ...baseFrame,
      predatorKillsThisFrame: 2,
    });
    expect(after.predatorsKilled).toBe(2);
    const after2 = advanceRunStats(after, {
      ...baseFrame,
      predatorKillsThisFrame: 1,
    });
    expect(after2.predatorsKilled).toBe(3);
  });

  test("buff pickups accumulate", () => {
    const after = advanceRunStats(ZERO_STATS, {
      ...baseFrame,
      anomalyPickupsThisFrame: 1,
    });
    expect(after.buffsCollected).toBe(1);
  });

  test("biomes traversed dedupe and preserve order", () => {
    const a = advanceRunStats(ZERO_STATS, baseFrame);
    expect(a.biomesTraversed).toEqual(["photic-gate"]);
    const b = advanceRunStats(a, baseFrame); // same biome again
    expect(b.biomesTraversed).toEqual(["photic-gate"]);
    expect(b.biomesTraversed).toBe(a.biomesTraversed); // no allocation
    const c = advanceRunStats(b, { ...baseFrame, currentBiomeId: "twilight-shelf" });
    expect(c.biomesTraversed).toEqual(["photic-gate", "twilight-shelf"]);
  });

  test("maxChain tracks peak only", () => {
    let s = advanceRunStats(ZERO_STATS, { ...baseFrame, currentMultiplier: 3 });
    expect(s.maxChain).toBe(3);
    s = advanceRunStats(s, { ...baseFrame, currentMultiplier: 1 });
    expect(s.maxChain).toBe(3); // doesn't decay
    s = advanceRunStats(s, { ...baseFrame, currentMultiplier: 7 });
    expect(s.maxChain).toBe(7); // climbs to new peak
  });

  test("impacts taken count rising-edge frames only", () => {
    const a = advanceRunStats(ZERO_STATS, { ...baseFrame, collidedThisFrame: true });
    expect(a.impactsTaken).toBe(1);
    const b = advanceRunStats(a, { ...baseFrame, collidedThisFrame: false });
    expect(b.impactsTaken).toBe(1);
    const c = advanceRunStats(b, { ...baseFrame, collidedThisFrame: true });
    expect(c.impactsTaken).toBe(2);
  });

  test("adrenaline triggers count rising edges", () => {
    const a = advanceRunStats(ZERO_STATS, { ...baseFrame, adrenalineRisingEdge: true });
    expect(a.adrenalineTriggers).toBe(1);
    const b = advanceRunStats(a, { ...baseFrame, adrenalineRisingEdge: false });
    expect(b.adrenalineTriggers).toBe(1);
    const c = advanceRunStats(b, { ...baseFrame, adrenalineRisingEdge: true });
    expect(c.adrenalineTriggers).toBe(2);
  });

  test("does not mutate input", () => {
    const before = ZERO_STATS;
    const after = advanceRunStats(before, {
      ...baseFrame,
      predatorKillsThisFrame: 5,
    });
    expect(before.predatorsKilled).toBe(0);
    expect(after).not.toBe(before);
  });

  test("composes a realistic dive arc", () => {
    let s: ReturnType<typeof advanceRunStats> = ZERO_STATS;
    // Frame 1: enter photic-gate, build chain to 3, kill a predator.
    s = advanceRunStats(s, {
      ...baseFrame,
      predatorKillsThisFrame: 1,
      currentMultiplier: 3,
    });
    // Frame 2: collect a buff.
    s = advanceRunStats(s, { ...baseFrame, anomalyPickupsThisFrame: 1 });
    // Frame 3: descend to twilight-shelf, take a hit.
    s = advanceRunStats(s, {
      ...baseFrame,
      currentBiomeId: "twilight-shelf",
      collidedThisFrame: true,
    });
    // Frame 4: adrenaline triggers.
    s = advanceRunStats(s, {
      ...baseFrame,
      currentBiomeId: "twilight-shelf",
      adrenalineRisingEdge: true,
    });

    expect(s).toEqual({
      predatorsKilled: 1,
      buffsCollected: 1,
      biomesTraversed: ["photic-gate", "twilight-shelf"],
      maxChain: 3,
      impactsTaken: 1,
      adrenalineTriggers: 1,
    });
  });
});
