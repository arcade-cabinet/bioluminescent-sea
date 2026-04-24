import {
  advanceCreature,
  advanceParticle,
  advancePlayer,
  createInitialPlayer,
} from "@/sim/entities";
import { collectCreatures, hasPredatorCollision } from "./collection";
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

  const player = advancePlayer(scene.player, input, dimensions, totalTime, deltaTime);
  
  aiManager.updatePlayer(player);
  aiManager.syncPredators(scene.predators);
  aiManager.syncPirates(scene.pirates);
  aiManager.syncCreatures(scene.creatures);
  aiManager.update(deltaTime);

  const creatures = scene.creatures.map((creature) => {
    // Basic perlin drift and pulsing
    const base = advanceCreature(creature, dimensions, totalTime, deltaTime);
    // Overlay AI flocking (updates x, y only)
    const flocking = aiManager!.readCreature(base);
    // Keep it in bounds visually using wrap, though the steering behavior also wraps it
    return { ...base, x: flocking.x, y: flocking.y };
  });
  
  const predators = scene.predators.map((p) => {
    const updated = aiManager!.readPredator(p);
    return { ...updated, y: Math.max(0, Math.min(updated.y, dimensions.height)) };
  });
  
  const pirates = scene.pirates.map((p) => {
    const updated = aiManager!.readPirate(p);
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

  const passiveDescent = deltaTime * DESCENT_SPEED_METERS_PER_SECOND;
  const targetDepthOffset = tuning.freeVerticalMovement ? Math.max(0, player.targetY - player.y) * 0.05 : passiveDescent;

  const nextDepthTravelMeters = tuning.completionCondition === "infinite" 
    ? scene.depthTravelMeters + targetDepthOffset
    : Math.min(tuning.targetDepthMeters ?? TRENCH_FLOOR_METERS, scene.depthTravelMeters + targetDepthOffset);

  const nextScene: SceneState = {
    creatures: collection.creatures,
    particles,
    pirates,
    player,
    predators,
    depthTravelMeters: nextDepthTravelMeters,
  };

  return {
    collection,
    collidedWithPredator: hasPredatorCollision(player, predators, tuning.threatRadiusScale),
    scene: nextScene,
    telemetry: getDiveTelemetry(nextScene, timeLeft, tuning.durationSeconds),
  };
}
