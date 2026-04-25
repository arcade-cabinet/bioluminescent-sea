import { describe, expect, it } from "vitest";
import { chunkAt } from "@/sim/factories/chunk";
import {
  BASE_CREATURES_PER_CHUNK,
  estimateWorldYMeters,
  spawnCreaturesForChunk,
  spawnCreaturesForChunks,
} from "./spawn";

const viewport = { width: 1280, height: 720 };

describe("spawnCreaturesForChunk", () => {
  it("produces the same creatures for the same chunk (determinism)", () => {
    const chunk = chunkAt(3, 0xdeadbeef);
    const a = spawnCreaturesForChunk(chunk, viewport);
    const b = spawnCreaturesForChunk(chunk, viewport);
    expect(a).toEqual(b);
  });

  it("gives every creature a unique id inside a chunk", () => {
    const chunk = chunkAt(2, 42);
    const creatures = spawnCreaturesForChunk(chunk, viewport);
    const ids = new Set(creatures.map((c) => c.id));
    expect(ids.size).toBe(creatures.length);
  });

  it("ids include the chunk index so cross-chunk ids stay distinct", () => {
    const a = spawnCreaturesForChunk(chunkAt(2, 42), viewport);
    const b = spawnCreaturesForChunk(chunkAt(5, 42), viewport);
    const aIds = new Set(a.map((c) => c.id));
    const bIds = new Set(b.map((c) => c.id));
    for (const id of bIds) expect(aIds.has(id)).toBe(false);
  });

  it("spawns more creatures in the densest biome than in the sparsest", () => {
    // Midnight column has the highest creatureDensity (1.0) — index 8
    // midpoint is 1700m, inside midnight-column (1200–2400m). Abyssal
    // has the lowest (0.4) — index 14 midpoint is 2900m, inside
    // abyssal-trench.
    const densest = spawnCreaturesForChunk(chunkAt(8, 42), viewport);
    const sparsest = spawnCreaturesForChunk(chunkAt(14, 42), viewport);
    expect(densest.length).toBeGreaterThan(sparsest.length);
  });

  it("places creatures inside the chunk's depth band via worldYMeters", () => {
    const chunk = chunkAt(4, 42);
    const creatures = spawnCreaturesForChunk(chunk, viewport);
    // All creatures' worldYMeters should fall inside the chunk's
    // vertical band (inset by the 0.12..0.88 normalized spread used
    // in the spawner).
    for (const c of creatures) {
      expect(c.worldYMeters).toBeDefined();
      const worldY = c.worldYMeters as number;
      expect(worldY).toBeGreaterThanOrEqual(chunk.yTopMeters);
      expect(worldY).toBeLessThanOrEqual(chunk.yBottomMeters);
    }
    // Screen-space y should still fall inside the viewport.
    for (const c of creatures) {
      expect(c.y).toBeGreaterThanOrEqual(viewport.height * 0.1);
      expect(c.y).toBeLessThanOrEqual(viewport.height * 0.9);
    }
  });

  it("worldYMeters matches the chunk index (different chunks get different depth bands)", () => {
    const shallow = spawnCreaturesForChunk(chunkAt(1, 42), viewport);
    const deep = spawnCreaturesForChunk(chunkAt(10, 42), viewport);
    // Every shallow creature must sit above every deep creature in
    // world-space, regardless of how their screen-y compares.
    const maxShallow = Math.max(...shallow.map((c) => c.worldYMeters ?? 0));
    const minDeep = Math.min(...deep.map((c) => c.worldYMeters ?? 0));
    expect(maxShallow).toBeLessThan(minDeep);
  });

  it("produces at least 1 creature even for the sparsest biome", () => {
    // abyssal density is ~0.3, BASE * 0.3 * 1.3 ≈ 1.17 → rounds to 1.
    const chunk = chunkAt(15, 42);
    const creatures = spawnCreaturesForChunk(chunk, viewport);
    expect(creatures.length).toBeGreaterThanOrEqual(1);
  });

  it("produces a bounded count (no runaway densities)", () => {
    // BASE * 1.3 * biomeDensity, where biomeDensity tops out around 1.4
    // for the densest biome — so the ceiling is BASE * 1.3 * 1.4 ≈
    // BASE * 1.9. Rounded up + a small grace margin.
    const ceiling = Math.ceil(BASE_CREATURES_PER_CHUNK * 1.9) + 2;
    for (let i = 0; i < 16; i++) {
      const creatures = spawnCreaturesForChunk(chunkAt(i, 42), viewport);
      expect(creatures.length).toBeLessThanOrEqual(ceiling);
    }
  });
});

describe("spawnCreaturesForChunks", () => {
  it("flatmaps creatures across chunks", () => {
    const chunks = [chunkAt(0, 42), chunkAt(1, 42), chunkAt(2, 42)];
    const creatures = spawnCreaturesForChunks(chunks, viewport);
    const expected = chunks
      .flatMap((c) => spawnCreaturesForChunk(c, viewport))
      .length;
    expect(creatures.length).toBe(expected);
  });

  it("is deterministic across the trench for a given master seed", () => {
    const chunks = Array.from({ length: 16 }, (_, i) => chunkAt(i, 0x1234));
    const a = spawnCreaturesForChunks(chunks, viewport);
    const b = spawnCreaturesForChunks(chunks, viewport);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});

describe("estimateWorldYMeters", () => {
  it("maps viewport center to the current depth", () => {
    expect(estimateWorldYMeters(360, 720, 1000)).toBeCloseTo(1000, 1);
  });

  it("maps viewport top to shallower than current depth", () => {
    expect(estimateWorldYMeters(0, 720, 1000)).toBeLessThan(1000);
  });

  it("maps viewport bottom to deeper than current depth", () => {
    expect(estimateWorldYMeters(720, 720, 1000)).toBeGreaterThan(1000);
  });

  it("clamps out-of-range pixel y", () => {
    // negative y clamps to 0 → half-chunk above current
    const above = estimateWorldYMeters(-100, 720, 1000);
    expect(above).toBeLessThan(1000);
    // super-deep y clamps to 1.0 → half-chunk below current
    const below = estimateWorldYMeters(10000, 720, 1000);
    expect(below).toBeGreaterThan(1000);
  });
});
