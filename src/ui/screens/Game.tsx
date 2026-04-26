import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  type DiveRunSummary,
  createInitialScene,
  getDiveCompletionCelebration,
  getDiveDurationSeconds,
  getDiveRunSummary,
  type SessionMode,
} from "@/sim";
import type { PlayerInputProvider } from "@/sim/ai";
import { dailySeed } from "@/sim/rng";
import { useMetaProgression } from "@/hooks/useMetaProgression";
import { pushSeedToUrl, useSearchParamSeed } from "@/hooks/useSearchParamSeed";
import { Button } from "@/ui/primitives";
import { GameOverScreen } from "@/ui/shell/GameOverScreen";
import { GameViewport } from "@/ui/shell/GameViewport";
import { DrydockScreen } from "@/ui/shell/DrydockScreen";
import {
  clearDeepSeaSnapshot,
  resolveDeepSeaSnapshot,
  type DeepSeaRunSnapshot,
} from "@/lib/diveSnapshot";
import {
  type BestImprovements,
  NO_IMPROVEMENTS,
  recordDive,
  ZERO_BESTS,
} from "@/lib/personalBests";
import {
  type AchievementDef,
  evaluateAchievements,
} from "@/lib/achievements";
import { CompletionBackdrop } from "./CompletionBackdrop";
import { DiveScreen } from "./DiveScreen";
import { LandingScreen } from "./LandingScreen";
import { SeedPickerOverlay } from "./SeedPickerOverlay";
import type { StatTileProps } from "@/ui/primitives";

type GameState = "landing" | "drydock" | "playing" | "gameover" | "complete";

const BIOME_LABELS: Record<string, string> = {
  "photic-gate": "Photic Gate",
  "twilight-shelf": "Twilight Shelf",
  "midnight-column": "Midnight Column",
  "abyssal-trench": "Abyssal Trench",
  "stygian-abyss": "Stygian Abyss",
};

/**
 * Compose the post-dive stat tiles. The `kind` selects mode-specific
 * tiles (gameover shows depth; complete shows oxygen banked) and
 * appends optional run-stats when present (predators-killed,
 * max-chain, biomes-traversed, hits-taken, adrenaline-saves).
 *
 * Stats are appended only when non-trivial — a dive with zero
 * predators killed and chain × 1 doesn't clutter the screen with
 * bragging rights it didn't earn.
 */
function buildGameOverStats(
  finalScore: number,
  bestScore: number,
  summary: DiveRunSummary,
  kind: "gameover" | "complete",
  improvements: BestImprovements,
): StatTileProps[] {
  const tiles: StatTileProps[] = [
    { label: "Score", value: finalScore, countUp: true, newBest: improvements.score },
    { label: "Best", value: bestScore, countUp: true },
  ];

  if (kind === "gameover") {
    tiles.push({
      label: "Depth",
      value: `${summary.depthMeters}m`,
      newBest: improvements.depthMeters,
    });
  } else {
    tiles.push({ label: "Oxygen banked", value: `${summary.timeLeft}s` });
  }

  const stats = summary.stats;
  if (stats) {
    if (stats.predatorsKilled > 0) {
      tiles.push({
        label: "Predators broken",
        value: stats.predatorsKilled,
        countUp: true,
        newBest: improvements.predatorsKilled,
      });
    }
    if (stats.maxChain >= 3) {
      tiles.push({
        label: "Peak chain",
        value: `×${stats.maxChain}`,
        newBest: improvements.maxChain,
      });
    }
    if (stats.biomesTraversed.length >= 2) {
      tiles.push({
        label: "Biomes",
        value: stats.biomesTraversed
          .map((id) => BIOME_LABELS[id] ?? id)
          .join(" → "),
      });
    }
    if (stats.adrenalineTriggers > 0) {
      tiles.push({
        label: "Adrenaline saves",
        value: stats.adrenalineTriggers,
        countUp: true,
      });
    }
    if (stats.impactsTaken > 0) {
      tiles.push({
        label: "Hits taken",
        value: stats.impactsTaken,
        countUp: true,
      });
    }
    if (stats.buffsCollected > 0) {
      tiles.push({
        label: "Buffs",
        value: stats.buffsCollected,
        countUp: true,
      });
    }
  }

  tiles.push({ label: "Lux earned", value: `+${finalScore}`, accent: true });
  return tiles;
}

/**
 * Row of "Achievement Unlocked" toasts shown above the GameOver
 * action buttons. Each toast staggers in 0.12 s after the previous
 * so a multi-unlock dive (e.g. crossing several depth tiers in one
 * descent) reads as a satisfying cascade rather than a wall of
 * popups. Empty input renders nothing.
 */
function AchievementToasts({ achievements }: { achievements: AchievementDef[] }) {
  if (achievements.length === 0) return null;
  return (
    <div
      data-testid="gameover-achievement-row"
      className="flex w-full max-w-2xl flex-col items-center gap-2"
    >
      {achievements.map((def, idx) => (
        <motion.div
          key={def.id}
          initial={{ opacity: 0, y: 12, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4 + idx * 0.12, duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center px-4 py-2"
          style={{
            color: "#fef9c3",
            filter: "url(#bs-warm-glow)",
            textShadow:
              "0 0 12px rgba(254,249,195,0.55), 0 0 28px rgba(253,230,138,0.32)",
          }}
        >
          <span
            className="bs-label text-[0.6rem] font-semibold tracking-[0.22em]"
          >
            ACHIEVEMENT UNLOCKED
          </span>
          <span
            className="bs-display text-lg font-medium leading-snug"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {def.title}
          </span>
          <span
            className="text-xs italic text-fg/85"
            style={{ fontFamily: "var(--font-body)", textShadow: "0 0 8px rgba(2,6,17,0.85)" }}
          >
            {def.description}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

export interface GameProps {
  /**
   * Test seam: a `PlayerInputProvider` (typically a `GoapInputProvider`)
   * that replaces touch input inside the dive runtime. Production
   * callers omit this. When provided, browser tests can drive the dive
   * deterministically with a GOAP profile.
   */
  inputProvider?: PlayerInputProvider;
  /**
   * Test seam: when set, the game starts directly in the dive with this
   * mode, skipping the landing + seed picker. Pair with `autoStartSeed`
   * for fully deterministic browser tests; otherwise the dive falls
   * back to today's daily seed which drifts over time.
   */
  autoStartMode?: SessionMode;
  /**
   * Test seam: explicit numeric seed used when `autoStartMode` is
   * present. Without it the test would drift on the daily-seed clock.
   */
  autoStartSeed?: number;
}

export default function Game(props: GameProps = {}) {
  const { inputProvider, autoStartMode, autoStartSeed } = props;
  const [gameState, setGameState] = useState<GameState>(
    autoStartMode ? "playing" : "landing",
  );
  const [pickerMode, setPickerMode] = useState<SessionMode | null>(null);

  const { currency, upgrades, addCurrency, buyUpgrade } = useMetaProgression();

  const [sessionMode, setSessionMode] = useState<SessionMode>(
    autoStartMode ?? "descent",
  );
  const [initialSnapshot, setInitialSnapshot] = useState<DeepSeaRunSnapshot | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [finalSummary, setFinalSummary] = useState<DiveRunSummary | null>(null);

  // Seed priority on landing:
  //   1. `?seed=<codename>` in the URL (shared trench)
  //   2. Today's daily seed (a familiar default for repeat visitors)
  const urlSeed = useSearchParamSeed();
  const [previewSeed, setPreviewSeed] = useState<number>(
    () => autoStartSeed ?? urlSeed ?? dailySeed(),
  );
  useEffect(() => {
    if (urlSeed !== null) setPreviewSeed(urlSeed);
  }, [urlSeed]);

  // The seed used by the currently-playing dive; frozen at Begin Dive.
  const [activeSeed, setActiveSeed] = useState<number>(previewSeed);

  const displaySummaryDuration = getDiveDurationSeconds(sessionMode, activeSeed);
  const displaySummary =
    finalSummary ??
    getDiveRunSummary(
      { ...createInitialScene({ height: 600, width: 800 }), creatures: [], anomalies: [] },
      finalScore,
      displaySummaryDuration,
      displaySummaryDuration,
    );
  const completionCelebration = getDiveCompletionCelebration(displaySummary);

  // Record dive bests on transition into a terminal state. Side
  // effects in render fire on every commit (incl. StrictMode double-
  // invokes) — we only want to write once per dive-end. The
  // recorded improvements drive "NEW BEST!" callouts on the
  // post-dive screen.
  const [bests, setBests] = useState(() => ZERO_BESTS);
  const [improvements, setImprovements] = useState<BestImprovements>(NO_IMPROVEMENTS);
  const [newAchievements, setNewAchievements] = useState<AchievementDef[]>([]);
  useEffect(() => {
    if ((gameState === "gameover" || gameState === "complete") && finalSummary) {
      const result = recordDive(finalSummary);
      setBests(result.bests);
      setImprovements(result.improvements);
      const ach = evaluateAchievements({
        postBests: result.bests,
        summary: finalSummary,
      });
      setNewAchievements(ach.newlyUnlocked);
    } else if (gameState === "landing" || gameState === "drydock") {
      // Reset transient celebration state when leaving the post-dive
      // screen so a re-entry doesn't show stale badges/toasts.
      setImprovements(NO_IMPROVEMENTS);
      setNewAchievements([]);
    }
  }, [gameState, finalSummary]);
  const bestScore = bests.score;

  const startDive = (seed: number) => {
    // If a persisted snapshot exists for an *active* dive (timeLeft > 0,
    // already filtered inside resolveDeepSeaSnapshot), resume that dive
    // — that's the refresh-persistence contract: closing and re-opening
    // the tab while diving picks up where you left off, and the
    // snapshot's stored seed wins over the URL's seed param.
    //
    // resolveDeepSeaSnapshot returns null for any timed-out snapshot,
    // so the only path that survives here is a genuine in-progress
    // dive. A finished/expired snapshot drops cleanly and we start
    // fresh on the requested seed instead.
    const snapshot = resolveDeepSeaSnapshot();
    if (snapshot) {
      const resumeSeed = snapshot.seed ?? seed;
      setActiveSeed(resumeSeed);
      pushSeedToUrl(resumeSeed);
      setInitialSnapshot(snapshot);
      setSessionMode(snapshot.mode);
      setPickerMode(null);
      setGameState("playing");
      return;
    }
    setActiveSeed(seed);
    pushSeedToUrl(seed);
    setInitialSnapshot(null);
    setPickerMode(null);
    setGameState("playing");
  };

  const restartFromLanding = () => {
    clearDeepSeaSnapshot();
    setInitialSnapshot(null);
    setPreviewSeed(dailySeed());
    setGameState("landing");
  };

  return (
    <GameViewport background="var(--color-bg)" data-browser-screenshot-mode="page">
      <AnimatePresence mode="wait">
        {gameState === "landing" && (
          <LandingScreen
            key="landing"
            currency={currency}
            onPickMode={(mode) => {
              setSessionMode(mode);
              setPickerMode(mode);
            }}
            onOpenDrydock={() => setGameState("drydock")}
          />
        )}

        {gameState === "drydock" && (
          <DrydockScreen
            key="drydock"
            currency={currency}
            upgrades={upgrades}
            onBuy={buyUpgrade}
            onBack={() => setGameState("landing")}
          />
        )}

        {gameState === "playing" && (
          <motion.div
            key="playing"
            data-testid="playing-screen"
            className="absolute inset-0"
            // Dive entrance: a short downward slide + fade so the
            // transition reads as "descending into the trench"
            // rather than a hard cut from menu → gameplay.
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <DiveScreen
              initialSnapshot={initialSnapshot}
              mode={sessionMode}
              seed={activeSeed}
              upgrades={upgrades}
              inputProvider={inputProvider}
              onComplete={(s, summary) => {
                // Drop the persisted snapshot on terminal states so a
                // subsequent dive doesn't resurrect the finished run.
                clearDeepSeaSnapshot();
                setInitialSnapshot(null);
                setFinalScore(s);
                setFinalSummary(summary);
                addCurrency(s);
                setGameState("complete");
              }}
              onGameOver={(s, summary) => {
                clearDeepSeaSnapshot();
                setInitialSnapshot(null);
                setFinalScore(s);
                setFinalSummary(summary);
                addCurrency(s);
                setGameState("gameover");
              }}
            />
          </motion.div>
        )}

        {gameState === "gameover" && (
          <motion.div
            key="gameover"
            data-testid="gameover-screen"
            className="absolute inset-0"
            exit={{ opacity: 0 }}
          >
            <GameOverScreen
              title="Dive Logged"
              subtitle={
                finalScore > 0
                  ? "The trench remains. Follow beacon chains before oxygen or predators close in."
                  : "Surface for a breath, then chart a new route."
              }
              stats={buildGameOverStats(finalScore, bestScore, displaySummary, "gameover", improvements)}
            >
              <AchievementToasts achievements={newAchievements} />
              <Button variant="ghost" onClick={() => setGameState("drydock")}>
                Drydock
              </Button>
              <Button variant="primary" onClick={restartFromLanding}>
                Dive again
              </Button>
            </GameOverScreen>
          </motion.div>
        )}

        {gameState === "complete" && (
          <motion.div
            key="complete"
            data-testid="complete-screen"
            className="absolute inset-0"
            exit={{ opacity: 0 }}
          >
            <CompletionBackdrop celebration={completionCelebration} summary={displaySummary} />
            <GameOverScreen
              title={completionCelebration.title}
              subtitle={`${completionCelebration.message} ${completionCelebration.replayPrompt}`}
              stats={buildGameOverStats(finalScore, bestScore, displaySummary, "complete", improvements)}
            >
              <AchievementToasts achievements={newAchievements} />
              <Button variant="ghost" onClick={() => setGameState("drydock")}>
                Drydock
              </Button>
              <Button variant="primary" onClick={restartFromLanding}>
                Chart another route
              </Button>
            </GameOverScreen>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The seed picker is portaled and rides above any active screen. */}
      <SeedPickerOverlay
        mode={pickerMode}
        initialSeed={previewSeed}
        onCancel={() => setPickerMode(null)}
        onConfirm={startDive}
      />
    </GameViewport>
  );
}
