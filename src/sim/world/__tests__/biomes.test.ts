import { describe, expect, it } from "vitest";
import { BIOMES, biomeAtDepth, biomeById, nextBiome } from "../biomes";

describe("BIOMES", () => {
  it("covers a contiguous depth range starting at 0", () => {
    expect(BIOMES[0].depthStartMeters).toBe(0);
    for (let i = 1; i < BIOMES.length; i++) {
      expect(BIOMES[i].depthStartMeters).toBe(BIOMES[i - 1].depthEndMeters);
    }
  });

  it("has strictly monotonic depths", () => {
    for (const biome of BIOMES) {
      expect(biome.depthEndMeters).toBeGreaterThan(biome.depthStartMeters);
    }
  });

  it("exposes four biomes in the expected order", () => {
    expect(BIOMES.map((b) => b.id)).toEqual([
      "photic-gate",
      "twilight-shelf",
      "midnight-column",
      "abyssal-trench",
    ]);
  });
});

describe("biomeAtDepth", () => {
  it("returns the first biome at the surface", () => {
    expect(biomeAtDepth(0).id).toBe("photic-gate");
    expect(biomeAtDepth(399).id).toBe("photic-gate");
  });

  it("snaps on boundaries toward the deeper biome", () => {
    expect(biomeAtDepth(800).id).toBe("twilight-shelf");
    expect(biomeAtDepth(2400).id).toBe("midnight-column");
    expect(biomeAtDepth(4800).id).toBe("abyssal-trench");
  });

  it("clamps past the deepest end to stygian-abyss", () => {
    expect(biomeAtDepth(9999).id).toBe("stygian-abyss");
  });
});

describe("biomeById", () => {
  it("returns the biome matching the id", () => {
    expect(biomeById("midnight-column").label).toBe("Midnight Column");
  });
});

describe("nextBiome", () => {
  it("chains in order", () => {
    expect(nextBiome("photic-gate")?.id).toBe("twilight-shelf");
    expect(nextBiome("twilight-shelf")?.id).toBe("midnight-column");
    expect(nextBiome("midnight-column")?.id).toBe("abyssal-trench");
  });

  it("returns stygian-abyss after abyssal trench", () => {
    expect(nextBiome("abyssal-trench")?.id).toBe("stygian-abyss");
  });

  it("returns null after stygian-abyss", () => {
    expect(nextBiome("stygian-abyss")).toBeNull();
  });
});
