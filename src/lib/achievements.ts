import type { DiveRunSummary } from "@/sim";
import { type PersonalBests, getPersonalBests } from "./personalBests";

/**
 * Achievements — durable badges the player earns by hitting specific
 * dive milestones. Each achievement has a deterministic check
 * function that takes the current personal-bests + the just-completed
 * dive and returns true when the bar is met.
 *
 * Storage is independent from PersonalBests: an achievement, once
 * unlocked, stays unlocked even if a future malformed write nukes
 * the bests record (or vice versa). The two systems intentionally
 * don't share a key.
 *
 * Detection model
 * ---------------
 * `evaluateAchievements({ summary, postBests })` returns the IDs of
 * achievements the player just *unlocked* on this dive. The runtime
 * folds them into the persisted set + surfaces them in the post-dive
 * UI as celebration toasts.
 *
 * The unlock check uses **post-dive** bests so a dive that crosses a
 * threshold credits the achievement on the same screen — without
 * needing a synthetic "best at start of dive" snapshot.
 */

export const ACHIEVEMENTS_KEY = "bioluminescent-sea:v1:achievements";
export const ACHIEVEMENTS_VERSION = 1;

export interface AchievementDef {
  id: string;
  /** Short display title. */
  title: string;
  /** One-line description shown on the Drydock badge list. */
  description: string;
  /**
   * Predicate that returns true once the player has earned this
   * achievement. Always checked against post-dive PersonalBests so
   * the unlock and the dive that triggered it land on the same
   * screen.
   */
  test: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  postBests: PersonalBests;
  summary: DiveRunSummary;
}

/**
 * Catalog. Order is the display order on the Drydock — keep it
 * grouped by theme (combat, mastery, exploration, endurance) so a
 * player browsing the list can find related goals together.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ---- Combat ----
  {
    id: "first-blood",
    title: "First Blood",
    description: "Break a predator with your lamp.",
    test: ({ postBests }) => postBests.predatorsKilled >= 1,
  },
  {
    id: "predator-hunter",
    title: "Predator Hunter",
    description: "Break 10 predators in a single dive.",
    test: ({ summary }) => (summary.stats?.predatorsKilled ?? 0) >= 10,
  },
  {
    id: "exterminator",
    title: "Exterminator",
    description: "Break 100 predators across all dives.",
    test: ({ postBests }) => postBests.predatorsKilled >= 100,
  },

  // ---- Chain mastery ----
  {
    id: "chain-starter",
    title: "Chain Starter",
    description: "Reach a ×3 multiplier.",
    test: ({ postBests }) => postBests.maxChain >= 3,
  },
  {
    id: "streak-master",
    title: "Streak Master",
    description: "Reach a ×10 multiplier.",
    test: ({ postBests }) => postBests.maxChain >= 10,
  },

  // ---- Exploration ----
  {
    id: "kelp-gate-opened",
    title: "Photic Pioneer",
    description: "Reach 600 m.",
    test: ({ postBests }) => postBests.depthMeters >= 600,
  },
  {
    id: "twilight-traveler",
    title: "Twilight Traveler",
    description: "Reach 1500 m.",
    test: ({ postBests }) => postBests.depthMeters >= 1500,
  },
  {
    id: "midnight-resident",
    title: "Midnight Resident",
    description: "Reach 2400 m.",
    test: ({ postBests }) => postBests.depthMeters >= 2400,
  },
  {
    id: "abyss-cartographer",
    title: "Abyss Cartographer",
    description: "Reach 3200 m.",
    test: ({ postBests }) => postBests.depthMeters >= 3200,
  },
  {
    id: "biome-tour",
    title: "Trench Tour",
    description: "Visit 4 biomes in a single dive.",
    test: ({ summary }) =>
      (summary.stats?.biomesTraversed.length ?? 0) >= 4,
  },

  // ---- Endurance ----
  {
    id: "long-haul",
    title: "Long Haul",
    description: "Survive a single dive for 5 minutes.",
    test: ({ postBests }) => postBests.longestRunSeconds >= 300,
  },
  {
    id: "perfect-run",
    title: "Untouched",
    description: "Complete a dive without taking a hit.",
    test: ({ summary }) =>
      summary.completionPercent >= 100 &&
      (summary.stats?.impactsTaken ?? 1) === 0,
  },

  // ---- Mastery ----
  {
    id: "score-1k",
    title: "Score Initiate",
    description: "Score 1,000 in a single dive.",
    test: ({ postBests }) => postBests.score >= 1000,
  },
  {
    id: "score-10k",
    title: "Score Master",
    description: "Score 10,000 in a single dive.",
    test: ({ postBests }) => postBests.score >= 10000,
  },
  {
    id: "lifetime-50k",
    title: "Devoted Diver",
    description: "Earn 50,000 lifetime Lux.",
    test: ({ postBests }) => postBests.lifetimeScore >= 50000,
  },
];

interface AchievementsRecord {
  version: number;
  unlocked: string[];
}

function migrate(raw: unknown): AchievementsRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<AchievementsRecord>;
  const version = typeof obj.version === "number" ? obj.version : 0;
  if (version > ACHIEVEMENTS_VERSION) return null;
  const unlocked = Array.isArray(obj.unlocked)
    ? obj.unlocked.filter((id): id is string => typeof id === "string")
    : [];
  return { version: ACHIEVEMENTS_VERSION, unlocked };
}

export function getUnlockedAchievements(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    return new Set(migrated?.unlocked ?? []);
  } catch {
    return new Set();
  }
}

function writeUnlocked(unlocked: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const record: AchievementsRecord = {
      version: ACHIEVEMENTS_VERSION,
      unlocked: Array.from(unlocked),
    };
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(record));
  } catch {
    // ignore — the celebration UI fires regardless
  }
}

/**
 * Evaluate the catalog against the post-dive context. Returns the
 * IDs of achievements that *just unlocked on this dive* — the runtime
 * uses these to drive a celebratory toast row on the post-dive
 * screen. Already-unlocked achievements that the dive also satisfies
 * are NOT in the return set (you don't celebrate twice).
 *
 * Side effect: persists the merged unlocked set.
 */
export function evaluateAchievements(ctx: AchievementContext): {
  newlyUnlocked: AchievementDef[];
  unlocked: Set<string>;
} {
  const previous = getUnlockedAchievements();
  const newlyUnlocked: AchievementDef[] = [];
  const next = new Set(previous);

  for (const def of ACHIEVEMENTS) {
    if (previous.has(def.id)) continue;
    if (def.test(ctx)) {
      newlyUnlocked.push(def);
      next.add(def.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    writeUnlocked(next);
  }
  return { newlyUnlocked, unlocked: next };
}

/** Test-only helper: evaluate against fresh storage state. */
export function clearAchievementsForTest(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(ACHIEVEMENTS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Convenience for the Drydock — returns each catalog entry plus
 * whether it's been unlocked. Reads localStorage *once* and joins
 * against the in-memory catalog so callers don't iterate twice.
 */
export function listAchievementsWithUnlockState(): {
  def: AchievementDef;
  unlocked: boolean;
}[] {
  const unlocked = getUnlockedAchievements();
  return ACHIEVEMENTS.map((def) => ({
    def,
    unlocked: unlocked.has(def.id),
  }));
}

/**
 * Read the catalog without touching storage — useful for the UI to
 * display "X / N achievements" totals.
 */
export function getAchievementProgress(): { unlocked: number; total: number } {
  return {
    unlocked: getUnlockedAchievements().size,
    total: ACHIEVEMENTS.length,
  };
}

/** Full re-export so callers can look up by id without iterating. */
export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((def) => [def.id, def]),
);

// Re-export PersonalBests so callers can pass post-dive bests
// without an extra import. The function is just a passthrough
// during tests but lets the type stay stable.
export const _readBestsForEvaluation = (): PersonalBests => getPersonalBests();
