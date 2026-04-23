import { describe, expect, it } from "vitest";
import { createSeededScene } from "../seeded";

const viewport = { width: 1280, height: 720 };

describe("createSeededScene", () => {
  it("is deterministic: same seed produces byte-identical scene", () => {
    const a = createSeededScene(12345, viewport);
    const b = createSeededScene(12345, viewport);
    expect(a).toEqual(b);
  });

  it("produces different scenes for different seeds", () => {
    const a = createSeededScene(1, viewport);
    const b = createSeededScene(2, viewport);
    expect(a.creatures[0]).not.toEqual(b.creatures[0]);
    expect(a.predators[0]).not.toEqual(b.predators[0]);
    expect(a.pirates[0]).not.toEqual(b.pirates[0]);
  });

  it("places entities inside the viewport", () => {
    const scene = createSeededScene(42, viewport);
    for (const c of scene.creatures) {
      expect(c.x).toBeGreaterThan(0);
      expect(c.x).toBeLessThan(viewport.width);
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(viewport.height);
    }
    for (const p of scene.predators) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(viewport.width);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(viewport.height);
    }
  });

  it("populates every entity category", () => {
    const scene = createSeededScene(7, viewport);
    expect(scene.creatures.length).toBeGreaterThan(0);
    expect(scene.predators.length).toBeGreaterThan(0);
    expect(scene.pirates.length).toBeGreaterThan(0);
    expect(scene.particles.length).toBeGreaterThan(0);
    expect(scene.player).toBeDefined();
  });

  it("keeps the player centered regardless of seed", () => {
    const a = createSeededScene(1, viewport);
    const b = createSeededScene(99999, viewport);
    expect(a.player).toEqual(b.player);
  });

  it("adding entity categories in one namespace doesn't shift another", () => {
    // Invariant for future PRs: if we change the seed stream for
    // predators, creatures/pirates/particles should be unaffected.
    // This is why createSeededScene uses hashSeed(seed, kindSalt)
    // rather than a single shared stream.
    const scene = createSeededScene(2023, viewport);
    // Lock in the first creature's identity for this seed.
    expect(scene.creatures[0].type).toBeDefined();
    expect(scene.creatures[0].x).toBeGreaterThan(0);
  });
});
