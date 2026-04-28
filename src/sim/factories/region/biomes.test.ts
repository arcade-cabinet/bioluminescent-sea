import { describe, expect, it } from "vitest";
import { BIOMES, biomeAtDepth, biomeById, nextBiome } from "./biomes";

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

  it("exposes the five proper pelagic depth zones in surface→hadal order", () => {
    expect(BIOMES.map((b) => b.id)).toEqual([
      "epipelagic",
      "mesopelagic",
      "bathypelagic",
      "abyssopelagic",
      "hadopelagic",
    ]);
  });
});

describe("biomeAtDepth", () => {
  it("returns the surface zone at depth 0", () => {
    expect(biomeAtDepth(0).id).toBe("epipelagic");
    expect(biomeAtDepth(499).id).toBe("epipelagic");
  });

  it("snaps on boundaries toward the deeper zone", () => {
    expect(biomeAtDepth(500).id).toBe("mesopelagic");
    expect(biomeAtDepth(1500).id).toBe("bathypelagic");
    expect(biomeAtDepth(3000).id).toBe("abyssopelagic");
    expect(biomeAtDepth(5000).id).toBe("hadopelagic");
  });

  it("clamps past the deepest end to the hadal zone", () => {
    // The hadal extends to 11000m (Challenger Deep ~10994m). Past
    // that the function returns the deepest zone rather than null —
    // descent has no floor.
    expect(biomeAtDepth(99999).id).toBe("hadopelagic");
  });
});

describe("biomeById", () => {
  it("returns the biome matching the id", () => {
    expect(biomeById("bathypelagic").label).toBe("Midnight Zone");
    expect(biomeById("hadopelagic").scientificName).toBe("Hadopelagic");
  });
});

describe("nextBiome", () => {
  it("chains in order from surface to hadal", () => {
    expect(nextBiome("epipelagic")?.id).toBe("mesopelagic");
    expect(nextBiome("mesopelagic")?.id).toBe("bathypelagic");
    expect(nextBiome("bathypelagic")?.id).toBe("abyssopelagic");
    expect(nextBiome("abyssopelagic")?.id).toBe("hadopelagic");
  });

  it("returns null after the hadal — there is no zone deeper", () => {
    expect(nextBiome("hadopelagic")).toBeNull();
  });
});
