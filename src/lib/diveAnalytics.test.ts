import { describe, expect, test } from "vitest";
import {
  computeAggregateStats,
  computeScoreTrendSeries,
  projectTrendPoint,
  ZERO_AGGREGATE,
  EMPTY_TREND,
} from "./diveAnalytics";
import type { DiveHistoryEntry } from "./diveHistory";

function entry(overrides: Partial<DiveHistoryEntry> = {}): DiveHistoryEntry {
  return {
    recordedAt: 0,
    mode: "exploration",
    seed: 1,
    score: 1000,
    depthMeters: 1500,
    completionPercent: 50,
    elapsedSeconds: 200,
    completed: false,
    achievementsUnlocked: [],
    bestsSet: [],
    ...overrides,
  };
}

describe("diveAnalytics — computeAggregateStats", () => {
  test("empty list returns ZERO_AGGREGATE", () => {
    expect(computeAggregateStats([])).toEqual(ZERO_AGGREGATE);
  });

  test("counts dives", () => {
    const stats = computeAggregateStats([entry(), entry(), entry()]);
    expect(stats.divesCounted).toBe(3);
  });

  test("means round to integer", () => {
    const stats = computeAggregateStats([
      entry({ score: 100 }),
      entry({ score: 200 }),
      entry({ score: 301 }),
    ]);
    expect(stats.meanScore).toBe(200); // (100+200+301)/3 = 200.333 → 200
  });

  test("best and worst track extremes", () => {
    const stats = computeAggregateStats([
      entry({ score: 500 }),
      entry({ score: 100 }),
      entry({ score: 9000 }),
      entry({ score: 1500 }),
    ]);
    expect(stats.bestScore).toBe(9000);
    expect(stats.worstScore).toBe(100);
  });

  test("completion rate counts only completed dives", () => {
    const stats = computeAggregateStats([
      entry({ completed: true }),
      entry({ completed: false }),
      entry({ completed: true }),
      entry({ completed: false }),
    ]);
    expect(stats.completionRate).toBe(0.5);
  });

  test("completion rate is 1 when every dive completed", () => {
    const stats = computeAggregateStats([
      entry({ completed: true }),
      entry({ completed: true }),
    ]);
    expect(stats.completionRate).toBe(1);
  });

  test("completion rate is 0 when none completed", () => {
    const stats = computeAggregateStats([entry({ completed: false })]);
    expect(stats.completionRate).toBe(0);
  });

  test("divesByMode counts per mode", () => {
    const stats = computeAggregateStats([
      entry({ mode: "exploration" }),
      entry({ mode: "exploration" }),
      entry({ mode: "descent" }),
      entry({ mode: "arena" }),
      entry({ mode: "arena" }),
      entry({ mode: "arena" }),
    ]);
    expect(stats.divesByMode).toEqual({
      exploration: 2,
      descent: 1,
      arena: 3,
    });
  });

  test("mean depth + elapsed", () => {
    const stats = computeAggregateStats([
      entry({ depthMeters: 1000, elapsedSeconds: 300 }),
      entry({ depthMeters: 2000, elapsedSeconds: 400 }),
    ]);
    expect(stats.meanDepthMeters).toBe(1500);
    expect(stats.meanElapsedSeconds).toBe(350);
  });

  test("single dive with score 0 still produces best=worst=0 (not -Infinity)", () => {
    const stats = computeAggregateStats([entry({ score: 0 })]);
    expect(stats.bestScore).toBe(0);
    expect(stats.worstScore).toBe(0);
    expect(stats.meanScore).toBe(0);
  });
});

describe("diveAnalytics — computeScoreTrendSeries", () => {
  test("empty list returns EMPTY_TREND", () => {
    expect(computeScoreTrendSeries([])).toEqual(EMPTY_TREND);
  });

  test("single entry returns one point at t=1", () => {
    const series = computeScoreTrendSeries([entry({ score: 5000 })]);
    expect(series.points).toHaveLength(1);
    expect(series.points[0].t).toBe(1);
    expect(series.points[0].score).toBe(5000);
    expect(series.maxScore).toBe(5000);
    expect(series.minScore).toBe(5000);
  });

  test("reverses storage order to chronological", () => {
    // Storage order is newest-first; chart wants oldest-first.
    const series = computeScoreTrendSeries([
      entry({ score: 300 }), // newest
      entry({ score: 200 }),
      entry({ score: 100 }), // oldest
    ]);
    expect(series.points.map((p) => p.score)).toEqual([100, 200, 300]);
  });

  test("normalizes t to span 0..1 across the window", () => {
    const series = computeScoreTrendSeries([entry(), entry(), entry(), entry()]);
    expect(series.points.map((p) => p.t)).toEqual([0, 1 / 3, 2 / 3, 1]);
  });

  test("max/min reflect the score window", () => {
    const series = computeScoreTrendSeries([
      entry({ score: 800 }),
      entry({ score: 100 }),
      entry({ score: 5000 }),
    ]);
    expect(series.maxScore).toBe(5000);
    expect(series.minScore).toBe(100);
  });

  test("preserves the completed flag for renderer styling", () => {
    const series = computeScoreTrendSeries([
      entry({ completed: true, score: 100 }),
      entry({ completed: false, score: 200 }),
    ]);
    // chronological after reversal: false, true
    expect(series.points.map((p) => p.completed)).toEqual([false, true]);
  });
});

describe("diveAnalytics — projectTrendPoint", () => {
  test("oldest point sits at left edge (with padding)", () => {
    const series = computeScoreTrendSeries([
      entry({ score: 100 }),
      entry({ score: 200 }),
    ]);
    const projected = projectTrendPoint(series.points[0], series, 100, 40);
    expect(projected.x).toBe(4); // default padding
  });

  test("newest point sits at right edge (minus padding)", () => {
    const series = computeScoreTrendSeries([
      entry({ score: 100 }),
      entry({ score: 200 }),
    ]);
    const projected = projectTrendPoint(series.points[1], series, 100, 40);
    expect(projected.x).toBe(96); // 100 - 4 padding
  });

  test("highest score sits near top (low y, since SVG y grows down)", () => {
    // Storage is newest-first, so [score=100, score=1000] means newest=100,
    // oldest=1000. After reversal points[0] is oldest = 1000 (the high).
    const series = computeScoreTrendSeries([
      entry({ score: 100 }),
      entry({ score: 1000 }),
    ]);
    const top = projectTrendPoint(series.points[0], series, 100, 40);
    expect(top.y).toBe(4); // y == padding when at maxScore
  });

  test("lowest score sits near bottom (high y)", () => {
    // points[1] is newest = score 100 (the low).
    const series = computeScoreTrendSeries([
      entry({ score: 100 }),
      entry({ score: 1000 }),
    ]);
    const bottom = projectTrendPoint(series.points[1], series, 100, 40);
    expect(bottom.y).toBe(36); // 40 - 4 = at innerH bottom
  });

  test("flat scores → midline (avoid divide-by-zero)", () => {
    const series = computeScoreTrendSeries([
      entry({ score: 500 }),
      entry({ score: 500 }),
    ]);
    const mid = projectTrendPoint(series.points[0], series, 100, 40);
    expect(mid.y).toBe(20); // padding + innerH/2 = 4 + 32/2
  });

  test("custom padding respected", () => {
    const series = computeScoreTrendSeries([entry({ score: 100 })]);
    const p = projectTrendPoint(series.points[0], series, 100, 40, 10);
    // single-point: t=1, span=0 → y = padding + innerH/2 = 10 + 10
    expect(p.x).toBe(90); // 100 - 10 padding
    expect(p.y).toBe(20);
  });
});
