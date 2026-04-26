import type { DiveRunSummary } from "@/sim";

/**
 * Personal bests — durable record of the player's peak performance
 * across every dive. Goes beyond score: peak chain, predators killed,
 * longest survival, best completion %, deepest descent.
 *
 * Storage
 * -------
 * Single localStorage key with a versioned JSON payload. The schema
 * version lets future revisions migrate cleanly (a v1 → v2 jump
 * could add per-mode tracking without breaking existing players).
 *
 * Failure modes
 * -------------
 * Every storage call wraps try/catch (Safari private mode, sandboxed
 * iframes, quota errors). On read failure we return ZERO_BESTS; on
 * write failure we still return the *would-be* updated bests so the
 * post-dive UI celebrates the moment even if we couldn't persist it.
 */

export const PERSONAL_BESTS_KEY = "bioluminescent-sea:v1:personal-bests";
export const PERSONAL_BESTS_VERSION = 1;

/** Recorded best for each tracked dimension. All fields default to
 *  zero on a fresh install — a player's *first* dive will improve
 *  every category they touched. */
export interface PersonalBests {
  /** Schema version — bump on breaking changes; reader migrates. */
  version: number;
  /** Highest single-dive score. */
  score: number;
  /** Deepest world-meters reached in a single dive. */
  depthMeters: number;
  /** Peak chain multiplier reached in any dive. */
  maxChain: number;
  /** Most predators broken in a single dive. */
  predatorsKilled: number;
  /** Longest single-dive duration before surfacing/dying. */
  longestRunSeconds: number;
  /** Best completion-percent (0..100). */
  completionPercent: number;
  /** Total cumulative score across every recorded dive — never
   *  resets on a worse run, monotonic. Surfaced as "Lifetime Lux"
   *  on the drydock so progression has a long-form readout. */
  lifetimeScore: number;
  /** Total dives logged. */
  divesLogged: number;
}

export const ZERO_BESTS: PersonalBests = {
  version: PERSONAL_BESTS_VERSION,
  score: 0,
  depthMeters: 0,
  maxChain: 1,
  predatorsKilled: 0,
  longestRunSeconds: 0,
  completionPercent: 0,
  lifetimeScore: 0,
  divesLogged: 0,
};

/**
 * Categories whose best improved during the dive. UI celebrates each
 * with a "NEW BEST" badge. Returned as an explicit shape (not a
 * Set<string>) so it remains type-checked and trivially serializable.
 */
export interface BestImprovements {
  score: boolean;
  depthMeters: boolean;
  maxChain: boolean;
  predatorsKilled: boolean;
  longestRunSeconds: boolean;
  completionPercent: boolean;
}

export const NO_IMPROVEMENTS: BestImprovements = {
  score: false,
  depthMeters: false,
  maxChain: false,
  predatorsKilled: false,
  longestRunSeconds: false,
  completionPercent: false,
};

export function hasAnyImprovement(improvements: BestImprovements): boolean {
  return (
    improvements.score ||
    improvements.depthMeters ||
    improvements.maxChain ||
    improvements.predatorsKilled ||
    improvements.longestRunSeconds ||
    improvements.completionPercent
  );
}

/**
 * Migrate a parsed payload to the current schema version. Returns
 * null if the payload is malformed or from a future version we
 * don't understand (caller falls back to ZERO_BESTS).
 *
 * Currently only one schema version exists — this function is
 * shaped for future migrations (v1 → v2 would coerce missing v2
 * fields rather than discard the whole record).
 */
function migrate(raw: unknown): PersonalBests | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<PersonalBests>;
  const version = typeof obj.version === "number" ? obj.version : 0;
  if (version > PERSONAL_BESTS_VERSION) return null; // future schema
  // v1: take fields with finite-number guards. Missing → 0.
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    version: PERSONAL_BESTS_VERSION,
    score: num(obj.score, 0),
    depthMeters: num(obj.depthMeters, 0),
    maxChain: num(obj.maxChain, 1),
    predatorsKilled: num(obj.predatorsKilled, 0),
    longestRunSeconds: num(obj.longestRunSeconds, 0),
    completionPercent: num(obj.completionPercent, 0),
    lifetimeScore: num(obj.lifetimeScore, 0),
    divesLogged: num(obj.divesLogged, 0),
  };
}

export function getPersonalBests(): PersonalBests {
  if (typeof localStorage === "undefined") return { ...ZERO_BESTS };
  try {
    const raw = localStorage.getItem(PERSONAL_BESTS_KEY);
    if (!raw) return { ...ZERO_BESTS };
    const parsed = JSON.parse(raw);
    return migrate(parsed) ?? { ...ZERO_BESTS };
  } catch {
    return { ...ZERO_BESTS };
  }
}

function writeBests(bests: PersonalBests): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PERSONAL_BESTS_KEY, JSON.stringify(bests));
  } catch {
    // Quota / private-mode — celebration UI still fires on the
    // updated value we computed; persistence will retry next dive.
  }
}

/**
 * Record the dive's outcome and return:
 * - The (possibly updated) bests
 * - Which categories improved (BestImprovements)
 *
 * Pure-ish: produces a NEW PersonalBests object. Side-effect
 * is the localStorage write; both return values are derived from
 * inputs alone.
 */
export function recordDive(summary: DiveRunSummary): {
  bests: PersonalBests;
  improvements: BestImprovements;
} {
  const previous = getPersonalBests();
  const stats = summary.stats;
  const elapsed = summary.elapsedSeconds ?? 0;
  const predatorsKilled = stats?.predatorsKilled ?? 0;
  const maxChain = stats?.maxChain ?? 1;

  const improvements: BestImprovements = {
    score: summary.score > previous.score,
    depthMeters: summary.depthMeters > previous.depthMeters,
    maxChain: maxChain > previous.maxChain,
    predatorsKilled: predatorsKilled > previous.predatorsKilled,
    longestRunSeconds: elapsed > previous.longestRunSeconds,
    completionPercent: summary.completionPercent > previous.completionPercent,
  };

  const updated: PersonalBests = {
    version: PERSONAL_BESTS_VERSION,
    score: Math.max(previous.score, summary.score),
    depthMeters: Math.max(previous.depthMeters, summary.depthMeters),
    maxChain: Math.max(previous.maxChain, maxChain),
    predatorsKilled: Math.max(previous.predatorsKilled, predatorsKilled),
    longestRunSeconds: Math.max(previous.longestRunSeconds, elapsed),
    completionPercent: Math.max(previous.completionPercent, summary.completionPercent),
    lifetimeScore: previous.lifetimeScore + summary.score,
    divesLogged: previous.divesLogged + 1,
  };

  writeBests(updated);
  return { bests: updated, improvements };
}

/** Test-only: clear stored bests. Production code should never call this. */
export function clearPersonalBestsForTest(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PERSONAL_BESTS_KEY);
  } catch {
    // ignore
  }
}
