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
  type DeepSeaRunSnapshot,
} from "@/lib/diveSnapshot";
import { recordScoreIfBest } from "@/lib/bestScore";
import { CompletionBackdrop } from "./CompletionBackdrop";
import { DiveScreen } from "./DiveScreen";
import { LandingScreen } from "./LandingScreen";
import { SeedPickerOverlay } from "./SeedPickerOverlay";

type GameState = "landing" | "drydock" | "playing" | "gameover" | "complete";

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

  // Record the score on transition into a terminal state, *not* during
  // render. Side effects in render fire on every commit (including
  // StrictMode double-invokes) — we only want to write best once per
  // dive-end. `bestScore` is the stable value the GameOverScreen reads.
  const [bestScore, setBestScore] = useState<number>(() => recordScoreIfBest(0));
  useEffect(() => {
    if (gameState === "gameover" || gameState === "complete") {
      setBestScore(recordScoreIfBest(finalScore));
    }
  }, [gameState, finalScore]);

  const startDive = (seed: number) => {
    // The user explicitly clicked "Begin Dive" with a fresh seed —
    // they want a new dive, not a resumed one. Snapshot restore only
    // makes sense for in-tab refreshes (browser reload), not for
    // user-initiated session starts. Drop any persisted snapshot
    // here so the dive starts clean.
    clearDeepSeaSnapshot();
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
              stats={[
                { label: "Score", value: finalScore },
                { label: "Best", value: bestScore },
                { label: "Depth", value: `${displaySummary.depthMeters}m` },
                { label: "Lux earned", value: `+${finalScore}`, accent: true },
              ]}
            >
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
              stats={[
                { label: "Score", value: finalScore },
                { label: "Best", value: bestScore },
                { label: "Oxygen banked", value: `${displaySummary.timeLeft}s` },
                { label: "Lux earned", value: `+${finalScore}`, accent: true },
              ]}
            >
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
