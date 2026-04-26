// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_ID,
  ACHIEVEMENTS_KEY,
  ACHIEVEMENTS_VERSION,
  clearAchievementsForTest,
  evaluateAchievements,
  getAchievementProgress,
  getUnlockedAchievements,
  listAchievementsWithUnlockState,
} from "./achievements";
import { ZERO_BESTS, type PersonalBests } from "./personalBests";
import type { DiveRunSummary } from "@/sim";

function makeBests(overrides: Partial<PersonalBests> = {}): PersonalBests {
  return { ...ZERO_BESTS, ...overrides };
}

function makeSummary(overrides: Partial<DiveRunSummary> = {}): DiveRunSummary {
  return {
    beaconsRemaining: 18,
    completionPercent: 0,
    depthMeters: 0,
    durationSeconds: 600,
    elapsedSeconds: 0,
    score: 0,
    timeLeft: 600,
    totalBeacons: 18,
    stats: {
      predatorsKilled: 0,
      buffsCollected: 0,
      biomesTraversed: [],
      maxChain: 1,
      impactsTaken: 0,
      adrenalineTriggers: 0,
    },
    ...overrides,
  };
}

beforeEach(() => {
  clearAchievementsForTest();
});

afterEach(() => {
  clearAchievementsForTest();
});

describe("achievements — catalog integrity", () => {
  test("every achievement has a unique id", () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
  });

  test("ACHIEVEMENT_BY_ID matches the catalog", () => {
    for (const def of ACHIEVEMENTS) {
      expect(ACHIEVEMENT_BY_ID[def.id]).toBe(def);
    }
  });

  test("every achievement has non-empty title and description", () => {
    for (const def of ACHIEVEMENTS) {
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });
});

describe("achievements — initial state", () => {
  test("getUnlockedAchievements is empty on a fresh install", () => {
    expect(getUnlockedAchievements().size).toBe(0);
  });

  test("getAchievementProgress reports 0 / N", () => {
    const p = getAchievementProgress();
    expect(p.unlocked).toBe(0);
    expect(p.total).toBe(ACHIEVEMENTS.length);
  });
});

describe("achievements — first-blood unlock", () => {
  test("zero predators killed → no unlock", () => {
    const result = evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 0 }),
      summary: makeSummary(),
    });
    const ids = result.newlyUnlocked.map((a) => a.id);
    expect(ids).not.toContain("first-blood");
  });

  test("one predator killed → unlocks first-blood", () => {
    const result = evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 1 }),
      summary: makeSummary({
        stats: {
          predatorsKilled: 1,
          buffsCollected: 0,
          biomesTraversed: [],
          maxChain: 1,
          impactsTaken: 0,
          adrenalineTriggers: 0,
        },
      }),
    });
    const ids = result.newlyUnlocked.map((a) => a.id);
    expect(ids).toContain("first-blood");
  });

  test("first-blood doesn't fire twice", () => {
    evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 1 }),
      summary: makeSummary(),
    });
    const second = evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 5 }),
      summary: makeSummary(),
    });
    const ids = second.newlyUnlocked.map((a) => a.id);
    expect(ids).not.toContain("first-blood");
  });
});

describe("achievements — depth tier ladder", () => {
  test("600 m unlocks Photic Pioneer", () => {
    const r = evaluateAchievements({
      postBests: makeBests({ depthMeters: 600 }),
      summary: makeSummary({ depthMeters: 600 }),
    });
    expect(r.newlyUnlocked.map((a) => a.id)).toContain("kelp-gate-opened");
  });

  test("3200 m unlocks all four depth tiers in one dive", () => {
    const r = evaluateAchievements({
      postBests: makeBests({ depthMeters: 3200 }),
      summary: makeSummary({ depthMeters: 3200 }),
    });
    const ids = r.newlyUnlocked.map((a) => a.id);
    expect(ids).toContain("kelp-gate-opened");
    expect(ids).toContain("twilight-traveler");
    expect(ids).toContain("midnight-resident");
    expect(ids).toContain("abyss-cartographer");
  });

  test("subsequent dives don't re-unlock tiers", () => {
    evaluateAchievements({
      postBests: makeBests({ depthMeters: 3200 }),
      summary: makeSummary({ depthMeters: 3200 }),
    });
    const r2 = evaluateAchievements({
      postBests: makeBests({ depthMeters: 3500 }),
      summary: makeSummary({ depthMeters: 3500 }),
    });
    expect(r2.newlyUnlocked).toEqual([]);
  });
});

describe("achievements — chain ladder", () => {
  test("×3 unlocks Chain Starter", () => {
    const r = evaluateAchievements({
      postBests: makeBests({ maxChain: 3 }),
      summary: makeSummary(),
    });
    expect(r.newlyUnlocked.map((a) => a.id)).toContain("chain-starter");
  });

  test("×10 unlocks Streak Master", () => {
    const r = evaluateAchievements({
      postBests: makeBests({ maxChain: 10 }),
      summary: makeSummary(),
    });
    expect(r.newlyUnlocked.map((a) => a.id)).toContain("streak-master");
  });

  test("×2 unlocks neither", () => {
    const r = evaluateAchievements({
      postBests: makeBests({ maxChain: 2 }),
      summary: makeSummary(),
    });
    const ids = r.newlyUnlocked.map((a) => a.id);
    expect(ids).not.toContain("chain-starter");
    expect(ids).not.toContain("streak-master");
  });
});

describe("achievements — single-dive criteria", () => {
  test("predator-hunter requires 10 in ONE dive", () => {
    // Lifetime 100 but single-dive 5 — should not unlock predator-hunter
    const r = evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 100 }),
      summary: makeSummary({
        stats: {
          predatorsKilled: 5,
          buffsCollected: 0,
          biomesTraversed: [],
          maxChain: 1,
          impactsTaken: 0,
          adrenalineTriggers: 0,
        },
      }),
    });
    expect(r.newlyUnlocked.map((a) => a.id)).not.toContain("predator-hunter");
  });

  test("predator-hunter unlocks when single-dive ≥ 10", () => {
    const r = evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 10 }),
      summary: makeSummary({
        stats: {
          predatorsKilled: 10,
          buffsCollected: 0,
          biomesTraversed: [],
          maxChain: 1,
          impactsTaken: 0,
          adrenalineTriggers: 0,
        },
      }),
    });
    expect(r.newlyUnlocked.map((a) => a.id)).toContain("predator-hunter");
  });

  test("biome-tour requires 4 biomes in one dive", () => {
    const r = evaluateAchievements({
      postBests: makeBests(),
      summary: makeSummary({
        stats: {
          predatorsKilled: 0,
          buffsCollected: 0,
          biomesTraversed: [
            "photic-gate",
            "twilight-shelf",
            "midnight-column",
            "abyssal-trench",
          ],
          maxChain: 1,
          impactsTaken: 0,
          adrenalineTriggers: 0,
        },
      }),
    });
    expect(r.newlyUnlocked.map((a) => a.id)).toContain("biome-tour");
  });
});

describe("achievements — perfect-run special case", () => {
  test("untouched: 100% completion + 0 hits", () => {
    const r = evaluateAchievements({
      postBests: makeBests(),
      summary: makeSummary({
        completionPercent: 100,
        stats: {
          predatorsKilled: 0,
          buffsCollected: 0,
          biomesTraversed: [],
          maxChain: 1,
          impactsTaken: 0,
          adrenalineTriggers: 0,
        },
      }),
    });
    expect(r.newlyUnlocked.map((a) => a.id)).toContain("perfect-run");
  });

  test("100% but took a hit → not unlocked", () => {
    const r = evaluateAchievements({
      postBests: makeBests(),
      summary: makeSummary({
        completionPercent: 100,
        stats: {
          predatorsKilled: 0,
          buffsCollected: 0,
          biomesTraversed: [],
          maxChain: 1,
          impactsTaken: 1,
          adrenalineTriggers: 0,
        },
      }),
    });
    expect(r.newlyUnlocked.map((a) => a.id)).not.toContain("perfect-run");
  });

  test("0 hits but didn't complete → not unlocked", () => {
    const r = evaluateAchievements({
      postBests: makeBests(),
      summary: makeSummary({ completionPercent: 80 }),
    });
    expect(r.newlyUnlocked.map((a) => a.id)).not.toContain("perfect-run");
  });
});

describe("achievements — persistence", () => {
  test("unlocked state persists across calls", () => {
    evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 1 }),
      summary: makeSummary(),
    });
    const reloaded = getUnlockedAchievements();
    expect(reloaded.has("first-blood")).toBe(true);
  });

  test("evaluate without unlocks doesn't write storage", () => {
    // First call: nothing crosses thresholds.
    const r = evaluateAchievements({
      postBests: makeBests(),
      summary: makeSummary(),
    });
    expect(r.newlyUnlocked).toEqual([]);
    // Storage should be untouched (no write).
    expect(localStorage.getItem(ACHIEVEMENTS_KEY)).toBeNull();
  });

  test("storage payload uses current schema version", () => {
    evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 1 }),
      summary: makeSummary(),
    });
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.version).toBe(ACHIEVEMENTS_VERSION);
    expect(parsed.unlocked).toContain("first-blood");
  });
});

describe("achievements — schema migration", () => {
  test("legacy payload missing 'unlocked' yields empty set", () => {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify({ version: 1 }));
    expect(getUnlockedAchievements().size).toBe(0);
  });

  test("future-version payload is rejected", () => {
    localStorage.setItem(
      ACHIEVEMENTS_KEY,
      JSON.stringify({ version: 999, unlocked: ["should-not-load"] }),
    );
    expect(getUnlockedAchievements().size).toBe(0);
  });

  test("malformed JSON yields empty set", () => {
    localStorage.setItem(ACHIEVEMENTS_KEY, "{not valid");
    expect(getUnlockedAchievements().size).toBe(0);
  });

  test("non-string ids are filtered out", () => {
    localStorage.setItem(
      ACHIEVEMENTS_KEY,
      JSON.stringify({ version: 1, unlocked: ["valid-id", 42, null, "another"] }),
    );
    const u = getUnlockedAchievements();
    expect(u.has("valid-id")).toBe(true);
    expect(u.has("another")).toBe(true);
    expect(u.size).toBe(2);
  });
});

describe("achievements — listing helpers", () => {
  test("listAchievementsWithUnlockState returns one entry per catalog item", () => {
    const list = listAchievementsWithUnlockState();
    expect(list.length).toBe(ACHIEVEMENTS.length);
    for (const entry of list) {
      expect(entry.unlocked).toBe(false);
    }
  });

  test("after unlocking one, the entry shows unlocked=true", () => {
    evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 1 }),
      summary: makeSummary(),
    });
    const list = listAchievementsWithUnlockState();
    const fb = list.find((e) => e.def.id === "first-blood");
    expect(fb?.unlocked).toBe(true);
  });

  test("getAchievementProgress reflects unlock count", () => {
    evaluateAchievements({
      postBests: makeBests({ predatorsKilled: 1, depthMeters: 600 }),
      summary: makeSummary({ depthMeters: 600 }),
    });
    const p = getAchievementProgress();
    expect(p.unlocked).toBe(2);
    expect(p.total).toBe(ACHIEVEMENTS.length);
  });
});
