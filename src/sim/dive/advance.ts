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
import { DESCENT_SPEED_METERS_PER_SECOND, GAME_DURATION, TRENCH_FLOOR_METERS } from "./constants";
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
    depthTravelMeters: 0,
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
  // Passive descent: the sub sinks through the column at a fixed rate.
  // Clamped at the trench floor so `depthTravelMeters` can't overshoot
  // the content window when a dive runs long on bonus oxygen.
  const nextDepthTravelMeters = Math.min(
    TRENCH_FLOOR_METERS,
    scene.depthTravelMeters + deltaTime * DESCENT_SPEED_METERS_PER_SECOND
  );

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
