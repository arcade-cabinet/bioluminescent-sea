import { chunkLifecycleDelta, chunksInWindow } from "@/sim/chunk";
import { advanceScene } from "@/sim/dive/advance";
import { resolveDiveThreatImpact } from "@/sim/dive/impact";
import type {
  DiveInput,
  SceneAdvanceResult,
  SceneState,
  ViewportDimensions,
} from "@/sim/dive/types";
import {
  spawnAnomaliesForChunk,
  spawnCreaturesForChunk,
  spawnPiratesForChunk,
  spawnPredatorsForChunk,
} from "@/sim/entities/chunked-spawn";
import { getModeSlots } from "@/sim/dive/modeSlots";
import { normalizeSessionMode } from "@/sim/_shared/sessionMode";
import { DiveRoot } from "./traits";
import {
  appendAnomaliesToWorld,
  appendCreaturesToWorld,
  appendPiratesToWorld,
  appendPredatorsToWorld,
  readSceneFromWorld,
  retireChunkAnomalies,
  retireChunkCreatures,
  retireChunkPirates,
  retireChunkPredators,
  writeSceneToWorld,
  type DiveWorld,
} from "./world";

/**
 * Approximation for the camera's vertical world-meter window used
 * by the chunk lifecycle. The render-side camera knows the exact
 * viewport-height/pxPerMeter; the sim just needs a reasonable
 * look-ahead so chunks spawn slightly before they're visible.
 * 400m = two default-sized chunks.
 */
const CHUNK_LIFECYCLE_WINDOW_METERS = 400;

/**
 * Actions — the only way outside code mutates the ECS world.
 *
 * The React UI never writes traits directly; it dispatches through
 * these action functions. The sim stays pure — actions are the
 * thin layer that reads from traits, delegates to `src/sim/*`, and
 * writes the result back.
 *
 * In PR E + F these actions will own more of the dive lifecycle
 * (chunk generation, biome transitions). For PR D they wrap the
 * existing sim step so downstream layers can migrate to the ECS
 * interface without behavior drift.
 */

export interface AdvanceDiveFrameInput {
  world: DiveWorld;
  input: DiveInput;
  dimensions: ViewportDimensions;
  deltaTime: number;
  totalTime: number;
  timeLeft: number;
  mode: string;
  lastCollectTime: number;
  multiplier: number;
}

export interface AdvanceDiveFrameOutput {
  world: DiveWorld;
  result: SceneAdvanceResult;
}

export function advanceDiveFrame(args: AdvanceDiveFrameInput): AdvanceDiveFrameOutput {
  const scene: SceneState = readSceneFromWorld(args.world);
  const result = advanceScene(
    scene,
    args.input,
    args.dimensions,
    args.totalTime,
    args.deltaTime,
    args.lastCollectTime,
    args.multiplier,
    args.timeLeft,
    args.mode
  );

  let nextWorld = writeSceneToWorld(args.world, result.scene);

  // Chunk lifecycle: as the sub descends (or scrolls), chunks
  // enter and leave the camera window. Spawn creatures for new
  // chunks, retire creatures from departed chunks. This is the
  // runtime consumer of the F.4f helper — the biome transitions
  // actually happen during play now, not just in the sim's
  // bookkeeping.
  const currentWindow = chunksInWindow({
    depthTravelMeters: result.scene.depthTravelMeters,
    viewportHeightMeters: CHUNK_LIFECYCLE_WINDOW_METERS,
    masterSeed: args.world.masterSeed,
  });
  const delta = chunkLifecycleDelta(args.world.liveChunkIndices, currentWindow);

  // The mode's slots drive what spawns on each new chunk. In particular
  // `threatPattern` chooses scattered vs swarm vs bullet-hell, and
  // `respawnThreats` gates whether threats appear after the opening
  // scene at all (exploration leaves the world static).
  const slots = getModeSlots(normalizeSessionMode(args.mode));
  const viewportOnly = {
    width: args.dimensions.width,
    height: args.dimensions.height,
  };

  if (delta.spawned.length > 0) {
    const newCreatures = delta.spawned.flatMap((chunk) =>
      spawnCreaturesForChunk(chunk, viewportOnly),
    );
    nextWorld = appendCreaturesToWorld(nextWorld, newCreatures);

    if (slots.respawnThreats) {
      const newPredators = delta.spawned.flatMap((chunk) =>
        spawnPredatorsForChunk(chunk, viewportOnly, slots.threatPattern),
      );
      const newPirates = delta.spawned.flatMap((chunk) =>
        spawnPiratesForChunk(chunk, viewportOnly),
      );
      const newAnomalies = delta.spawned.flatMap((chunk) =>
        spawnAnomaliesForChunk(chunk, viewportOnly),
      );
      nextWorld = appendPredatorsToWorld(nextWorld, newPredators);
      nextWorld = appendPiratesToWorld(nextWorld, newPirates);
      nextWorld = appendAnomaliesToWorld(nextWorld, newAnomalies);
    }
  }

  if (delta.retiredIndices.length > 0) {
    nextWorld = retireChunkCreatures(nextWorld, delta.retiredIndices);
    nextWorld = retireChunkPredators(nextWorld, delta.retiredIndices);
    nextWorld = retireChunkPirates(nextWorld, delta.retiredIndices);
    nextWorld = retireChunkAnomalies(nextWorld, delta.retiredIndices);
  }
  nextWorld = {
    ...nextWorld,
    liveChunkIndices: new Set(currentWindow.map((c) => c.index)),
  };

  nextWorld.rootEntity.set(DiveRoot, {
    totalTime: args.totalTime,
    threatFlashAlpha:
      nextWorld.rootEntity.get(DiveRoot)?.threatFlashAlpha ?? 0,
    depthTravelMeters: result.scene.depthTravelMeters,
  });

  return { world: nextWorld, result };
}

export function recordThreatFlash(world: DiveWorld): void {
  const current = world.rootEntity.get(DiveRoot);
  if (!current) return;
  world.rootEntity.set(DiveRoot, { ...current, threatFlashAlpha: 1 });
}

export function decayThreatFlash(world: DiveWorld, deltaTime: number): void {
  const current = world.rootEntity.get(DiveRoot);
  if (!current) return;
  world.rootEntity.set(DiveRoot, {
    ...current,
    threatFlashAlpha: Math.max(0, current.threatFlashAlpha - deltaTime * 3),
  });
}

export { resolveDiveThreatImpact };
