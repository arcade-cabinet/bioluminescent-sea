import { describe, expect, it } from "vitest";
import {
  ADJECTIVES_PRIMARY,
  ADJECTIVES_SECONDARY,
  CODENAME_SEED_MASK,
  NOUNS,
  codenameFromSeed,
  codenamePartsFromSeed,
  codenameSlug,
  dailySeed,
  seedFromCodename,
} from "../codename";

describe("word pools", () => {
  it("have at least 64 unique entries each", () => {
    for (const pool of [ADJECTIVES_PRIMARY, ADJECTIVES_SECONDARY, NOUNS]) {
      expect(pool.length).toBeGreaterThanOrEqual(64);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it("contain no empty strings and no internal whitespace", () => {
    for (const pool of [ADJECTIVES_PRIMARY, ADJECTIVES_SECONDARY, NOUNS]) {
      for (const word of pool) {
        expect(word.length).toBeGreaterThan(0);
        expect(word).not.toMatch(/\s/);
      }
    }
  });
});

describe("codenameFromSeed", () => {
  it("produces a three-word codename", () => {
    expect(codenameFromSeed(12345).split(" ")).toHaveLength(3);
  });

  it("is deterministic", () => {
    expect(codenameFromSeed(42)).toBe(codenameFromSeed(42));
  });

  it("varies across adjacent seeds", () => {
    expect(codenameFromSeed(1)).not.toBe(codenameFromSeed(2));
  });

  it("ignores bits above the codename mask", () => {
    const low = 0b111111_111111_111111 & 0xffff;
    const high = (0xff << 18) | low;
    expect(codenameFromSeed(low)).toBe(codenameFromSeed(high));
  });
});

describe("seedFromCodename round-trip", () => {
  it("round-trips for sampled seeds across the range", () => {
    for (const s of [0, 1, 63, 64, 4095, 4096, 262143]) {
      const seed = s & CODENAME_SEED_MASK;
      const name = codenameFromSeed(seed);
      expect(seedFromCodename(name)).toBe(seed);
    }
  });

  it("accepts canonical, lowercase, and hyphenated forms", () => {
    const seed = 0b010101_101010_011001;
    const canonical = codenameFromSeed(seed);
    expect(seedFromCodename(canonical)).toBe(seed);
    expect(seedFromCodename(canonical.toLowerCase())).toBe(seed);
    expect(seedFromCodename(canonical.toLowerCase().replace(/ /g, "-"))).toBe(seed);
  });

  it("returns null for unknown words", () => {
    expect(seedFromCodename("foo bar baz")).toBeNull();
    expect(seedFromCodename("")).toBeNull();
    expect(seedFromCodename("Drowsy Ember")).toBeNull();
  });
});

describe("codenamePartsFromSeed", () => {
  it("exposes the three parts for UI consumption", () => {
    const parts = codenamePartsFromSeed(0);
    expect(parts.adjective1).toBe(ADJECTIVES_PRIMARY[0]);
    expect(parts.adjective2).toBe(ADJECTIVES_SECONDARY[0]);
    expect(parts.noun).toBe(NOUNS[0]);
  });
});

describe("codenameSlug", () => {
  it("produces a URL-safe hyphenated slug", () => {
    expect(codenameSlug("Drowsy Ember Anglerfish")).toBe("drowsy-ember-anglerfish");
  });
});

describe("dailySeed", () => {
  it("is stable for the same date", () => {
    const d = new Date(2026, 3, 23);
    expect(dailySeed(d)).toBe(dailySeed(d));
  });

  it("differs across days", () => {
    expect(dailySeed(new Date(2026, 3, 23))).not.toBe(dailySeed(new Date(2026, 3, 24)));
  });

  it("fits inside the codename seed mask", () => {
    expect(dailySeed(new Date(2099, 11, 31))).toBeLessThanOrEqual(CODENAME_SEED_MASK);
  });
});
