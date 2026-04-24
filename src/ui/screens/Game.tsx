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
  resolveDeepSeaSnapshot,
} from "@/lib/diveSnapshot";
import { recordScoreIfBest } from "@/lib/bestScore";
import { CompletionBackdrop } from "./CompletionBackdrop";
import { DiveScreen } from "./DiveScreen";
import { LandingScreen } from "./LandingScreen";
import { SeedPickerOverlay } from "./SeedPickerOverlay";

type GameState = "landing" | "drydock" | "playing" | "gameover" | "complete";

export default function Game() {
  const [gameState, setGameState] = useState<GameState>("landing");
  const [pickerMode, setPickerMode] = useState<SessionMode | null>(null);

  const { currency, upgrades, addCurrency, buyUpgrade } = useMetaProgression();

  const [sessionMode, setSessionMode] = useState<SessionMode>("descent");
  const [initialSnapshot, setInitialSnapshot] = useState<DeepSeaRunSnapshot | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [finalSummary, setFinalSummary] = useState<DiveRunSummary | null>(null);

  // Seed priority on landing:
  //   1. `?seed=<codename>` in the URL (shared trench)
  //   2. Today's daily seed (a familiar default for repeat visitors)
  const urlSeed = useSearchParamSeed();
  const [previewSeed, setPreviewSeed] = useState<number>(() => urlSeed ?? dailySeed());
  useEffect(() => {
    if (urlSeed !== null) setPreviewSeed(urlSeed);
  }, [urlSeed]);

  // The seed used by the currently-playing dive; frozen at Begin Dive.
  const [activeSeed, setActiveSeed] = useState<number>(previewSeed);

  const displaySummary =
    finalSummary ??
    getDiveRunSummary(
      { ...createInitialScene({ height: 600, width: 800 }), creatures: [], anomalies: [] },
      finalScore,
      getDiveDurationSeconds(sessionMode),
      getDiveDurationSeconds(sessionMode),
    );
  const completionCelebration = getDiveCompletionCelebration(displaySummary);

  const startDive = (seed: number) => {
    const snapshot = resolveDeepSeaSnapshot();
    const nextSeed = snapshot ? activeSeed : seed;
    setActiveSeed(nextSeed);
    pushSeedToUrl(nextSeed);
    setInitialSnapshot(snapshot);
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
    <GameViewport background="#050d15" data-browser-screenshot-mode="page">
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
              onComplete={(s, summary) => {
                setInitialSnapshot(null);
                setFinalScore(s);
                setFinalSummary(summary);
                addCurrency(s);
                setGameState("complete");
              }}
              onGameOver={(s, summary) => {
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
                { label: "Best", value: recordScoreIfBest(finalScore) },
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
                { label: "Best", value: recordScoreIfBest(finalScore) },
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
