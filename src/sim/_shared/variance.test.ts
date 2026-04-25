import { describe, expect, test } from "vitest";
import { resolveNumeric, resolvePick, subseed } from "./variance";

describe("variance primitive", () => {
  test("a fixed number resolves to itself regardless of seed", () => {
    expect(resolveNumeric(1500, 1, "tag")).toBe(1500);
    expect(resolveNumeric(1500, 999_999, "tag")).toBe(1500);
  });

  test("a range resolves inside [min, max]", () => {
    for (let s = 1; s <= 32; s++) {
      const v = resolveNumeric([10, 20], s, "test:knob");
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  test("integer mode returns inclusive integers", () => {
    for (let s = 1; s <= 32; s++) {
      const v = resolveNumeric([1200, 2400], s, "test:depth", true);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1200);
      expect(v).toBeLessThanOrEqual(2400);
    }
  });

  test("same (template, seed, tag) is stable across calls", () => {
    const a = resolveNumeric([0, 100], 42, "stable");
    const b = resolveNumeric([0, 100], 42, "stable");
    expect(a).toBe(b);
  });

  test("different tags produce independent draws for the same seed", () => {
    const v1 = resolveNumeric([0, 1], 42, "a");
    const v2 = resolveNumeric([0, 1], 42, "b");
    // The probability of two draws colliding to the same float is
    // effectively zero for a quality PRNG. If this fires, the
    // subseed namespacing is broken.
    expect(v1).not.toBe(v2);
  });

  test("different seeds produce different values for the same tag", () => {
    // Across many seeds, we should see plenty of distinct values.
    const draws = new Set<number>();
    for (let s = 1; s <= 32; s++) {
      draws.add(resolveNumeric([0, 1], s, "tag"));
    }
    expect(draws.size).toBeGreaterThan(20);
  });

  test("subseed is order-independent across tags but seed-dependent", () => {
    // Same tag + same seed → same subseed.
    expect(subseed(42, "x")).toBe(subseed(42, "x"));
    // Different tags → different subseeds.
    expect(subseed(42, "x")).not.toBe(subseed(42, "y"));
    // Different seeds → different subseeds.
    expect(subseed(42, "x")).not.toBe(subseed(43, "x"));
  });

  test("resolvePick selects deterministically per (seed, tag)", () => {
    const opts = ["a", "b", "c", "d"] as const;
    expect(resolvePick(opts, 100, "tag")).toBe(resolvePick(opts, 100, "tag"));
  });

  test("resolvePick samples across the option list across seeds", () => {
    const opts = ["a", "b", "c", "d"] as const;
    const seen = new Set<string>();
    for (let s = 1; s <= 64; s++) seen.add(resolvePick(opts, s, "tag"));
    // With 4 options and 64 seeds we should hit all of them.
    expect(seen.size).toBe(opts.length);
  });
});
