import type { DiveHistoryEntry } from "./diveHistory";

/**
 * Dive analytics — pure aggregations over DiveHistory entries.
 *
 * Lives in src/lib alongside diveHistory.ts so the Drydock UI can
 * import a single namespace ("recent dives + their stats") without
 * coupling itself to chart rendering. The functions are pure: they
 * take an entries array, return summary numbers / chart-ready
 * series, and never touch storage themselves (the caller passes in
 * the result of getDiveHistory()).
 *
 * Two levels of aggregation
 * -------------------------
 * 1. computeAggregateStats() — overall stats: mean score, completion
 *    rate, hardest dive, best dive, etc. Compact summary card.
 * 2. computeScoreTrendSeries() — chart-ready point series for
 *    sparkline rendering. Newest entry on the right (chronological
 *    display order, even though storage is newest-first).
 */

export interface AggregateStats {
  /** Number of dives in scope. */
  divesCounted: number;
  /** Mean score across all dives. 0 if no dives. */
  meanScore: number;
  /** Highest single score. */
  bestScore: number;
  /** Lowest score (helps players see "even my worst run scored X"). */
  worstScore: number;
  /** Mean depth in meters. */
  meanDepthMeters: number;
  /** Completion rate 0..1 (fraction of dives that reached the Living Map). */
  completionRate: number;
  /** Mean elapsed seconds — how long an average dive lasts. */
  meanElapsedSeconds: number;
  /** Mode-specific dive count (so the UI can say "12 exploration / 4 arena"). */
  divesByMode: Record<string, number>;
}

export const ZERO_AGGREGATE: AggregateStats = {
  divesCounted: 0,
  meanScore: 0,
  bestScore: 0,
  worstScore: 0,
  meanDepthMeters: 0,
  completionRate: 0,
  meanElapsedSeconds: 0,
  divesByMode: {},
};

export function computeAggregateStats(
  entries: readonly DiveHistoryEntry[],
): AggregateStats {
  if (entries.length === 0) return ZERO_AGGREGATE;

  let totalScore = 0;
  let totalDepth = 0;
  let totalElapsed = 0;
  let completed = 0;
  let bestScore = -Infinity;
  let worstScore = Infinity;
  const divesByMode: Record<string, number> = {};

  for (const e of entries) {
    totalScore += e.score;
    totalDepth += e.depthMeters;
    totalElapsed += e.elapsedSeconds;
    if (e.completed) completed++;
    if (e.score > bestScore) bestScore = e.score;
    if (e.score < worstScore) worstScore = e.score;
    divesByMode[e.mode] = (divesByMode[e.mode] ?? 0) + 1;
  }

  return {
    divesCounted: entries.length,
    meanScore: Math.round(totalScore / entries.length),
    bestScore,
    worstScore,
    meanDepthMeters: Math.round(totalDepth / entries.length),
    completionRate: completed / entries.length,
    meanElapsedSeconds: Math.round(totalElapsed / entries.length),
    divesByMode,
  };
}

/**
 * A point on the score-trend chart. `t` is a normalized 0..1
 * x-position (oldest=0, newest=1) so the renderer can scale
 * directly to viewport width without computing axes. `score` and
 * `completed` are the original values for tooltip / styling.
 */
export interface TrendPoint {
  t: number;
  score: number;
  completed: boolean;
}

export interface TrendSeries {
  /** Chronologically-ordered points (oldest first). */
  points: TrendPoint[];
  /** Highest score in scope — used by the renderer to scale Y. */
  maxScore: number;
  /** Lowest score in scope — used by the renderer to scale Y. */
  minScore: number;
}

export const EMPTY_TREND: TrendSeries = {
  points: [],
  maxScore: 0,
  minScore: 0,
};

/**
 * Build a chart-ready trend series. `entries` is assumed to be in
 * the storage order (newest first). The function reverses to render
 * left-to-right chronologically and computes normalized t-values.
 *
 * Single-entry input: returns one point at t=1 (so the renderer
 * places it at the right edge as the "most recent" anchor).
 */
export function computeScoreTrendSeries(
  entries: readonly DiveHistoryEntry[],
): TrendSeries {
  if (entries.length === 0) return EMPTY_TREND;

  // Storage is newest-first; reverse to chronological for the chart.
  const chrono = [...entries].reverse();
  const n = chrono.length;
  let maxScore = -Infinity;
  let minScore = Infinity;
  for (const e of chrono) {
    if (e.score > maxScore) maxScore = e.score;
    if (e.score < minScore) minScore = e.score;
  }

  const points: TrendPoint[] = chrono.map((e, i) => ({
    t: n === 1 ? 1 : i / (n - 1),
    score: e.score,
    completed: e.completed,
  }));

  return { points, maxScore, minScore };
}

/**
 * Project a TrendPoint into pixel space for SVG rendering. Caller
 * passes the chart's pixel dimensions; this returns x/y in those
 * coordinates with y inverted (SVG y grows downward).
 *
 * If maxScore == minScore (all dives same score), every point sits
 * at the chart's vertical midpoint to avoid divide-by-zero.
 */
export function projectTrendPoint(
  point: TrendPoint,
  series: TrendSeries,
  width: number,
  height: number,
  padding = 4,
): { x: number; y: number } {
  const span = Math.max(0, series.maxScore - series.minScore);
  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);
  const x = padding + point.t * innerW;
  const y =
    span === 0
      ? padding + innerH / 2
      : padding + innerH - ((point.score - series.minScore) / span) * innerH;
  return { x, y };
}
