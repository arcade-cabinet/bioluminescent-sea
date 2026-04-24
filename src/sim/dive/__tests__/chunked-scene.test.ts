import { describe, expect, it } from "vitest";
import { createChunkedScene } from "../chunked-scene";

const viewport = { width: 1280, height: 720 };

describe("createChunkedScene", () => {
  it("is deterministic for a given seed", () => {
    const a = createChunkedScene(42, viewport);
    const b = createChunkedScene(42, viewport);
    expect(a).toEqual(b);
  });

  it("produces different scenes for different seeds", () => {
    const a = createChunkedScene(1, viewport);
    const b = createChunkedScene(2, viewport);
    // Creature ids are chunk-index-based (stable across seeds) — the
    // seed varies positions + noise offsets within the chunk.
    expect(a.creatures.map((c) => c.x)).not.toEqual(b.creatures.map((c) => c.x));
  });

  it("starts at surface (depthTravelMeters = 0) by default", () => {
    const scene = createChunkedScene(42, viewport);
    expect(scene.depthTravelMeters).toBe(0);
  });

  it("seeds creatures across multiple chunks (not 18 fixed)", () => {
    const scene = createChunkedScene(42, viewport);
    // At surface with 400m viewport + 400m lookahead + 200m lookbehind,
    // chunks 0..3 are spawned (4 chunks). Each contributes ~2-3 creatures.
    expect(scene.creatures.length).toBeGreaterThan(4);
    // Ids are chunk-prefixed, not the legacy 'beacon-1' / 'beacon-2'.
    for (const c of scene.creatures) {
      expect(c.id).toMatch(/^beacon-c\d+-\d+$/);
    }
  });

  it("honors initialDepthTravelMeters to spawn from a given depth", () => {
    const surface = createChunkedScene(42, viewport, 0);
    const deep = createChunkedScene(42, viewport, 1200);
    expect(surface.depthTravelMeters).toBe(0);
    expect(deep.depthTravelMeters).toBe(1200);
    // Different depths → different chunk windows → different creatures.
    expect(surface.creatures.map((c) => c.id)).not.toEqual(
      deep.creatures.map((c) => c.id),
    );
  });

  it("still provides predators, pirates, particles, and a player", () => {
    const scene = createChunkedScene(42, viewport);
    expect(scene.player).toBeDefined();
    expect(scene.predators.length).toBeGreaterThan(0);
    expect(scene.pirates.length).toBeGreaterThan(0);
    expect(scene.particles.length).toBeGreaterThan(0);
  });
});
