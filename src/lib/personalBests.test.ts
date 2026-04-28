// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearPersonalBestsForTest,
  getPersonalBests,
  hasAnyImprovement,
  NO_IMPROVEMENTS,
  PERSONAL_BESTS_KEY,
  PERSONAL_BESTS_VERSION,
  ZERO_BESTS,
  recordDive,
} from "./personalBests";
import type { DiveRunSummary } from "@/sim";

function summary(overrides: Partial<DiveRunSummary> = {}): DiveRunSummary {
  return {
    beaconsRemaining: 10,
    completionPercent: 50,
    depthMeters: 1200,
    durationSeconds: 600,
    elapsedSeconds: 240,
    score: 1500,
    timeLeft: 360,
    totalBeacons: 18,
    stats: {
      predatorsKilled: 2,
      buffsCollected: 3,
      biomesTraversed: ["epipelagic", "mesopelagic"],
      maxChain: 4,
      impactsTaken: 1,
      adrenalineTriggers: 1,
      landmarksPassed: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  clearPersonalBestsForTest();
});

afterEach(() => {
  clearPersonalBestsForTest();
});

describe("personalBests — initial state", () => {
  test("getPersonalBests returns ZERO_BESTS when storage is empty", () => {
    expect(getPersonalBests()).toEqual(ZERO_BESTS);
  });

  test("ZERO_BESTS has the current schema version", () => {
    expect(ZERO_BESTS.version).toBe(PERSONAL_BESTS_VERSION);
  });

  test("hasAnyImprovement returns false for NO_IMPROVEMENTS", () => {
    expect(hasAnyImprovement(NO_IMPROVEMENTS)).toBe(false);
  });
});

describe("personalBests — first-dive recording", () => {
  test("first dive improves every category that beats zero", () => {
    const result = recordDive(summary());
    expect(result.improvements.score).toBe(true);
    expect(result.improvements.depthMeters).toBe(true);
    expect(result.improvements.maxChain).toBe(true);
    expect(result.improvements.predatorsKilled).toBe(true);
    expect(result.improvements.longestRunSeconds).toBe(true);
    expect(result.improvements.completionPercent).toBe(true);
    expect(hasAnyImprovement(result.improvements)).toBe(true);
  });

  test("first dive populates bests from summary", () => {
    const result = recordDive(summary({ score: 2000, depthMeters: 1800 }));
    expect(result.bests.score).toBe(2000);
    expect(result.bests.depthMeters).toBe(1800);
    expect(result.bests.maxChain).toBe(4);
    expect(result.bests.predatorsKilled).toBe(2);
    expect(result.bests.longestRunSeconds).toBe(240);
    expect(result.bests.completionPercent).toBe(50);
    expect(result.bests.lifetimeScore).toBe(2000);
    expect(result.bests.divesLogged).toBe(1);
  });

  test("persists to localStorage under the current key", () => {
    recordDive(summary({ score: 999 }));
    const raw = localStorage.getItem(PERSONAL_BESTS_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "{}").score).toBe(999);
  });

  test("subsequent reload reflects the persisted bests", () => {
    recordDive(summary({ score: 1234 }));
    const reloaded = getPersonalBests();
    expect(reloaded.score).toBe(1234);
    expect(reloaded.divesLogged).toBe(1);
  });
});

describe("personalBests — improvement detection", () => {
  test("worse score → no improvement", () => {
    recordDive(summary({ score: 5000 }));
    const result = recordDive(summary({ score: 3000 }));
    expect(result.improvements.score).toBe(false);
    expect(result.bests.score).toBe(5000);
  });

  test("equal value → no improvement (strict >)", () => {
    recordDive(summary({ score: 1500 }));
    const result = recordDive(summary({ score: 1500 }));
    expect(result.improvements.score).toBe(false);
    expect(result.bests.score).toBe(1500);
  });

  test("only category that improved is flagged", () => {
    recordDive(summary({ score: 1000, depthMeters: 1500 }));
    // New dive: better depth, worse score
    const result = recordDive(summary({ score: 800, depthMeters: 2000 }));
    expect(result.improvements.score).toBe(false);
    expect(result.improvements.depthMeters).toBe(true);
    expect(result.bests.score).toBe(1000);
    expect(result.bests.depthMeters).toBe(2000);
  });

  test("lifetime score and dives accumulate even on worse runs", () => {
    recordDive(summary({ score: 5000 }));
    recordDive(summary({ score: 100 }));
    const reloaded = getPersonalBests();
    expect(reloaded.lifetimeScore).toBe(5100);
    expect(reloaded.divesLogged).toBe(2);
    expect(reloaded.score).toBe(5000);
  });

  test("missing stats (legacy summary) doesn't crash", () => {
    const minimal: DiveRunSummary = {
      ...summary(),
      stats: undefined,
    };
    const result = recordDive(minimal);
    expect(result.bests.predatorsKilled).toBe(0);
    expect(result.bests.maxChain).toBe(1);
    expect(result.improvements.predatorsKilled).toBe(false);
    expect(result.improvements.maxChain).toBe(false);
  });
});

describe("personalBests — schema migration", () => {
  test("legacy payload missing fields gets coerced to ZERO defaults", () => {
    localStorage.setItem(
      PERSONAL_BESTS_KEY,
      JSON.stringify({ version: 1, score: 5000 }),
    );
    const loaded = getPersonalBests();
    expect(loaded.score).toBe(5000);
    expect(loaded.depthMeters).toBe(0);
    expect(loaded.maxChain).toBe(1);
    expect(loaded.divesLogged).toBe(0);
  });

  test("future-version payload is rejected → fresh ZERO_BESTS", () => {
    localStorage.setItem(
      PERSONAL_BESTS_KEY,
      JSON.stringify({ version: 999, score: 99999 }),
    );
    expect(getPersonalBests()).toEqual(ZERO_BESTS);
  });

  test("malformed JSON yields ZERO_BESTS", () => {
    localStorage.setItem(PERSONAL_BESTS_KEY, "{not valid json");
    expect(getPersonalBests()).toEqual(ZERO_BESTS);
  });

  test("non-numeric fields fall back to defaults", () => {
    localStorage.setItem(
      PERSONAL_BESTS_KEY,
      JSON.stringify({ version: 1, score: "hello", maxChain: NaN }),
    );
    const loaded = getPersonalBests();
    expect(loaded.score).toBe(0);
    expect(loaded.maxChain).toBe(1);
  });
});

describe("personalBests — storage failure resilience", () => {
  test("read failure returns ZERO_BESTS without throwing", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error("Privacy mode blocks reads");
    });
    try {
      expect(getPersonalBests()).toEqual(ZERO_BESTS);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  test("write failure still returns valid result with improvements", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error("Quota exceeded");
    });
    try {
      const result = recordDive(summary({ score: 1000 }));
      // Improvements still reflect what would have been written.
      expect(result.improvements.score).toBe(true);
      expect(result.bests.score).toBe(1000);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
