import { describe, expect, it } from "vitest";
import { CHUNK_HEIGHT_METERS, chunkAt, chunkIndexAtDepth, chunksInWindow } from "./chunk";

describe("chunkIndexAtDepth", () => {
  it("returns 0 at surface", () => {
    expect(chunkIndexAtDepth(0)).toBe(0);
  });

  it("returns 0 for depths inside the first chunk", () => {
    expect(chunkIndexAtDepth(CHUNK_HEIGHT_METERS - 1)).toBe(0);
  });

  it("crosses to index 1 exactly at the chunk boundary", () => {
    expect(chunkIndexAtDepth(CHUNK_HEIGHT_METERS)).toBe(1);
  });

  it("scales linearly for deep positions", () => {
    expect(chunkIndexAtDepth(CHUNK_HEIGHT_METERS * 5)).toBe(5);
    expect(chunkIndexAtDepth(CHUNK_HEIGHT_METERS * 5 + 10)).toBe(5);
  });

  it("clamps negative depths to 0", () => {
    expect(chunkIndexAtDepth(-50)).toBe(0);
  });
});

describe("chunkAt", () => {
  it("is deterministic for a given (index, seed)", () => {
    const a = chunkAt(3, 0x1234);
    const b = chunkAt(3, 0x1234);
    expect(a).toEqual(b);
  });

  it("produces different seeds for different indices", () => {
    expect(chunkAt(0, 0x1234).seed).not.toBe(chunkAt(1, 0x1234).seed);
  });

  it("produces different seeds for different master seeds", () => {
    expect(chunkAt(3, 0x1234).seed).not.toBe(chunkAt(3, 0x5678).seed);
  });

  it("sets yTopMeters + yBottomMeters a CHUNK_HEIGHT_METERS span apart", () => {
    const c = chunkAt(4, 42);
    expect(c.yBottomMeters - c.yTopMeters).toBe(CHUNK_HEIGHT_METERS);
  });

  it("assigns biome photic-gate for surface chunks", () => {
    // Index 0 midpoint = 200m, inside photic-gate (0-800m).
    expect(chunkAt(0, 42).biome).toBe("photic-gate");
  });

  it("assigns biome abyssal-trench for trench-floor chunks", () => {
    // Index 14 midpoint = 5800m, inside abyssal-trench (4800-6400m).
    expect(chunkAt(14, 42).biome).toBe("abyssal-trench");
  });
});

describe("chunksInWindow", () => {
  it("returns the chunk containing the camera at surface", () => {
    const chunks = chunksInWindow({
      depthTravelMeters: 0,
      viewportHeightMeters: 720,
      masterSeed: 42,
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].index).toBe(0);
  });

  it("includes chunks ahead and behind the camera", () => {
    const chunks = chunksInWindow({
      depthTravelMeters: 1200,
      viewportHeightMeters: 720,
      masterSeed: 42,
    });
    // Camera at 1200m, lookbehind 400m, lookahead = viewport + viewport
    // so indices should span roughly 2 → 6.
    const indices = chunks.map((c) => c.index);
    expect(indices[0]).toBeLessThanOrEqual(2);
    expect(indices[indices.length - 1]).toBeGreaterThanOrEqual(6);
  });

  it("chunk contents are stable across calls — same seed, same content", () => {
    const a = chunksInWindow({
      depthTravelMeters: 800,
      viewportHeightMeters: 720,
      masterSeed: 99,
    });
    const b = chunksInWindow({
      depthTravelMeters: 800,
      viewportHeightMeters: 720,
      masterSeed: 99,
    });
    expect(a).toEqual(b);
  });

  it("different master seeds produce different chunk seeds at the same position", () => {
    const a = chunksInWindow({
      depthTravelMeters: 600,
      viewportHeightMeters: 720,
      masterSeed: 1,
    });
    const b = chunksInWindow({
      depthTravelMeters: 600,
      viewportHeightMeters: 720,
      masterSeed: 2,
    });
    // Same indices but different per-chunk seeds.
    expect(a.map((c) => c.index)).toEqual(b.map((c) => c.index));
    expect(a.map((c) => c.seed)).not.toEqual(b.map((c) => c.seed));
  });
});
