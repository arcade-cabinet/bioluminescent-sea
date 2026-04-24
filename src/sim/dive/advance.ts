import {
  advanceCreature,
  advanceParticle,
  advancePlayer,
  createInitialPlayer,
} from "@/sim/entities";
import { collectAnomalies, collectCreatures, hasPredatorCollision } from "./collection";
import { DESCENT_SPEED_METERS_PER_SECOND, GAME_DURATION, TRENCH_FLOOR_METERS } from "./constants";
import { getDiveModeTuning } from "./mode";
import { getDiveTelemetry } from "./telemetry";
import { AIManager } from "@/sim/ai/manager";
import type {
  DiveInput,
  SceneAdvanceResult,
  SceneState,
  ViewportDimensions,
} from "./types";

import type { SubUpgrades } from "@/sim/meta/upgrades";

export function createInitialScene(dimensions: ViewportDimensions, upgrades?: SubUpgrades): SceneState {
  const player = createInitialPlayer(dimensions);
  if (upgrades) {
    player.speedScale = 1 + (upgrades.motor * 0.15); // +15% per level
    player.lampScale = 1 + (upgrades.lamp * 0.20); // +20% per level
  }
  return {
    anomalies: [],
    creatures: [],
    particles: [],
    pirates: [],
    player,
    predators: [],
    depthTravelMeters: 0,
  };
}

let aiManager: AIManager | null = null;

export function resetAIManager() {
  aiManager = null;
}

export function advanceScene(
  scene: SceneState,
  input: DiveInput,
  dimensions: ViewportDimensions,
  totalTime: number,
  deltaTime: number,
  lastCollectTime: number,
  multiplier: number,
  timeLeft = GAME_DURATION,
  mode: string | null | undefined = "standard"
): SceneAdvanceResult {
  const tuning = getDiveModeTuning(mode);
  
  if (!aiManager) {
    aiManager = new AIManager(dimensions);
  }
  const ai = aiManager;

  const player = advancePlayer(scene.player, input, dimensions, totalTime, deltaTime);

  ai.updatePlayer(player);
  ai.syncPredators(scene.predators);
  ai.syncPirates(scene.pirates);
  ai.syncCreatures(scene.creatures);
  ai.update(deltaTime);

  const creatures = scene.creatures.map((creature) => {
    const base = advanceCreature(creature, dimensions, totalTime, deltaTime);
    const flocking = ai.readCreature(base);
    return { ...base, x: flocking.x, y: flocking.y };
  });

  const predators = scene.predators.map((p) => {
    const updated = ai.readPredator(p);
    return { ...updated, y: Math.max(0, Math.min(updated.y, dimensions.height)) };
  });

  const pirates = scene.pirates.map((p) => {
    const updated = ai.readPirate(p);
    return { ...updated, y: Math.max(50, Math.min(updated.y, dimensions.height - 50)), lanternPhase: p.lanternPhase + deltaTime * 5 };
  });
  
  const particles = scene.particles.map((particle) =>
    advanceParticle(particle, dimensions, totalTime, deltaTime)
  );
  const collection = collectCreatures(
    creatures,
    player,
    totalTime,
    lastCollectTime,
    multiplier,
    tuning.collectionOxygenScale
  );

  const anomalyCollection = collectAnomalies(scene.anomalies as import("@/sim/entities/types").Anomaly[], player);

  // Apply buffs
  let activeRepel = player.activeBuffs.repelUntil;
  let activeOverdrive = player.activeBuffs.overdriveUntil;
  
  for (const collected of anomalyCollection.collected) {
    if (collected.type === "repel") activeRepel = totalTime + 15; // 15 seconds
    if (collected.type === "overdrive") activeOverdrive = totalTime + 10; // 10 seconds
  }

  // Calculate speed multiplier from overdrive
  const isOverdrive = activeOverdrive > totalTime;
  if (isOverdrive) {
    player.speedScale = 2.5; 
  } else {
    player.speedScale = 1;
  }

  const isRepelActive = activeRepel > totalTime;

  const collidedWithPredator = !isRepelActive && hasPredatorCollision(player, predators, tuning.threatRadiusScale);
  const collidedWithPirate = !isRepelActive && hasPredatorCollision(player, pirates as unknown as import("@/sim/entities/types").Predator[], tuning.threatRadiusScale);

  const isCollision = collidedWithPredator || collidedWithPirate;
  
  const passiveDescent = deltaTime * DESCENT_SPEED_METERS_PER_SECOND * (isOverdrive ? 1.5 : 1);
  const targetDepthOffset = tuning.freeVerticalMovement ? Math.max(0, player.targetY - player.y) * 0.05 : passiveDescent;

  const nextDepthTravelMeters = tuning.completionCondition === "infinite" 
    ? scene.depthTravelMeters + targetDepthOffset
    : Math.min(tuning.targetDepthMeters ?? TRENCH_FLOOR_METERS, scene.depthTravelMeters + targetDepthOffset);

  const nextPlayer = { 
    ...player, 
    activeBuffs: { repelUntil: activeRepel, overdriveUntil: activeOverdrive } 
  };

  const nextScene: SceneState = {
    anomalies: anomalyCollection.anomalies.map(a => ({ ...a, pulsePhase: a.pulsePhase + deltaTime * 3 })),
    creatures: collection.creatures,
    particles,
    pirates,
    player: nextPlayer,
    predators,
    depthTravelMeters: nextDepthTravelMeters,
  };

  return {
    collection,
    collidedWithPredator: isCollision,
    scene: nextScene,
    telemetry: getDiveTelemetry(nextScene, timeLeft, tuning.durationSeconds),
  };
}
