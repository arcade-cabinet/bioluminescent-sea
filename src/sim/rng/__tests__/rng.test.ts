import { describe, expect, it } from "vitest";
import { createRng, hashSeed } from "../rng";

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const sampleA = Array.from({ length: 16 }, () => a.next());
    const sampleB = Array.from({ length: 16 }, () => b.next());
    expect(sampleA).toEqual(sampleB);
  });

  it("produces values in [0, 1)", () => {
    const rng = createRng(99999);
    for (let i = 0; i < 2048; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int is inclusive on both ends", () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 512; i++) seen.add(rng.int(0, 3));
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  it("range stays within [min, max)", () => {
    const rng = createRng(11);
    for (let i = 0; i < 256; i++) {
      const v = rng.range(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });

  it("pick throws on empty", () => {
    const rng = createRng(1);
    expect(() => rng.pick([])).toThrow();
  });

  it("shuffle preserves elements", () => {
    const rng = createRng(3);
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle([...original]);
    expect(shuffled.sort()).toEqual(original);
  });

  it("gaussian stays in [-1, 1] and centers around 0", () => {
    const rng = createRng(13);
    let sum = 0;
    const N = 4096;
    for (let i = 0; i < N; i++) {
      const v = rng.gaussian();
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      sum += v;
    }
    expect(Math.abs(sum / N)).toBeLessThan(0.1);
  });

  it("exposes the starting seed", () => {
    expect(createRng(12345).seed).toBe(12345);
  });
});

describe("hashSeed", () => {
  it("is deterministic", () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
  });

  it("varies across inputs", () => {
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(1, 2, 4));
    expect(hashSeed(1, 0)).not.toBe(hashSeed(0, 1));
  });

  it("returns a uint32", () => {
    const h = hashSeed(123456, 987654);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
