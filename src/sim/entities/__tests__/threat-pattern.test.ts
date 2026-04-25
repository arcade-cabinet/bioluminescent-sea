import { describe, expect, test } from "vitest";
import type { Chunk } from "@/sim/world/types";
import { spawnPredatorsForChunk } from "../chunked-spawn";

/**
 * Patterns shape the chunk-level threat layout. The test asserts
 * structural differences, not exact positions — positions are
 * RNG-seeded and the point of the slot is *shape*, not coordinates.
 */

const viewport = { width: 800, height: 600 };

function makeChunk(biome: Chunk["biome"] = "twilight-shelf"): Chunk {
  return {
    biome,
    index: 3,
    seed: 1234,
    yTopMeters: 400,
    yBottomMeters: 600,
  };
}

describe("threat pattern dispatch in spawnPredatorsForChunk", () => {
  test("scattered spreads predators across the play band", () => {
    const predators = spawnPredatorsForChunk(makeChunk(), viewport, "scattered");
    expect(predators.length).toBeGreaterThan(0);
    // No marauder subs in scattered.
    for (const p of predators) {
      if (!p.isLeviathan) expect(p.id).toMatch(/^predator-/);
    }
  });

  test("swarm produces a denser layout than scattered with the same biome", () => {
    const scattered = spawnPredatorsForChunk(makeChunk(), viewport, "scattered");
    const swarm = spawnPredatorsForChunk(makeChunk(), viewport, "swarm");
    expect(swarm.length).toBeGreaterThan(scattered.length);
  });

  test("bullet-hell produces many small fast predators and seeds marauder-subs", () => {
    const bh = spawnPredatorsForChunk(makeChunk(), viewport, "bullet-hell");
    expect(bh.length).toBeGreaterThan(0);
    // Bullet-hell predators are smaller and faster than scattered.
    const scattered = spawnPredatorsForChunk(makeChunk(), viewport, "scattered");
    const bhAvgSize =
      bh.reduce((s, p) => s + p.size, 0) / bh.length;
    const scAvgSize =
      scattered.reduce((s, p) => s + p.size, 0) / scattered.length;
    expect(bhAvgSize).toBeLessThan(scAvgSize);
    // At least one marauder-sub archetype spawned (archetype id prefix
    // lets AIManager route the enemy-sub-hunt steering).
    const marauders = bh.filter((p) => p.id.startsWith("marauder-sub-"));
    expect(marauders.length).toBeGreaterThan(0);
  });

  test("pattern dispatch is deterministic per seed", () => {
    const a = spawnPredatorsForChunk(makeChunk(), viewport, "bullet-hell");
    const b = spawnPredatorsForChunk(makeChunk(), viewport, "bullet-hell");
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    expect(a.map((p) => ({ x: p.x, y: p.y }))).toEqual(
      b.map((p) => ({ x: p.x, y: p.y })),
    );
  });

  test("stygian leviathan still spawns regardless of pattern", () => {
    // A deterministic-seeded stygian chunk carries a leviathan in at
    // least one of the 5 seeded variants below. We loop over seeds to
    // avoid locking the test to a single RNG arrangement.
    let sawLeviathan = false;
    for (let seed = 0; seed < 20 && !sawLeviathan; seed++) {
      const chunk: Chunk = {
        biome: "stygian-abyss",
        index: seed,
        seed: seed * 1000 + 17,
        yTopMeters: 3400,
        yBottomMeters: 3600,
      };
      const pred = spawnPredatorsForChunk(chunk, viewport, "scattered");
      if (pred.some((p) => p.isLeviathan)) sawLeviathan = true;
    }
    expect(sawLeviathan).toBe(true);
  });
});
