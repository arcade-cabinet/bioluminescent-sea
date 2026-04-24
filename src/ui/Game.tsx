import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Creature,
  createInitialScene,
  createSeededScene,
  type DiveCompletionCelebration,
  type DiveRunSummary,
  type DiveTelemetry,
  getDiveCompletionCelebration,
  getDiveDurationSeconds,
  getDiveRunSummary,
  getDiveTelemetry,
  isDiveComplete,
  type Particle,
  type Pirate,
  type Player,
  type Predator,
  resolveDiveThreatImpact,
  type SceneState,
} from "@/sim";
import { useGameLoop } from "@/hooks/useGameLoop";
import { pushSeedToUrl, useSearchParamSeed } from "@/hooks/useSearchParamSeed";
import { useTouchInput } from "@/hooks/useTouchInput";
import { createAmbient, disposeSfx, playSfx } from "@/audio";
import { codenameFromSeed, dailySeed, randomSeed, seedFromCodename, trenchBlurbForSeed } from "@/sim/rng";
import {
  advanceDiveFrame,
  createDiveWorld,
  decayThreatFlash,
  destroyDiveWorld,
  recordThreatFlash,
  type DiveWorld,
} from "@/ecs";
import { createRenderBridge, type RenderBridge } from "@/render";
import type { SessionMode } from "@/sim/_shared/sessionMode";
import { HUD } from "@/ui/hud/HUD";
import { GameOverScreen, GameViewport, OverlayButton, StartScreen } from "@/ui/shell";

const DIVE_SAVE_KEY = "bioluminescent-sea:v1:save";
const BEST_SCORE_KEY = "bioluminescent-sea:v1:best-score";

// silence "declared but never read" — StartScreen is referenced in JSX
void StartScreen;

interface CollectionBurst {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  startedAt: number;
}

interface OxygenPulse {
  bonusSeconds: number;
  id: string;
}

interface ImpactPulse {
  id: string;
  penaltySeconds: number;
}

interface DeepSeaRunSnapshot {
  lastCollectTime: number;
  mode: SessionMode;
  multiplier: number;
  scene: SceneState;
  score: number;
  telemetry: DiveTelemetry;
  timeLeft: number;
}


function getViewportScale(width: number, height: number) {
  const minDimension = Math.min(width, height);
  return Math.min(1.08, Math.max(0.72, minDimension / 640));
}

function shouldUpdateTelemetry(current: DiveTelemetry, next: DiveTelemetry) {
  return (
    current.objective !== next.objective ||
    current.pressureLabel !== next.pressureLabel ||
    Math.abs(current.collectionRatio - next.collectionRatio) > 0.01 ||
    Math.abs(current.oxygenRatio - next.oxygenRatio) > 0.01 ||
    Math.abs(current.nearestThreatDistance - next.nearestThreatDistance) > 18 ||
    Math.abs(current.nearestBeaconDistance - next.nearestBeaconDistance) > 18 ||
    Math.abs(current.depthMeters - next.depthMeters) > 20 ||
    current.routeLandmarkLabel !== next.routeLandmarkLabel ||
    Math.abs(current.routeLandmarkDistance - next.routeLandmarkDistance) > 14
  );
}

function getInitialDiveDimensions() {
  if (typeof window === "undefined") return { height: 600, width: 800 };

  return {
    height: Math.max(320, Math.round(window.innerHeight)),
    width: Math.max(320, Math.round(window.innerWidth)),
  };
}

function DeepSeaGame({
  initialSnapshot,
  mode,
  seed,
  onComplete,
  onGameOver,
}: {
  initialSnapshot?: DeepSeaRunSnapshot | null;
  mode: SessionMode;
  seed: number;
  onComplete: (score: number, summary: DiveRunSummary) => void;
  onGameOver: (score: number, summary: DiveRunSummary) => void;
}) {
  const durationSeconds = getDiveDurationSeconds(mode);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initialDimensionsRef = useRef(getInitialDiveDimensions());
  const initialSceneRef = useRef<SceneState | null>(null);
  if (!initialSceneRef.current) {
    initialSceneRef.current = initialSnapshot
      ? cloneSceneState(initialSnapshot.scene)
      : createSeededScene(seed, initialDimensionsRef.current);
  }

  const initialScene = initialSceneRef.current;
  const [score, setScore] = useState(initialSnapshot?.score ?? 0);
  const [timeLeft, setTimeLeft] = useState(initialSnapshot?.timeLeft ?? durationSeconds);
  const [multiplier, setMultiplier] = useState(initialSnapshot?.multiplier ?? 1);
  const [dimensions, setDimensions] = useState(initialDimensionsRef.current);
  const [isGameOver, setIsGameOver] = useState(false);
  const [oxygenPulse, setOxygenPulse] = useState<OxygenPulse | null>(null);
  const [impactPulse, setImpactPulse] = useState<ImpactPulse | null>(null);
  const [telemetry, setTelemetry] = useState<DiveTelemetry>(
    () =>
      initialSnapshot?.telemetry ?? getDiveTelemetry(initialScene, durationSeconds, durationSeconds)
  );

  // Lazy one-shot world creation: useRef evaluates its arg on every
  // render, which exhausts Koota's 16-world ceiling under StrictMode +
  // HMR. Guarding with a ref sentinel means the world is constructed
  // exactly once per mounted component, destroyed in the cleanup.
  const worldRef = useRef<DiveWorld | null>(null);
  if (worldRef.current === null) {
    worldRef.current = createDiveWorld(initialScene, seed);
  }

  const playerRef = useRef<Player>(initialScene.player);
  const creaturesRef = useRef<Creature[]>(initialScene.creatures);
  const predatorsRef = useRef<Predator[]>(initialScene.predators);
  const piratesRef = useRef<Pirate[]>(initialScene.pirates);
  const particlesRef = useRef<Particle[]>(initialScene.particles);
  const collectionBurstsRef = useRef<CollectionBurst[]>([]);
  const lastCollectTimeRef = useRef(initialSnapshot?.lastCollectTime ?? 0);
  const multiplierRef = useRef(initialSnapshot?.multiplier ?? 1);
  const scoreRef = useRef(initialSnapshot?.score ?? 0);
  const elapsedOffsetRef = useRef(durationSeconds - (initialSnapshot?.timeLeft ?? durationSeconds));
  // Initialize to 0 (dive start) rather than -Infinity so the first
  // tuning.impactGraceSeconds of the run is graceful — a first-time
  // player who spawns near a predator cone doesn't eat a hull shock
  // before they've moved. -Infinity would produce a subtraction of
  // +Infinity in resolveDiveThreatImpact, defeating the grace window.
  const lastImpactTimeRef = useRef(0);
  const timeModifierRef = useRef(0);
  const bridgeRef = useRef<RenderBridge | null>(null);
  const ambientRef = useRef<ReturnType<typeof createAmbient> | null>(null);
  const previousBiomeRef = useRef<string | null>(null);
  const previousLowOxRef = useRef(false);
  // Mirror of scene.depthTravelMeters — the sub's current world-Y.
  // The game loop owns advancing it via the sim; telemetry + summary
  // literal-rebuilds in this component read from here so every scene
  // snapshot we hand to the sim carries the current depth.
  const depthTravelMetersRef = useRef(initialSnapshot?.scene.depthTravelMeters ?? 0);

  // Tear the ECS world down when the component unmounts so re-mounts
  // (dive restart, HMR, StrictMode double-invoke) start from a fresh
  // world. The null-init sentinel plus this cleanup keeps the Koota
  // world ceiling from filling up.
  useEffect(() => {
    return () => {
      if (worldRef.current) {
        destroyDiveWorld(worldRef.current);
        worldRef.current = null;
      }
    };
  }, []);

  // Start the ambient pad on mount; tear it down on unmount. A mount
  // is a single dive — when the player surfaces (game-over/complete),
  // DeepSeaGame unmounts and the pad stops. Dive Again remounts.
  useEffect(() => {
    const ambient = createAmbient();
    ambientRef.current = ambient;
    ambient.start().catch((err) => {
      // Browser needs a user gesture; if start() fires before the
      // Begin Dive click (e.g. HMR with a stale click budget), surface
      // the error but don't crash.
      console.warn("[audio] ambient start deferred:", err);
    });
    return () => {
      ambient.stop();
      ambientRef.current = null;
      // Tear down the module-level SFX synths too. They live on
      // Tone.getDestination() and would otherwise accumulate orphans
      // across StrictMode double-mount + HMR + Dive Again cycles.
      disposeSfx();
    };
  }, []);

  const input = useTouchInput(containerRef);

  useEffect(() => {
    let disposed = false;
    let bridge: RenderBridge | null = null;
    const canvas = canvasRef.current;
    if (!canvas) return;

    createRenderBridge(canvas)
      .then((b) => {
        if (disposed) {
          b.destroy();
          return;
        }
        bridge = b;
        bridgeRef.current = b;
      })
      .catch((err) => {
        // Surfacing the error here keeps React happy if the page is
        // in strict CSP and `pixi.js/unsafe-eval` wasn't imported, or
        // if WebGL context allocation failed. The user-visible effect
        // is an unrendered scene; we don't want a silent hang.
        console.error("[render] bridge init failed:", err);
      });

    return () => {
      disposed = true;
      bridge?.destroy();
      bridgeRef.current = null;
    };
  }, []);

  useEffect(() => {
    bridgeRef.current?.resize(dimensions.width, dimensions.height);
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    const updateDimensions = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      setDimensions({
        width: Math.max(320, Math.round(rect?.width ?? window.innerWidth)),
        height: Math.max(320, Math.round(rect?.height ?? window.innerHeight)),
      });
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setTelemetry(
      getDiveTelemetry(
        {
          creatures: creaturesRef.current,
          particles: particlesRef.current,
          pirates: piratesRef.current,
          player: playerRef.current,
          predators: predatorsRef.current,
          depthTravelMeters: depthTravelMetersRef.current,
        },
        timeLeft,
        durationSeconds
      )
    );
  }, [durationSeconds, timeLeft]);

  // Mirror telemetry + timeLeft into refs so writeSnapshot stays
  // referentially stable. If writeSnapshot closed over the state
  // directly, the autosave useEffect below would tear down and re-arm
  // its setInterval(2500) on every timeLeft tick (~1 Hz), and the
  // cleanup's writeSnapshot() would fire on every rebuild — blowing
  // well past the intended 0.4 Hz write cadence.
  const telemetryRef = useRef(telemetry);
  const timeLeftRef = useRef(timeLeft);
  telemetryRef.current = telemetry;
  timeLeftRef.current = timeLeft;

  const writeSnapshot = useCallback(() => {
    const snapshot: DeepSeaRunSnapshot = {
      lastCollectTime: lastCollectTimeRef.current,
      mode,
      multiplier: multiplierRef.current,
      scene: cloneSceneState({
        creatures: creaturesRef.current,
        particles: particlesRef.current,
        pirates: piratesRef.current,
        player: playerRef.current,
        predators: predatorsRef.current,
        depthTravelMeters: depthTravelMetersRef.current,
      }),
      score: scoreRef.current,
      telemetry: telemetryRef.current,
      timeLeft: timeLeftRef.current,
    };
    try {
      localStorage.setItem(DIVE_SAVE_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage may be disabled or full — ignore.
    }
  }, [mode]);

  const showOxygenPulse = useCallback((bonusSeconds: number, totalTime: number) => {
    const id = `oxygen-${Math.round(totalTime * 1000)}`;
    setOxygenPulse({ bonusSeconds, id });
    window.setTimeout(() => {
      setOxygenPulse((current) => (current?.id === id ? null : current));
    }, 1_200);
  }, []);

  const showImpactPulse = useCallback((penaltySeconds: number, totalTime: number) => {
    const id = `impact-${Math.round(totalTime * 1000)}`;
    setImpactPulse({ id, penaltySeconds });
    window.setTimeout(() => {
      setImpactPulse((current) => (current?.id === id ? null : current));
    }, 1_300);
  }, []);

  useEffect(() => {
    if (isGameOver) return undefined;

    const initial = window.setTimeout(writeSnapshot, 400);
    const interval = window.setInterval(writeSnapshot, 2_500);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      writeSnapshot();
    };
  }, [isGameOver, writeSnapshot]);

  const gameLoop = useCallback(
    (deltaTime: number, totalTime: number) => {
      if (isGameOver) return;

      const effectiveTotalTime = elapsedOffsetRef.current + totalTime;
      const getAdjustedTimeLeft = () =>
        Math.max(
          0,
          Math.min(
            durationSeconds,
            Math.floor(durationSeconds - effectiveTotalTime + timeModifierRef.current)
          )
        );
      let newTimeLeft = getAdjustedTimeLeft();
      const getCurrentSummary = (timeLeftForSummary = newTimeLeft) =>
        getDiveRunSummary(
          {
            creatures: creaturesRef.current,
            particles: particlesRef.current,
            pirates: piratesRef.current,
            player: playerRef.current,
            predators: predatorsRef.current,
            depthTravelMeters: depthTravelMetersRef.current,
          },
          scoreRef.current,
          timeLeftForSummary,
          durationSeconds
        );
      if (newTimeLeft !== timeLeft) {
        setTimeLeft(newTimeLeft);
        if (newTimeLeft === 0) {
          setIsGameOver(true);
          onGameOver(scoreRef.current, getCurrentSummary(0));
          return;
        }
      }

      const currentWorld = worldRef.current;
      if (!currentWorld) return;

      const { world: nextWorld, result } = advanceDiveFrame({
        world: currentWorld,
        input,
        dimensions,
        deltaTime,
        totalTime: effectiveTotalTime,
        timeLeft: newTimeLeft,
        mode,
        lastCollectTime: lastCollectTimeRef.current,
        multiplier: multiplierRef.current,
      });
      worldRef.current = nextWorld;

      // Mirror scene state onto the entity refs used by the snapshot,
      // telemetry, and game-over paths. When PR E + F land, these
      // callers will read directly from ECS traits and the mirror
      // disappears.
      playerRef.current = result.scene.player;
      creaturesRef.current = result.scene.creatures;
      predatorsRef.current = result.scene.predators;
      piratesRef.current = result.scene.pirates;
      particlesRef.current = result.scene.particles;
      depthTravelMetersRef.current = result.scene.depthTravelMeters;

      if (result.collection.collected.length > 0) {
        void playSfx("collect");
        collectionBurstsRef.current.push(
          ...result.collection.collected.map((creature) => ({
            color: creature.glowColor,
            id: `${creature.id}-${Math.round(effectiveTotalTime * 1000)}`,
            size: creature.size,
            startedAt: effectiveTotalTime,
            x: creature.x,
            y: creature.y,
          }))
        );
        collectionBurstsRef.current = collectionBurstsRef.current.filter(
          (burst) => effectiveTotalTime - burst.startedAt < 0.95
        );
        multiplierRef.current = result.collection.multiplier;
        lastCollectTimeRef.current = result.collection.lastCollectTime;
        scoreRef.current += result.collection.scoreDelta;
        setMultiplier(result.collection.multiplier);
        setScore(scoreRef.current);

        if (result.collection.oxygenBonusSeconds > 0) {
          const cappedBonus = Math.min(
            result.collection.oxygenBonusSeconds,
            Math.max(0, durationSeconds - newTimeLeft)
          );

          if (cappedBonus > 0) {
            timeModifierRef.current += cappedBonus;
            newTimeLeft = getAdjustedTimeLeft();
            setTimeLeft(newTimeLeft);
            showOxygenPulse(cappedBonus, effectiveTotalTime);
          }
        }
      }

      if (isDiveComplete(result.scene)) {
        setIsGameOver(true);
        void playSfx("dive-complete");
        onComplete(
          scoreRef.current,
          getDiveRunSummary(result.scene, scoreRef.current, newTimeLeft, durationSeconds)
        );
        return;
      }

      setTelemetry((current) => {
        if (!shouldUpdateTelemetry(current, result.telemetry)) return current;
        return result.telemetry;
      });

      // Audio reactions — ambient modulation + SFX for threshold
      // crossings. Checked every frame but guarded by the `previous*`
      // refs so we only fire on transition.
      ambientRef.current?.setBiome(result.telemetry.biomeId);
      ambientRef.current?.setDepthMeters(result.telemetry.depthMeters);
      if (previousBiomeRef.current !== result.telemetry.biomeId) {
        if (previousBiomeRef.current !== null) {
          void playSfx("biome-transition");
        }
        previousBiomeRef.current = result.telemetry.biomeId;
      }
      const lowOx = result.telemetry.oxygenRatio < 0.25;
      if (lowOx && !previousLowOxRef.current) {
        void playSfx("oxygen-warn");
      }
      previousLowOxRef.current = lowOx;

      if (result.collidedWithPredator) {
        const impact = resolveDiveThreatImpact({
          collided: result.collidedWithPredator,
          lastImpactTimeSeconds: lastImpactTimeRef.current,
          mode,
          timeLeft: newTimeLeft,
          totalTimeSeconds: effectiveTotalTime,
        });

        if (impact.type !== "none") {
          lastImpactTimeRef.current = effectiveTotalTime;
          recordThreatFlash(currentWorld);
          void playSfx("impact");
        }

        if (impact.type === "oxygen-penalty") {
          timeModifierRef.current -= impact.oxygenPenaltySeconds;
          newTimeLeft = impact.timeLeft;
          setTimeLeft(newTimeLeft);
          showImpactPulse(impact.oxygenPenaltySeconds, effectiveTotalTime);
        } else if (impact.type === "dive-failed") {
          setIsGameOver(true);
          onGameOver(scoreRef.current, getCurrentSummary(0));
          return;
        }
      }

      // Decay the threat-flash alpha independently of impact events so
      // the fade is smooth at any frame rate.
      decayThreatFlash(nextWorld, deltaTime);

      bridgeRef.current?.renderFrame({
        world: nextWorld,
        bursts: collectionBurstsRef.current,
        viewportScale: getViewportScale(dimensions.width, dimensions.height),
        biomeTintHex: result.telemetry.biomeTintHex,
      });
    },
    [
      dimensions,
      input,
      timeLeft,
      isGameOver,
      onGameOver,
      onComplete,
      durationSeconds,
      mode,
      showOxygenPulse,
      showImpactPulse,
    ]
  );

  useGameLoop(gameLoop, !isGameOver);
  const threatAlert = telemetry.nearestThreatDistance < 180;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <canvas
        aria-label="Bioluminescent Sea playfield"
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          transition: "opacity 0.2s",
          background: threatAlert
            ? "radial-gradient(circle at 50% 52%, transparent 48%, rgba(255, 107, 107, 0.26) 100%)"
            : "radial-gradient(circle at 50% 52%, transparent 62%, rgba(107, 230, 193, 0.07) 100%)",
          opacity: threatAlert ? 1 : 0.72,
        }}
      />
      <AnimatePresence>
        {oxygenPulse && (
          <motion.div
            key={oxygenPulse.id}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            style={{
              position: "absolute",
              top: "6rem",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "0.5rem 1rem",
              background: "rgba(14, 79, 85, 0.85)",
              border: "1px solid var(--color-glow)",
              borderRadius: 8,
              color: "var(--color-glow)",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "0.85rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              pointerEvents: "none",
              zIndex: 20,
              boxShadow: "0 0 18px rgba(107, 230, 193, 0.35)",
            }}
          >
            Oxygen +{oxygenPulse.bonusSeconds}s
          </motion.div>
        )}
        {impactPulse && (
          <motion.div
            key={impactPulse.id}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            style={{
              position: "absolute",
              top: "9rem",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "0.5rem 1rem",
              background: "rgba(80, 18, 18, 0.85)",
              border: "1px solid var(--color-warn)",
              borderRadius: 8,
              color: "var(--color-warn)",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "0.85rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              pointerEvents: "none",
              zIndex: 20,
              boxShadow: "0 0 18px rgba(255, 107, 107, 0.35)",
            }}
          >
            Hull Shock −{impactPulse.penaltySeconds}s
          </motion.div>
        )}
      </AnimatePresence>
      <HUD
        score={score}
        timeLeft={timeLeft}
        multiplier={multiplier}
        depthMeters={telemetry.depthMeters}
        beacons={Math.round(telemetry.collectionRatio * 100)}
        oxygenRatio={telemetry.oxygenRatio}
        threatAlert={threatAlert}
        nearestLandmarkLabel={telemetry.routeLandmarkLabel}
        nearestLandmarkDistance={telemetry.routeLandmarkDistance}
        runCodename={codenameFromSeed(seed)}
        biomeLabel={telemetry.biomeLabel}
        biomeTintHex={telemetry.biomeTintHex}
      />
      {/* Objective banner — bottom center, single line of legible intent */}
      <div
        style={{
          position: "absolute",
          bottom: "max(env(safe-area-inset-bottom), 1rem)",
          left: "1rem",
          right: "1rem",
          pointerEvents: "none",
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          data-testid="objective-banner"
          style={{
            padding: "0.6rem 1.1rem",
            background: "rgba(10, 26, 46, 0.75)",
            border: "1px solid rgba(107, 230, 193, 0.22)",
            borderRadius: 999,
            fontFamily: "var(--font-body)",
            fontSize: "0.85rem",
            fontWeight: 500,
            color: "var(--color-fg)",
            textAlign: "center",
            maxWidth: "60ch",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 4px 18px rgba(5, 10, 20, 0.45)",
          }}
        >
          {telemetry.objective}
        </div>
      </div>
    </div>
  );
}

function DiveCompletionBackdrop({
  celebration,
  summary,
}: {
  celebration: DiveCompletionCelebration;
  summary: DiveRunSummary;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(45,212,191,0.2),transparent_42%),linear-gradient(180deg,#051923,#020611)]"
    >
      <div className="absolute inset-x-[8%] top-[16%] h-[52%] rounded-[50%] border border-cyan-200/20 shadow-[0_0_80px_rgba(45,212,191,0.22)]" />
      {celebration.landmarkSequence.map((landmark, index) => {
        const progress =
          celebration.landmarkSequence.length <= 1
            ? 0
            : index / (celebration.landmarkSequence.length - 1);
        return (
          <div
            key={landmark}
            className="absolute grid h-14 w-14 place-items-center rounded-full border border-cyan-100/30 bg-cyan-900/35 text-[0.48rem] font-black uppercase tracking-[0.14em] text-cyan-50 shadow-[0_0_28px_rgba(103,232,249,0.4)]"
            style={{
              left: `${12 + progress * 76}%`,
              top: `${62 - Math.sin(progress * Math.PI) * 34}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {index + 1}
          </div>
        );
      })}
      <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 rounded-md border border-amber-200/25 bg-slate-950/56 px-4 py-2 text-center font-mono text-[0.64rem] font-black uppercase tracking-[0.2em] text-amber-100">
        {summary.timeLeft}s oxygen banked / {summary.depthMeters}m charted
      </div>
    </div>
  );
}

function resolveDeepSeaSnapshot(): DeepSeaRunSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(DIVE_SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isDeepSeaSnapshot(parsed)) return null;
    return { ...parsed, scene: cloneSceneState(parsed.scene) };
  } catch {
    return null;
  }
}

function clearDeepSeaSnapshot(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(DIVE_SAVE_KEY);
  } catch {
    // ignore
  }
}

function getBestScore(): number {
  if (typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordScoreIfBest(score: number): number {
  const best = getBestScore();
  if (score > best) {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(score));
    } catch {
      // ignore
    }
    return score;
  }
  return best;
}

function isDeepSeaSnapshot(snapshot: unknown): snapshot is DeepSeaRunSnapshot {
  const value = snapshot as Partial<DeepSeaRunSnapshot> | undefined;
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.score === "number" &&
      typeof value.timeLeft === "number" &&
      typeof value.multiplier === "number" &&
      typeof value.lastCollectTime === "number" &&
      isSceneSnapshot(value.scene)
  );
}

function isSceneSnapshot(scene: unknown): scene is SceneState {
  const value = scene as Partial<SceneState> | undefined;
  return Boolean(
    value &&
      typeof value === "object" &&
      value.player &&
      typeof value.player === "object" &&
      Array.isArray(value.creatures) &&
      Array.isArray(value.predators) &&
      Array.isArray(value.pirates) &&
      Array.isArray(value.particles)
  );
}

function cloneSceneState(scene: SceneState): SceneState {
  return JSON.parse(JSON.stringify(scene)) as SceneState;
}

export default function Game() {
  const [gameState, setGameState] = useState<"landing" | "customization" | "playing" | "gameover" | "complete">(
    "landing"
  );
  const [sessionMode, setSessionMode] = useState<SessionMode>("standard");
  const [initialSnapshot, setInitialSnapshot] = useState<DeepSeaRunSnapshot | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [finalSummary, setFinalSummary] = useState<DiveRunSummary | null>(null);

  const urlSeed = useSearchParamSeed();
  // The landing previews the *next* dive. Seed priority:
  //   1. `?seed=<codename>` in the URL (shared trench)
  //   2. A fresh random seed re-rolled each time the landing mounts
  const [previewSeed, setPreviewSeed] = useState<number>(
    () => urlSeed ?? randomSeed()
  );
  const [editingCodename, setEditingCodename] = useState<string>("");

  useEffect(() => {
    if (urlSeed !== null) setPreviewSeed(urlSeed);
  }, [urlSeed]);

  useEffect(() => {
    setEditingCodename(codenameFromSeed(previewSeed));
  }, [previewSeed]);

  // The seed used by the currently-playing dive; frozen at Begin Dive.
  const [activeSeed, setActiveSeed] = useState<number>(previewSeed);
  const previewCodename = codenameFromSeed(previewSeed);
  const todayCodename = codenameFromSeed(dailySeed());
  const fallbackSummary = getDiveRunSummary(
    { ...createInitialScene({ height: 600, width: 800 }), creatures: [] },
    finalScore,
    getDiveDurationSeconds(sessionMode),
    getDiveDurationSeconds(sessionMode)
  );
  const displaySummary = finalSummary ?? fallbackSummary;
  const completionCelebration = getDiveCompletionCelebration(displaySummary);

  return (
    <GameViewport background="#050d15" data-browser-screenshot-mode="page">
      <AnimatePresence mode="wait">
        {gameState === "landing" && (
          <motion.div
            key="landing"
            data-testid="landing-screen"
            style={{ position: "absolute", inset: 0 }}
            exit={{ opacity: 0 }}
          >
            <StartScreen
              title="Bioluminescent Sea"
              subtitle="Sink into an abyssal trench. Trace glowing routes past landmark creatures. Surface breathing easier than when you started."
              runPreview={{
                codename: previewCodename,
                blurb: trenchBlurbForSeed(previewSeed).full,
              }}
              primaryAction={{
                label: "New Dive",
                onClick: () => {
                  setGameState("customization");
                },
              }}
              secondaryAction={{
                label: `Today's Trench — ${todayCodename}`,
                onClick: () => {
                  setPreviewSeed(dailySeed());
                  setGameState("customization");
                },
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {(["cozy", "standard", "challenge"] as const).map((m) => (
                  <OverlayButton
                    key={m}
                    variant={m === sessionMode ? "primary" : "ghost"}
                    onClick={() => setSessionMode(m)}
                  >
                    {m}
                  </OverlayButton>
                ))}
              </div>
            </StartScreen>
          </motion.div>
        )}
        {gameState === "customization" && (
          <motion.div
            key="customization"
            data-testid="customization-screen"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem 1.5rem",
              background: "var(--color-bg)",
              color: "var(--color-fg)",
              textAlign: "center",
              zIndex: 10,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div style={{ maxWidth: 400, width: "100%", background: "var(--color-abyss)", padding: "2rem", borderRadius: "1rem", border: "1px solid var(--color-deep)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", color: "var(--color-glow)", fontSize: "2rem", margin: "0 0 1rem 0" }}>Chart Your Route</h2>
              <p style={{ color: "var(--color-fg-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                Every trench is generated from a three-word phrase. Edit this phrase to explore a different permutation of the abyss.
              </p>
              
              <div style={{ marginBottom: "2rem" }}>
                <input 
                  type="text" 
                  value={editingCodename}
                  onChange={(e) => {
                    setEditingCodename(e.target.value);
                    const parsed = seedFromCodename(e.target.value);
                    if (parsed !== null) setPreviewSeed(parsed);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    background: "rgba(5, 10, 20, 0.5)",
                    border: "1px solid var(--color-glow)",
                    color: "var(--color-fg)",
                    fontFamily: "var(--font-body)",
                    fontSize: "1rem",
                    textAlign: "center",
                    borderRadius: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                />
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                  <OverlayButton variant="ghost" onClick={() => setPreviewSeed(randomSeed())}>Reroll</OverlayButton>
                  <OverlayButton variant="ghost" onClick={() => setPreviewSeed(dailySeed())}>Daily</OverlayButton>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                <OverlayButton variant="ghost" onClick={() => setGameState("landing")}>Back</OverlayButton>
                <OverlayButton variant="primary" onClick={() => {
                  const snapshot = resolveDeepSeaSnapshot();
                  const nextSeed = snapshot ? activeSeed : previewSeed;
                  setActiveSeed(nextSeed);
                  pushSeedToUrl(nextSeed);
                  setInitialSnapshot(snapshot);
                  setGameState("playing");
                }}>Begin Dive</OverlayButton>
              </div>
            </div>
          </motion.div>
        )}
        {gameState === "playing" && (
          <motion.div
            key="playing"
            data-testid="playing-screen"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <DeepSeaGame
              initialSnapshot={initialSnapshot}
              mode={sessionMode}
              seed={activeSeed}
              onComplete={(s, summary) => {
                setInitialSnapshot(null);
                setFinalScore(s);
                setFinalSummary(summary);
                setGameState("complete");
              }}
              onGameOver={(s, summary) => {
                setInitialSnapshot(null);
                setFinalScore(s);
                setFinalSummary(summary);
                setGameState("gameover");
              }}
            />
          </motion.div>
        )}
        {gameState === "gameover" && (
          <motion.div
            key="gameover"
            data-testid="gameover-screen"
            style={{ position: "absolute", inset: 0 }}
            exit={{ opacity: 0 }}
          >
            <GameOverScreen
              title="Dive Logged"
              subtitle={`Score ${finalScore}${
                finalScore > 0 ? ` · Best ${recordScoreIfBest(finalScore)}` : ""
              }. The trench remains. Follow beacon chains before oxygen or predators close in.`}
            >
              <OverlayButton
                onClick={() => {
                  clearDeepSeaSnapshot();
                  setInitialSnapshot(null);
                  setPreviewSeed(randomSeed());
                  setGameState("landing");
                }}
              >
                Dive Again
              </OverlayButton>
            </GameOverScreen>
          </motion.div>
        )}
        {gameState === "complete" && (
          <motion.div
            key="complete"
            data-testid="complete-screen"
            style={{ position: "absolute", inset: 0 }}
            exit={{ opacity: 0 }}
          >
            <DiveCompletionBackdrop celebration={completionCelebration} summary={displaySummary} />
            <GameOverScreen
              title={completionCelebration.title}
              subtitle={`${completionCelebration.message} ${displaySummary.timeLeft}s oxygen banked · Best ${recordScoreIfBest(
                finalScore
              )}. ${completionCelebration.replayPrompt}`}
            >
              <OverlayButton
                onClick={() => {
                  clearDeepSeaSnapshot();
                  setInitialSnapshot(null);
                  setPreviewSeed(randomSeed());
                  setGameState("landing");
                }}
              >
                Chart Another Route
              </OverlayButton>
            </GameOverScreen>
          </motion.div>
        )}
      </AnimatePresence>
    </GameViewport>
  );
}
