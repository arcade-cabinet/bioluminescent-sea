import type { DiveRunSummary } from "@/sim";
import type { SessionMode } from "@/sim";
import type { BestImprovements } from "./personalBests";

/**
 * Dive history — a rolling log of completed dives with the
 * statistics that matter: when, mode, seed, score, depth, and which
 * achievements/bests landed. Players browse this on the drydock to
 * see how they're trending without needing to memorize their last
 * ten runs.
 *
 * Storage model
 * -------------
 * Single localStorage key with a versioned JSON payload. Capped at
 * MAX_HISTORY_ENTRIES (32) so the storage footprint stays bounded —
 * older entries are evicted FIFO. The cap is large enough to capture
 * a session's worth of play but small enough that the JSON write
 * doesn't bloat above ~16 KB on a hot device.
 *
 * Failure modes
 * -------------
 * Read failure (Safari private mode, sandbox) → empty list. Write
 * failure (quota) → silently swallowed; the next successful dive
 * will retry the write with the rolled-up list.
 *
 * Time source
 * -----------
 * Entries timestamp via `Date.now()` in milliseconds — a thin
 * abstraction (`now`) is injected for tests so the test suite
 * controls the clock without mocking globals.
 */

export const DIVE_HISTORY_KEY = "bioluminescent-sea:v1:dive-history";
export const DIVE_HISTORY_VERSION = 1;
export const MAX_HISTORY_ENTRIES = 32;

export interface DiveHistoryEntry {
  /** Wall-clock millis at completion. Display formats convert to
   *  the user's locale. */
  recordedAt: number;
  /** Game mode (exploration / descent / arena). Drives the mode
   *  badge in the history list. */
  mode: SessionMode;
  /** Seed of the dive. Lets the user re-roll the same seed to chase
   *  a personal best on a known map. */
  seed: number;
  /** Score earned. */
  score: number;
  /** Cumulative depth reached in world-meters. */
  depthMeters: number;
  /** 0..100 completion. */
  completionPercent: number;
  /** Seconds spent before the dive ended. */
  elapsedSeconds: number;
  /** Whether the dive finished by reaching the Living Map (true)
   *  vs failing on oxygen / collision (false). */
  completed: boolean;
  /** IDs of achievements unlocked on this dive (for highlighting
   *  the entry in the history list). Empty array if none. */
  achievementsUnlocked: string[];
  /** Categories where this dive set a new personal best. Used to
   *  badge the entry. */
  bestsSet: BestCategory[];
}

export type BestCategory =
  | "score"
  | "depthMeters"
  | "maxChain"
  | "predatorsKilled"
  | "longestRunSeconds"
  | "completionPercent";

interface DiveHistoryRecord {
  version: number;
  entries: DiveHistoryEntry[];
}

function migrate(raw: unknown): DiveHistoryRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<DiveHistoryRecord>;
  const version = typeof obj.version === "number" ? obj.version : 0;
  if (version > DIVE_HISTORY_VERSION) return null;
  const entries = Array.isArray(obj.entries) ? obj.entries : [];
  // Sanity-filter entries — drop anything that doesn't look like an
  // entry rather than crash the whole list.
  const valid = entries.filter(isValidEntry);
  return { version: DIVE_HISTORY_VERSION, entries: valid };
}

function isValidEntry(raw: unknown): raw is DiveHistoryEntry {
  if (!raw || typeof raw !== "object") return false;
  const e = raw as Partial<DiveHistoryEntry>;
  return (
    typeof e.recordedAt === "number" &&
    Number.isFinite(e.recordedAt) &&
    typeof e.mode === "string" &&
    typeof e.seed === "number" &&
    typeof e.score === "number" &&
    typeof e.depthMeters === "number" &&
    typeof e.completionPercent === "number" &&
    typeof e.elapsedSeconds === "number" &&
    typeof e.completed === "boolean" &&
    Array.isArray(e.achievementsUnlocked) &&
    Array.isArray(e.bestsSet)
  );
}

export function getDiveHistory(): DiveHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(DIVE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return migrate(parsed)?.entries ?? [];
  } catch {
    return [];
  }
}

function writeHistory(entries: DiveHistoryEntry[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const record: DiveHistoryRecord = {
      version: DIVE_HISTORY_VERSION,
      entries,
    };
    localStorage.setItem(DIVE_HISTORY_KEY, JSON.stringify(record));
  } catch {
    // ignore — caller has the rolled-up list it computed
  }
}

export interface RecordHistoryArgs {
  summary: DiveRunSummary;
  mode: SessionMode;
  seed: number;
  /** True if dive ended by reaching the Living Map (vs failure). */
  completed: boolean;
  /** IDs of achievements unlocked this dive. */
  achievementsUnlocked: string[];
  /** Best-improvement record from PersonalBests.recordDive(). */
  improvements: BestImprovements;
  /** Optional time source for tests. Defaults to Date.now. */
  now?: () => number;
}

const BEST_CATEGORIES: BestCategory[] = [
  "score",
  "depthMeters",
  "maxChain",
  "predatorsKilled",
  "longestRunSeconds",
  "completionPercent",
];

function bestsSetFromImprovements(improvements: BestImprovements): BestCategory[] {
  return BEST_CATEGORIES.filter((cat) => improvements[cat]);
}

/**
 * Append a dive to the history. Entries are stored newest-first so
 * the UI iterates without reversing. Older entries past
 * MAX_HISTORY_ENTRIES are dropped (FIFO eviction).
 *
 * Returns the updated entries list — the caller doesn't need to
 * re-read storage.
 */
export function recordDiveHistory(args: RecordHistoryArgs): DiveHistoryEntry[] {
  const now = args.now ?? Date.now;
  const entry: DiveHistoryEntry = {
    recordedAt: now(),
    mode: args.mode,
    seed: args.seed,
    score: args.summary.score,
    depthMeters: args.summary.depthMeters,
    completionPercent: args.summary.completionPercent,
    elapsedSeconds: args.summary.elapsedSeconds,
    completed: args.completed,
    achievementsUnlocked: [...args.achievementsUnlocked],
    bestsSet: bestsSetFromImprovements(args.improvements),
  };

  const previous = getDiveHistory();
  const next = [entry, ...previous].slice(0, MAX_HISTORY_ENTRIES);
  writeHistory(next);
  return next;
}

/** Test helper. Production code should not call this. */
export function clearDiveHistoryForTest(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(DIVE_HISTORY_KEY);
  } catch {
    // ignore
  }
}

/**
 * Format helpers — kept here so the UI layer doesn't reinvent them.
 */

export function formatRelativeTime(ms: number, nowMs = Date.now()): string {
  const delta = Math.max(0, nowMs - ms);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < minute) return "just now";
  if (delta < hour) return `${Math.floor(delta / minute)}m ago`;
  if (delta < day) return `${Math.floor(delta / hour)}h ago`;
  if (delta < 7 * day) return `${Math.floor(delta / day)}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
