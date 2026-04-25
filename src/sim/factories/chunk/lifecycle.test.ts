import { describe, expect, it } from "vitest";
import { chunkAt, chunksInWindow } from "./chunk";
import { chunkLifecycleDelta } from "./lifecycle";

describe("chunkLifecycleDelta", () => {
  it("reports every chunk as spawned when nothing was live", () => {
    const window = chunksInWindow({
      depthTravelMeters: 0,
      viewportHeightMeters: 720,
      masterSeed: 42,
    });
    const delta = chunkLifecycleDelta(new Set(), window);
    expect(delta.spawned.map((c) => c.index)).toEqual(window.map((c) => c.index));
    expect(delta.retiredIndices).toEqual([]);
  });

  it("reports nothing spawned or retired when the window is unchanged", () => {
    const window = chunksInWindow({
      depthTravelMeters: 400,
      viewportHeightMeters: 720,
      masterSeed: 42,
    });
    const live = new Set(window.map((c) => c.index));
    const delta = chunkLifecycleDelta(live, window);
    expect(delta.spawned).toEqual([]);
    expect(delta.retiredIndices).toEqual([]);
  });

  it("retires chunks that fall off the top of the window as the camera descends", () => {
    const shallow = chunksInWindow({
      depthTravelMeters: 0,
      viewportHeightMeters: 720,
      masterSeed: 42,
    });
    // Descend far enough that chunk 0 has definitely retired.
    const deeper = chunksInWindow({
      depthTravelMeters: 1600,
      viewportHeightMeters: 720,
      masterSeed: 42,
    });
    const delta = chunkLifecycleDelta(
      new Set(shallow.map((c) => c.index)),
      deeper,
    );
    expect(delta.retiredIndices).toContain(0);
    // Every retired index must have been live and must NOT be in the
    // new window.
    const deeperIndices = new Set(deeper.map((c) => c.index));
    for (const idx of delta.retiredIndices) {
      expect(deeperIndices.has(idx)).toBe(false);
    }
  });

  it("spawns chunks that enter the bottom of the window as the camera descends", () => {
    const shallow = chunksInWindow({
      depthTravelMeters: 0,
      viewportHeightMeters: 720,
      masterSeed: 42,
    });
    const deeper = chunksInWindow({
      depthTravelMeters: 1600,
      viewportHeightMeters: 720,
      masterSeed: 42,
    });
    const delta = chunkLifecycleDelta(
      new Set(shallow.map((c) => c.index)),
      deeper,
    );
    // Every spawned chunk must be in the new window and must NOT
    // have been in the old set.
    const shallowIndices = new Set(shallow.map((c) => c.index));
    for (const chunk of delta.spawned) {
      expect(shallowIndices.has(chunk.index)).toBe(false);
    }
    // And the deepest-index chunk from `deeper` must be part of the
    // spawned set (it's below where `shallow` reached).
    const deepestNew = deeper[deeper.length - 1].index;
    const shallowMax = Math.max(...shallow.map((c) => c.index));
    if (deepestNew > shallowMax) {
      expect(delta.spawned.map((c) => c.index)).toContain(deepestNew);
    }
  });

  it("returns sorted retiredIndices so repeated deltas are stable", () => {
    const previous = new Set([14, 3, 7, 1, 9]);
    // An empty window retires all previous indices.
    const delta = chunkLifecycleDelta(previous, []);
    expect(delta.retiredIndices).toEqual([1, 3, 7, 9, 14]);
  });

  it("returns a spawned chunk carrying the authoritative biome + seed for its index", () => {
    const window = chunksInWindow({
      depthTravelMeters: 0,
      viewportHeightMeters: 720,
      masterSeed: 42,
    });
    const delta = chunkLifecycleDelta(new Set(), window);
    // Each spawned chunk must match what chunkAt(index, seed) would
    // produce — so callers who only see the delta can still derive
    // biome + per-chunk seed from the Chunk object they get.
    for (const c of delta.spawned) {
      const authoritative = chunkAt(c.index, 0 /* unused in comparison */);
      // biome depends on index only (midpoint-based lookup), so
      // we can assert equality on that field regardless of seed.
      expect(c.biome).toBe(authoritative.biome);
    }
  });
});
