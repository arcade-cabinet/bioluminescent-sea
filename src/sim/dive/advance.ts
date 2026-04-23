import {
  advanceCreature,
  advanceParticle,
  advancePirate,
  advancePlayer,
  advancePredator,
  createInitialCreatures,
  createInitialParticles,
  createInitialPirates,
  createInitialPlayer,
  createInitialPredators,
} from "@/sim/entities";
import { collectCreatures, hasPredatorCollision } from "./collection";
import { GAME_DURATION } from "./constants";
import { getDiveModeTuning } from "./mode";
import { getDiveTelemetry } from "./telemetry";
import type {
  DiveInput,
  SceneAdvanceResult,
  SceneState,
  ViewportDimensions,
} from "./types";

export function createInitialScene(dimensions: ViewportDimensions): SceneState {
  return {
    creatures: createInitialCreatures(dimensions),
    particles: createInitialParticles(dimensions),
    pirates: createInitialPirates(dimensions),
    player: createInitialPlayer(dimensions),
    predators: createInitialPredators(dimensions),
  };
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
  const player = advancePlayer(scene.player, input, dimensions, totalTime, deltaTime);
  const creatures = scene.creatures.map((creature) =>
    advanceCreature(creature, dimensions, totalTime, deltaTime)
  );
  const predators = scene.predators.map((predator) =>
    advancePredator(predator, player, dimensions, totalTime, deltaTime, tuning.predatorSpeedScale)
  );
  const pirates = scene.pirates.map((pirate) =>
    advancePirate(pirate, player, dimensions, totalTime, deltaTime, tuning.pirateSpeedScale)
  );
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
  const nextScene = {
    creatures: collection.creatures,
    particles,
    pirates,
    player,
    predators,
  };

  return {
    collection,
    collidedWithPredator: hasPredatorCollision(player, predators, tuning.threatRadiusScale),
    scene: nextScene,
    telemetry: getDiveTelemetry(nextScene, timeLeft, tuning.durationSeconds),
  };
}
