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
import { useDevFastDive } from "@/hooks/useDevFastDive";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useResolvedInput } from "@/hooks/useResolvedInput";
import type { PlayerInputProvider, PlayerSubObservation } from "@/sim/ai";
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
import { CompactPrimary } from "@/ui/hud/CompactPrimary";
import { HUD } from "@/ui/hud/HUD";
import { HudShell } from "@/ui/hud/HudShell";
import { ObjectivePanel } from "@/ui/hud/ObjectivePanel";
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
  /**
   * Test seam: a `PlayerInputProvider` (typically a `GoapInputProvider`)
   * that replaces touch input. When present, the dive loop ticks the
   * provider every animation frame instead of reading pointer events.
   * Production callers leave this undefined and get touch input.
   */
  inputProvider?: PlayerInputProvider;
}

export function DiveScreen({
  initialSnapshot,
  mode,
  seed,
  upgrades,
  onComplete,
  onGameOver,
  inputProvider,
}: DiveScreenProps) {
  const durationSeconds = getDiveDurationSeconds(mode, seed, upgrades);
  const fastDiveScale = useDevFastDive();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initialDimensionsRef = useRef(getInitialDiveDimensions());
  const initialSceneRef = useRef<SceneState | null>(null);
  if (!initialSceneRef.current) {
    initialSceneRef.current = initialSnapshot
      ? cloneSceneState(initialSnapshot.scene)
      : createInitialScene(initialDimensionsRef.current, upgrades, mode);
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
  const [objectiveQueueState, setObjectiveQueueState] = useState(
    () => initialSnapshot?.scene.objectiveQueue ?? initialScene.objectiveQueue,
  );

  // Lazy one-shot world creation: useRef evaluates its arg on every render,
  // which exhausts Koota's 16-world ceiling under StrictMode + HMR. Guarding
  // with a ref sentinel means the world is constructed exactly once per
  // mounted component, destroyed in the cleanup.
  const worldRef = useRef<DiveWorld | null>(null);
  if (worldRef.current === null) {
    worldRef.current = createDiveWorld(initialScene, seed, mode);
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
  const objectiveQueueRef = useRef(
    initialSnapshot?.scene.objectiveQueue ?? initialScene.objectiveQueue,
  );

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

  // Build an observation source the GOAP brain can read each frame.
  // The same per-frame snapshot the dive loop builds — keeps the bot's
  // view of the world consistent with the sim's.
  const observationRef = useRef<PlayerSubObservation>({
    scene: initialScene,
    dimensions,
    totalTime: 0,
    deltaTime: 1 / 60,
    timeLeft,
  });
  const getObservation = useRef(() => observationRef.current).current;
  const input = useResolvedInput(
    containerRef,
    inputProvider,
    inputProvider ? getObservation : undefined,
  );

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
          objectiveQueue: objectiveQueueRef.current,
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
        objectiveQueue: objectiveQueueRef.current,
      }),
      score: scoreRef.current,
      seed,
      telemetry: telemetryRef.current,
      timeLeft: timeLeftRef.current,
    });
  }, [mode, seed]);

  // Track every setTimeout we schedule so unmount can cancel them
  // (otherwise the dismiss callback fires after the component is gone
  // and React warns about state updates on unmounted components).
  const pulseTimeoutsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const timeouts = pulseTimeoutsRef.current;
    return () => {
      for (const id of timeouts) window.clearTimeout(id);
      timeouts.clear();
    };
  }, []);

  const showOxygenPulse = useCallback((bonusSeconds: number, totalTime: number) => {
    const id = `oxygen-${Math.round(totalTime * 1000)}`;
    setOxygenPulse({ bonusSeconds, id });
    const handle = window.setTimeout(() => {
      pulseTimeoutsRef.current.delete(handle);
      setOxygenPulse((current) => (current?.id === id ? null : current));
    }, 1_200);
    pulseTimeoutsRef.current.add(handle);
  }, []);

  const showImpactPulse = useCallback((penaltySeconds: number, totalTime: number) => {
    const id = `impact-${Math.round(totalTime * 1000)}`;
    setImpactPulse({ id, penaltySeconds });
    const handle = window.setTimeout(() => {
      pulseTimeoutsRef.current.delete(handle);
      setImpactPulse((current) => (current?.id === id ? null : current));
    }, 1_300);
    pulseTimeoutsRef.current.add(handle);
  }, []);

  // Track game-over in a ref so the unmount cleanup can read the
  // *current* value rather than the value captured when the effect
  // last ran. Without this, the cleanup runs after onGameOver has
  // cleared the snapshot, sees isGameOver=false (its captured value),
  // and writes the dead state back — locking the next dive into an
  // instant game-over loop.
  const isGameOverRef = useRef(isGameOver);
  isGameOverRef.current = isGameOver;

  useEffect(() => {
    if (isGameOver) return undefined;

    const initial = window.setTimeout(writeSnapshot, 400);
    const interval = window.setInterval(writeSnapshot, 2_500);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      // Never re-write a dead snapshot on unmount — the parent has
      // already called clearDeepSeaSnapshot() in its terminal callback.
      if (!isGameOverRef.current) {
        writeSnapshot();
      }
    };
  }, [isGameOver, writeSnapshot]);

  const gameLoop = useCallback(
    (deltaTime: number, totalTime: number) => {
      if (isGameOver) return;

      const effectiveTotalTime = elapsedOffsetRef.current + totalTime;
      // ?devFastDive=N scales how fast the oxygen budget burns. Production
      // is always 1; the Playwright oxygen-depletion spec passes ?devFastDive=80
      // so a 600s budget collapses in seconds. Entity sim continues at real
      // time — only the oxygen countdown is sped up.
      const oxygenElapsed = effectiveTotalTime * fastDiveScale;
      const getAdjustedTimeLeft = () =>
        Math.max(
          0,
          Math.min(
            durationSeconds,
            Math.floor(durationSeconds - oxygenElapsed + timeModifierRef.current),
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
            objectiveQueue: objectiveQueueRef.current,
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

      // Refresh the bot's observation after each sim step. The
      // useResolvedInput RAF reads `observationRef.current` to compute
      // the next DiveInput; keeping the snapshot here in lockstep with
      // the sim's scene means the bot sees what the sim just produced.
      if (inputProvider) {
        observationRef.current = {
          scene: result.scene,
          dimensions,
          totalTime: effectiveTotalTime,
          deltaTime,
          timeLeft: newTimeLeft,
        };
      }
      piratesRef.current = result.scene.pirates;
      particlesRef.current = result.scene.particles;
      depthTravelMetersRef.current = result.scene.depthTravelMeters;
      // Sync the panel state only when progress semantically changed.
      // The engine rebuilds the queue array every frame so reference
      // equality would re-render every tick; compare current + completed
      // per entry instead. This keeps the HUD panel idle during steady
      // gameplay and re-renders only when an objective ticks.
      const prevQ = objectiveQueueRef.current;
      const nextQ = result.scene.objectiveQueue;
      let queueChanged = prevQ.length !== nextQ.length;
      if (!queueChanged) {
        for (let i = 0; i < prevQ.length; i += 1) {
          if (
            prevQ[i].current !== nextQ[i].current ||
            prevQ[i].completed !== nextQ[i].completed
          ) {
            queueChanged = true;
            break;
          }
        }
      }
      objectiveQueueRef.current = nextQ;
      if (queueChanged) setObjectiveQueueState(nextQ);

      // Expire stale collection bursts every frame, regardless of whether
      // a new pickup happened. Otherwise the last burst lingers
      // indefinitely if the player goes a long stretch without
      // collecting — the renderer keeps drawing it past its 0.85s window.
      if (collectionBurstsRef.current.length > 0) {
        collectionBurstsRef.current = collectionBurstsRef.current.filter(
          (burst) => effectiveTotalTime - burst.startedAt < 0.95,
        );
      }

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
        multiplierRef.current = result.collection.multiplier;
        lastCollectTimeRef.current = result.collection.lastCollectTime;
        scoreRef.current += result.collection.scoreDelta;
        setMultiplier(result.collection.multiplier);
        setScore(scoreRef.current);

        // Combined bonus = creature collection (multiplier-aware,
        // tuning-scaled) + breath anomaly pickups (raw +30s each).
        const totalBonus =
          result.collection.oxygenBonusSeconds + result.oxygenBonusSeconds;
        if (totalBonus > 0) {
          const cappedBonus = Math.min(
            totalBonus,
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
      if (isDiveComplete(result.scene, mode, seed)) {
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
          seed,
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
      seed,
      showOxygenPulse,
      showImpactPulse,
      inputProvider,
      fastDiveScale,
    ],
  );

  useGameLoop(gameLoop, !isGameOver);
  // Threat alert was firing whenever nearest threat was within 180px,
  // which kept the warm-red wash on screen permanently with the new
  // predator AI (predators patrol 380px around the player). Tighter
  // threshold: only flag a "real" alert when something is truly
  // closing — within 90px — and the radial wash at the canvas level
  // gets dropped entirely (the HUD's threatFlash motion overlay
  // covers actual collisions; we don't need a second always-on
  // vignette).
  const threatAlert = telemetry.nearestThreatDistance < 90;
  // Low-oxygen warning vignette: below 25% oxygen the viewport breathes
  // a warn-red halo, strength climbing as oxygen falls further. Purely
  // a visual beat — the sim's oxygen logic is unaffected.
  const oxygenWarnStrength = telemetry.oxygenRatio < 0.25
    ? Math.min(1, (0.25 - telemetry.oxygenRatio) / 0.2)
    : 0;
  const oxygenPulsePhase =
    oxygenWarnStrength > 0 ? 0.55 + 0.45 * Math.sin(Date.now() / 420) : 0;

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
      {/* Soft mint vignette around the canvas — always on. The
       *   warm-red threat overlay is now handled exclusively by the
       *   HUD's `threatAlert` motion-div on actual close-contact
       *   (<90px). The previous double-overlay was painting the
       *   whole screen red whenever any predator was within 180px,
       *   which became "always" with the new AI's 380px patrol
       *   radius. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          background:
            "radial-gradient(circle at 50% 52%, transparent 62%, rgba(107, 230, 193, 0.07) 100%)",
          opacity: 0.72,
        }}
      />
      {oxygenWarnStrength > 0 && (
        <div
          aria-hidden="true"
          data-testid="oxygen-warn-vignette"
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at 50% 52%, transparent ${
              62 - oxygenWarnStrength * 18
            }%, rgba(255, 107, 107, ${
              0.15 + oxygenWarnStrength * 0.35 * oxygenPulsePhase
            }) 100%)`,
            opacity: 0.6 + oxygenWarnStrength * 0.4,
          }}
        />
      )}
      <AnimatePresence>
        {/* Oxygen + impact pulses — text-on-water beats, no chip
         *   pills. The brand identity rule: any HUD floats in the
         *   trench, no rectangular badge ever. */}
        {oxygenPulse && (
          <motion.div
            key={oxygenPulse.id}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="bs-label pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 text-glow"
            style={{
              fontSize: "0.85rem",
              filter: "url(#bs-soft-glow)",
              textShadow:
                "0 0 16px rgba(107,230,193,0.6), 0 0 30px rgba(107,230,193,0.3), 0 0 6px rgba(2,6,17,0.95)",
            }}
          >
            Oxygen +{oxygenPulse.bonusSeconds}s
          </motion.div>
        )}
        {impactPulse && (
          <motion.div
            key={impactPulse.id}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="bs-label pointer-events-none absolute left-1/2 top-32 z-20 -translate-x-1/2 text-warn"
            style={{
              fontSize: "0.95rem",
              filter: "url(#bs-warm-glow)",
              textShadow:
                "0 0 18px rgba(255,107,107,0.65), 0 0 32px rgba(255,107,107,0.3), 0 0 6px rgba(2,6,17,0.95)",
            }}
          >
            Hull Shock −{impactPulse.penaltySeconds}s
          </motion.div>
        )}
      </AnimatePresence>
      <HudShell
        threatAlert={threatAlert}
        objectivePanel={<ObjectivePanel queue={objectiveQueueState} />}
        compactPrimary={
          <CompactPrimary
            score={score}
            timeLeft={timeLeft}
            multiplier={multiplier}
            oxygenRatio={telemetry.oxygenRatio}
          />
        }
        fullHud={
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
        }
      />
      <div
        className="pointer-events-none absolute left-4 right-4 z-10 flex justify-center"
        style={{ bottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
      >
        {/* Objective banner — type-on-water like every other HUD
         *   readout. The previous bordered pill broke the identity
         *   contract (no boxy chips on the dive playfield). */}
        <div
          data-testid="objective-banner"
          className="max-w-[64ch] text-center italic text-fg"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 300,
            fontSize: "1rem",
            filter: "url(#bs-soft-glow)",
            textShadow:
              "0 0 14px rgba(2,6,17,0.95), 0 0 28px rgba(2,6,17,0.6), 0 1px 0 rgba(2,6,17,0.5)",
          }}
        >
          {telemetry.objective}
        </div>
      </div>
    </div>
  );
}
