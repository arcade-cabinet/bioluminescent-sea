import { describe, expect, test } from "vitest";
import type { Chunk } from "@/sim/factories/region/types";
import { spawnPredatorsForChunk } from "./spawn";

/**
 * Patterns shape the chunk-level threat layout. The test asserts
 * structural differences, not exact positions — positions are
 * RNG-seeded and the point of the slot is *shape*, not coordinates.
 */

const viewport = { width: 800, height: 600 };

function makeChunk(biome: Chunk["biome"] = "mesopelagic"): Chunk {
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
    // No marauder subs in scattered. The chunk picks one of three
    // species prefixes (predator / torpedo-eel / shadow-octopus)
    // for visual variety.
    const allowedPrefixes = /^(predator|torpedo-eel|shadow-octopus)-/;
    for (const p of predators) {
      if (!p.isLeviathan) expect(p.id).toMatch(allowedPrefixes);
    }
  });

  test("swarm produces a denser layout than scattered with the same biome", () => {
    const scattered = spawnPredatorsForChunk(makeChunk(), viewport, "scattered");
    const swarm = spawnPredatorsForChunk(makeChunk(), viewport, "swarm");
    expect(swarm.length).toBeGreaterThan(scattered.length);
  });

  test("shoal-press produces many small fast predators and seeds marauder-subs", () => {
    const sp = spawnPredatorsForChunk(makeChunk(), viewport, "shoal-press");
    expect(sp.length).toBeGreaterThan(0);
    // Shoal-press predators are smaller and faster than scattered.
    const scattered = spawnPredatorsForChunk(makeChunk(), viewport, "scattered");
    const spAvgSize =
      sp.reduce((s, p) => s + p.size, 0) / sp.length;
    const scAvgSize =
      scattered.reduce((s, p) => s + p.size, 0) / scattered.length;
    expect(spAvgSize).toBeLessThan(scAvgSize);
    // At least one marauder-sub archetype spawned (archetype id prefix
    // lets AIManager route the enemy-sub-hunt steering).
    const marauders = sp.filter((p) => p.id.startsWith("marauder-sub-"));
    expect(marauders.length).toBeGreaterThan(0);
  });

  test("pattern dispatch is deterministic per seed", () => {
    const a = spawnPredatorsForChunk(makeChunk(), viewport, "shoal-press");
    const b = spawnPredatorsForChunk(makeChunk(), viewport, "shoal-press");
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    expect(a.map((p) => ({ x: p.x, y: p.y }))).toEqual(
      b.map((p) => ({ x: p.x, y: p.y })),
    );
  });

  test.each(["scattered", "swarm", "shoal-press"] as const)(
    "hadal leviathan still spawns under %s pattern",
    (pattern) => {
      // The leviathan is a named boss spawned independently of the
      // pattern. Verify across all three patterns: in at least one
      // seeded variant, a hadal-zone chunk should carry a leviathan.
      let sawLeviathan = false;
      for (let seed = 0; seed < 20 && !sawLeviathan; seed++) {
        const chunk: Chunk = {
          biome: "hadopelagic",
          index: seed,
          seed: seed * 1000 + 17,
          yTopMeters: 6000,
          yBottomMeters: 6200,
        };
        const pred = spawnPredatorsForChunk(chunk, viewport, pattern);
        if (pred.some((p) => p.isLeviathan)) sawLeviathan = true;
      }
      expect(sawLeviathan).toBe(true);
    },
  );
});
