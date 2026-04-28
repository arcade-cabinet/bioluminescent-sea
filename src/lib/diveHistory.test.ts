// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearDiveHistoryForTest,
  DIVE_HISTORY_KEY,
  DIVE_HISTORY_VERSION,
  formatElapsed,
  formatRelativeTime,
  getDiveHistory,
  MAX_HISTORY_ENTRIES,
  recordDiveHistory,
} from "./diveHistory";
import { NO_IMPROVEMENTS } from "./personalBests";
import type { DiveRunSummary, SessionMode } from "@/sim";

function makeSummary(overrides: Partial<DiveRunSummary> = {}): DiveRunSummary {
  return {
    beaconsRemaining: 18,
    completionPercent: 35,
    depthMeters: 1200,
    durationSeconds: 600,
    elapsedSeconds: 240,
    score: 1500,
    timeLeft: 360,
    totalBeacons: 18,
    stats: {
      predatorsKilled: 2,
      buffsCollected: 1,
      biomesTraversed: ["epipelagic"],
      maxChain: 4,
      impactsTaken: 0,
      adrenalineTriggers: 0,
    },
    ...overrides,
  };
}

const baseArgs = {
  summary: makeSummary(),
  mode: "exploration" as SessionMode,
  seed: 42,
  completed: false,
  achievementsUnlocked: [] as string[],
  improvements: NO_IMPROVEMENTS,
};

beforeEach(() => {
  clearDiveHistoryForTest();
});

afterEach(() => {
  clearDiveHistoryForTest();
});

describe("diveHistory — initial state", () => {
  test("getDiveHistory returns an empty array on a fresh install", () => {
    expect(getDiveHistory()).toEqual([]);
  });
});

describe("diveHistory — recordDiveHistory", () => {
  test("appends an entry with summary fields", () => {
    const entries = recordDiveHistory({
      ...baseArgs,
      now: () => 1000,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].score).toBe(1500);
    expect(entries[0].depthMeters).toBe(1200);
    expect(entries[0].completionPercent).toBe(35);
    expect(entries[0].elapsedSeconds).toBe(240);
    expect(entries[0].mode).toBe("exploration");
    expect(entries[0].seed).toBe(42);
    expect(entries[0].recordedAt).toBe(1000);
  });

  test("newest entry is first", () => {
    recordDiveHistory({ ...baseArgs, summary: makeSummary({ score: 100 }), now: () => 1 });
    recordDiveHistory({ ...baseArgs, summary: makeSummary({ score: 200 }), now: () => 2 });
    const entries = recordDiveHistory({
      ...baseArgs,
      summary: makeSummary({ score: 300 }),
      now: () => 3,
    });
    expect(entries.map((e) => e.score)).toEqual([300, 200, 100]);
  });

  test("captures completed flag correctly", () => {
    const entries = recordDiveHistory({ ...baseArgs, completed: true });
    expect(entries[0].completed).toBe(true);
  });

  test("captures achievement IDs (cloned, not aliased)", () => {
    const ids = ["first-blood", "chain-starter"];
    const entries = recordDiveHistory({ ...baseArgs, achievementsUnlocked: ids });
    expect(entries[0].achievementsUnlocked).toEqual(ids);
    // Mutating the source should not affect the stored entry.
    ids.push("forced-mutation");
    expect(entries[0].achievementsUnlocked).toEqual(["first-blood", "chain-starter"]);
  });

  test("derives bestsSet from improvements", () => {
    const entries = recordDiveHistory({
      ...baseArgs,
      improvements: {
        score: true,
        depthMeters: true,
        maxChain: false,
        predatorsKilled: false,
        longestRunSeconds: true,
        completionPercent: false,
      },
    });
    expect(entries[0].bestsSet).toEqual(["score", "depthMeters", "longestRunSeconds"]);
  });

  test("empty improvements → empty bestsSet", () => {
    const entries = recordDiveHistory({ ...baseArgs, improvements: NO_IMPROVEMENTS });
    expect(entries[0].bestsSet).toEqual([]);
  });
});

describe("diveHistory — capacity cap", () => {
  test(`drops oldest beyond ${MAX_HISTORY_ENTRIES}`, () => {
    // Add MAX + 5 entries, scored 0..MAX+4.
    let entries = [] as ReturnType<typeof recordDiveHistory>;
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i++) {
      entries = recordDiveHistory({
        ...baseArgs,
        summary: makeSummary({ score: i }),
        now: () => i,
      });
    }
    expect(entries).toHaveLength(MAX_HISTORY_ENTRIES);
    // Newest is first; should be the highest score.
    expect(entries[0].score).toBe(MAX_HISTORY_ENTRIES + 4);
    // Oldest preserved is score=5 (we dropped 0..4).
    expect(entries[entries.length - 1].score).toBe(5);
  });
});

describe("diveHistory — persistence", () => {
  test("entries persist across reads", () => {
    recordDiveHistory({ ...baseArgs, summary: makeSummary({ score: 999 }) });
    expect(getDiveHistory()[0].score).toBe(999);
  });

  test("storage payload uses current schema version", () => {
    recordDiveHistory({ ...baseArgs });
    const raw = localStorage.getItem(DIVE_HISTORY_KEY);
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.version).toBe(DIVE_HISTORY_VERSION);
    expect(Array.isArray(parsed.entries)).toBe(true);
  });
});

describe("diveHistory — schema migration", () => {
  test("future-version payload is rejected", () => {
    localStorage.setItem(
      DIVE_HISTORY_KEY,
      JSON.stringify({ version: 999, entries: [{ /* would-be entry */ }] }),
    );
    expect(getDiveHistory()).toEqual([]);
  });

  test("malformed JSON yields empty list", () => {
    localStorage.setItem(DIVE_HISTORY_KEY, "{not valid");
    expect(getDiveHistory()).toEqual([]);
  });

  test("malformed entries are filtered out, valid ones survive", () => {
    const valid = {
      recordedAt: 1000,
      mode: "exploration",
      seed: 1,
      score: 100,
      depthMeters: 500,
      completionPercent: 25,
      elapsedSeconds: 120,
      completed: false,
      achievementsUnlocked: [],
      bestsSet: [],
    };
    localStorage.setItem(
      DIVE_HISTORY_KEY,
      JSON.stringify({
        version: 1,
        entries: [valid, { score: "bad" }, null, valid],
      }),
    );
    const entries = getDiveHistory();
    expect(entries).toHaveLength(2);
    expect(entries[0].score).toBe(100);
  });
});

describe("diveHistory — storage failure resilience", () => {
  test("read failure returns empty list without throwing", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error("blocked");
    });
    try {
      expect(getDiveHistory()).toEqual([]);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  test("write failure still returns the would-be entries list", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error("Quota exceeded");
    });
    try {
      const entries = recordDiveHistory({ ...baseArgs });
      expect(entries).toHaveLength(1);
      expect(entries[0].score).toBe(1500);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe("diveHistory — formatRelativeTime", () => {
  const NOW = 1_700_000_000_000;

  test("under a minute → 'just now'", () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe("just now");
  });

  test("minutes", () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe("5m ago");
  });

  test("hours", () => {
    expect(formatRelativeTime(NOW - 2 * 60 * 60_000, NOW)).toBe("2h ago");
  });

  test("days", () => {
    expect(formatRelativeTime(NOW - 3 * 24 * 60 * 60_000, NOW)).toBe("3d ago");
  });

  test("over a week → locale date string", () => {
    const result = formatRelativeTime(NOW - 14 * 24 * 60 * 60_000, NOW);
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain("ago");
  });

  test("future-time clamps to 'just now'", () => {
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe("just now");
  });
});

describe("diveHistory — formatElapsed", () => {
  test("under a minute", () => {
    expect(formatElapsed(45)).toBe("45s");
  });

  test("exact minutes drop the seconds suffix", () => {
    expect(formatElapsed(120)).toBe("2m");
  });

  test("minutes + seconds", () => {
    expect(formatElapsed(135)).toBe("2m 15s");
  });

  test("rounds fractional seconds", () => {
    expect(formatElapsed(45.7)).toBe("46s");
  });

  test("clamps negative input to zero", () => {
    expect(formatElapsed(-5)).toBe("0s");
  });
});
