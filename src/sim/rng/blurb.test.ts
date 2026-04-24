import { describe, expect, it } from "vitest";
import { trenchBlurbForSeed } from "./blurb";

describe("trenchBlurbForSeed", () => {
  it("is deterministic for a given seed", () => {
    const a = trenchBlurbForSeed(12345);
    const b = trenchBlurbForSeed(12345);
    expect(a.full).toBe(b.full);
    expect(a.opener).toBe(b.opener);
    expect(a.body).toBe(b.body);
    expect(a.closer).toBe(b.closer);
  });

  it("produces different blurbs for different seeds in the same codename", () => {
    // Seeds that share the low 18 bits would share a codename, but we want
    // to confirm neighboring seeds produce different blurbs.
    const a = trenchBlurbForSeed(1);
    const b = trenchBlurbForSeed(2);
    expect(a.full).not.toBe(b.full);
  });

  it("returns non-empty opener, body, closer, and full strings", () => {
    for (let seed = 0; seed < 100; seed++) {
      const b = trenchBlurbForSeed(seed);
      expect(b.opener.length).toBeGreaterThan(0);
      expect(b.body.length).toBeGreaterThan(0);
      expect(b.closer.length).toBeGreaterThan(0);
      expect(b.full).toBe(`${b.opener} ${b.body} ${b.closer}`);
    }
  });

  it("covers a useful spread of the template pool across seeds", () => {
    // Spread seeds across the full 18-bit codename space so the sample hits
    // different opener/body/closer buckets. Sequential seeds share high bits,
    // which is why we step across the mask instead.
    const uniq = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const seed = (i * 1319) & ((1 << 18) - 1);
      uniq.add(trenchBlurbForSeed(seed).full);
    }
    // 8 × 12 × 7 = 672 possible combos; a 200-sample spread should hit at
    // least 60 unique blurbs.
    expect(uniq.size).toBeGreaterThanOrEqual(60);
  });
});
