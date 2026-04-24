import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Creature,
  createInitialScene,
  type DiveRunSummary,
  type DiveTelemetry,
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
  type SessionMode,
} from "@/sim";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useTouchInput } from "@/hooks/useTouchInput";
import { createAmbient, disposeSfx, playSfx } from "@/audio";
import { codenameFromSeed } from "@/sim/rng";
import {
  advanceDiveFrame,
  createDiveWorld,
  decayThreatFlash,
  destroyDiveWorld,
  recordThreatFlash,
  type DiveWorld,
} from "@/ecs";
import { createRenderBridge, type RenderBridge } from "@/render";
import type { SubUpgrades } from "@/sim/meta/upgrades";
import { HUD } from "@/ui/hud/HUD";
import {
  cloneSceneState,
  type DeepSeaRunSnapshot,
  writeDeepSeaSnapshot,
} from "@/lib/diveSnapshot";

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

interface DiveScreenProps {
  initialSnapshot?: DeepSeaRunSnapshot | null;
  mode: SessionMode;
  seed: number;
  upgrades: SubUpgrades;
  onComplete: (score: number, summary: DiveRunSummary) => void;
  onGameOver: (score: number, summary: DiveRunSummary) => void;
}

export function DiveScreen({
  initialSnapshot,
  mode,
  seed,
  upgrades,
  onComplete,
  onGameOver,
}: DiveScreenProps) {
  const durationSeconds = getDiveDurationSeconds(mode, upgrades);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initialDimensionsRef = useRef(getInitialDiveDimensions());
  const initialSceneRef = useRef<SceneState | null>(null);
  if (!initialSceneRef.current) {
    initialSceneRef.current = initialSnapshot
      ? cloneSceneState(initialSnapshot.scene)
      : createInitialScene(initialDimensionsRef.current, upgrades);
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
      initialSnapshot?.telemetry ?? getDiveTelemetry(initialScene, durationSeconds, durationSeconds),
  );

  // Lazy one-shot world creation: useRef evaluates its arg on every render,
  // which exhausts Koota's 16-world ceiling under StrictMode + HMR. Guarding
  // with a ref sentinel means the world is constructed exactly once per
  // mounted component, destroyed in the cleanup.
  const worldRef = useRef<DiveWorld | null>(null);
  if (worldRef.current === null) {
    worldRef.current = createDiveWorld(initialScene, seed);
  }

  const playerRef = useRef<Player>(initialScene.player);
  const anomaliesRef = useRef<import("@/sim/entities/types").Anomaly[]>(initialScene.anomalies);
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
  // tuning.impactGraceSeconds of the run is graceful — a first-time player
  // who spawns near a predator cone doesn't eat a hull shock before they've
  // moved.
  const lastImpactTimeRef = useRef(0);
  const timeModifierRef = useRef(0);
  const bridgeRef = useRef<RenderBridge | null>(null);
  const ambientRef = useRef<ReturnType<typeof createAmbient> | null>(null);
  const previousBiomeRef = useRef<string | null>(null);
  const previousLowOxRef = useRef(false);
  const depthTravelMetersRef = useRef(initialSnapshot?.scene.depthTravelMeters ?? 0);

  useEffect(() => {
    return () => {
      if (worldRef.current) {
        destroyDiveWorld(worldRef.current);
        worldRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const ambient = createAmbient();
    ambientRef.current = ambient;
    ambient.start().catch((err) => {
      console.warn("[audio] ambient start deferred:", err);
    });
    return () => {
      ambient.stop();
      ambientRef.current = null;
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
          anomalies: anomaliesRef.current,
          creatures: creaturesRef.current,
          particles: particlesRef.current,
          pirates: piratesRef.current,
          player: playerRef.current,
          predators: predatorsRef.current,
          depthTravelMeters: depthTravelMetersRef.current,
        },
        timeLeft,
        durationSeconds,
      ),
    );
  }, [durationSeconds, timeLeft]);

  // Mirror telemetry + timeLeft into refs so writeSnapshot stays referentially
  // stable across ticks.
  const telemetryRef = useRef(telemetry);
  const timeLeftRef = useRef(timeLeft);
  telemetryRef.current = telemetry;
  timeLeftRef.current = timeLeft;

  const writeSnapshot = useCallback(() => {
    writeDeepSeaSnapshot({
      lastCollectTime: lastCollectTimeRef.current,
      mode,
      multiplier: multiplierRef.current,
      scene: cloneSceneState({
        anomalies: anomaliesRef.current,
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
    });
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
            Math.floor(durationSeconds - effectiveTotalTime + timeModifierRef.current),
          ),
        );
      let newTimeLeft = getAdjustedTimeLeft();
      const getCurrentSummary = (timeLeftForSummary = newTimeLeft) =>
        getDiveRunSummary(
          {
            anomalies: anomaliesRef.current,
            creatures: creaturesRef.current,
            particles: particlesRef.current,
            pirates: piratesRef.current,
            player: playerRef.current,
            predators: predatorsRef.current,
            depthTravelMeters: depthTravelMetersRef.current,
          },
          scoreRef.current,
          timeLeftForSummary,
          durationSeconds,
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

      playerRef.current = result.scene.player;
      anomaliesRef.current = result.scene.anomalies;
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
          })),
        );
        collectionBurstsRef.current = collectionBurstsRef.current.filter(
          (burst) => effectiveTotalTime - burst.startedAt < 0.95,
        );
        multiplierRef.current = result.collection.multiplier;
        lastCollectTimeRef.current = result.collection.lastCollectTime;
        scoreRef.current += result.collection.scoreDelta;
        setMultiplier(result.collection.multiplier);
        setScore(scoreRef.current);

        if (result.collection.oxygenBonusSeconds > 0) {
          const cappedBonus = Math.min(
            result.collection.oxygenBonusSeconds,
            Math.max(0, durationSeconds - newTimeLeft),
          );

          if (cappedBonus > 0) {
            timeModifierRef.current += cappedBonus;
            newTimeLeft = getAdjustedTimeLeft();
            setTimeLeft(newTimeLeft);
            showOxygenPulse(cappedBonus, effectiveTotalTime);
          }
        }
      }
      if (isDiveComplete(result.scene, mode)) {
        setIsGameOver(true);
        void playSfx("dive-complete");
        onComplete(
          scoreRef.current,
          getDiveRunSummary(result.scene, scoreRef.current, newTimeLeft, durationSeconds),
        );
        return;
      }

      setTelemetry((current) => {
        if (!shouldUpdateTelemetry(current, result.telemetry)) return current;
        return result.telemetry;
      });

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
    ],
  );

  useGameLoop(gameLoop, !isGameOver);
  const threatAlert = telemetry.nearestThreatDistance < 180;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden touch-none"
    >
      <canvas
        aria-label="Bioluminescent Sea playfield"
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block h-full w-full"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
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
            className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-md border border-glow bg-deep/85 px-4 py-2 font-body text-sm font-semibold uppercase tracking-[0.1em] text-glow shadow-[0_0_18px_rgba(107,230,193,0.35)]"
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
            className="pointer-events-none absolute left-1/2 top-36 z-20 -translate-x-1/2 rounded-md border border-warn bg-[rgba(80,18,18,0.85)] px-4 py-2 font-body text-sm font-semibold uppercase tracking-[0.1em] text-warn shadow-[0_0_18px_rgba(255,107,107,0.35)]"
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
      <div
        className="pointer-events-none absolute left-4 right-4 z-10 flex justify-center"
        style={{ bottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        <div
          data-testid="objective-banner"
          className="max-w-[60ch] rounded-full border border-glow/25 bg-abyss/75 px-5 py-2.5 text-center font-body text-sm font-medium text-fg shadow-[0_4px_18px_rgba(5,10,20,0.45)] backdrop-blur-md"
        >
          {telemetry.objective}
        </div>
      </div>
    </div>
  );
}
