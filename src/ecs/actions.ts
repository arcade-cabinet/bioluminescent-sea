import {
  chunkLifecycleDelta,
  chunksInWindow,
  pickChunkArchetype,
  resolveRegionForChunk,
} from "@/sim/factories/chunk";
import {
  spawnAnomaliesForChunk,
  spawnCreaturesForChunk,
  spawnPiratesForChunk,
  spawnPredatorsForChunk,
} from "@/sim/factories/chunk/spawn";
import { getDefaultDiveArchetype } from "@/sim/factories/dive";
import { advanceScene } from "@/sim/engine/advance";
import { resolveDiveThreatImpact } from "@/sim/engine/impact";
import type {
  DiveInput,
  SceneAdvanceResult,
  SceneState,
  ViewportDimensions,
} from "@/sim/dive/types";
import { getModeSlots } from "@/sim/factories/dive/slots";
import { normalizeSessionMode } from "@/sim/_shared/sessionMode";
import { playBandMaxX, playBandMinX } from "@/sim/_shared/playBand";
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

  // Resolve each new chunk to its ChunkArchetype via the factory
  // pyramid: dive archetype → region sequence → per-chunk region
  // lookup → region's chunk pool → weighted archetype pick. The chunk
  // archetype's ChunkSlots drive what spawns; the dive-level ModeSlots
  // (`respawnThreats`) gates whether threats appear at all.
  const mode = normalizeSessionMode(args.mode);
  const modeSlots = getModeSlots(mode);
  const diveArchetype = getDefaultDiveArchetype(mode);
  const viewportOnly = {
    width: args.dimensions.width,
    height: args.dimensions.height,
  };

  if (delta.spawned.length > 0) {
    const chunkArchetypes = delta.spawned.map((chunk) => {
      const region = resolveRegionForChunk(chunk, diveArchetype.regionSequence);
      return { chunk, archetype: pickChunkArchetype(chunk, region.slots) };
    });

    const newCreatures = chunkArchetypes.flatMap(({ chunk, archetype }) => {
      const baseSpawn = spawnCreaturesForChunk(chunk, viewportOnly);
      // Chunk-level creatureDensity scales the count up or down; a
      // density of 0 suppresses entirely (used by arena rooms).
      const keep = Math.round(baseSpawn.length * archetype.slots.creatureDensity);
      return baseSpawn.slice(0, Math.max(0, keep));
    });
    nextWorld = appendCreaturesToWorld(nextWorld, newCreatures);

    if (modeSlots.respawnThreats) {
      const newPredators = chunkArchetypes.flatMap(({ chunk, archetype }) => {
        if (archetype.slots.predatorDensity === 0) return [];
        const baseSpawn = spawnPredatorsForChunk(
          chunk,
          viewportOnly,
          archetype.slots.threatPattern,
        );
        const keep = Math.round(baseSpawn.length * archetype.slots.predatorDensity);
        return baseSpawn.slice(0, Math.max(0, keep));
      });
      const newPirates = chunkArchetypes.flatMap(({ chunk, archetype }) =>
        archetype.slots.piratesAllowed ? spawnPiratesForChunk(chunk, viewportOnly) : [],
      );
      const newAnomalies = chunkArchetypes.flatMap(({ chunk, archetype }) =>
        archetype.slots.anomaliesAllowed ? spawnAnomaliesForChunk(chunk, viewportOnly) : [],
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

  // Resolve the *active* chunk's archetype so the render bridge can
  // pick follow-cam vs clamp-to-chunk. The active chunk is the one
  // containing the player's current depth. currentWindow is empty only
  // in the first frame before chunksInWindow seeds anything — in that
  // case keep the default open-cam.
  const activeChunk = currentWindow.length
    ? (currentWindow.find(
        (c) => c.yTopMeters <= result.scene.depthTravelMeters &&
               c.yBottomMeters > result.scene.depthTravelMeters,
      ) ?? currentWindow[0])
    : undefined;
  let cameraTravel: "open" | "locked-room" | "corridor" = "open";
  let activeChunkBoundsLeftPx = 0;
  let activeChunkBoundsRightPx = 0;
  let activeChunkArchetypeSlots: { travel: "open" | "locked-room" | "corridor" } | null = null;
  if (activeChunk) {
    const region = resolveRegionForChunk(activeChunk, diveArchetype.regionSequence);
    const archetype = pickChunkArchetype(activeChunk, region.slots);
    cameraTravel = archetype.slots.travel;
    activeChunkArchetypeSlots = archetype.slots;
    activeChunkBoundsLeftPx = playBandMinX(args.dimensions.width);
    activeChunkBoundsRightPx = playBandMaxX(args.dimensions.width);
  }

  // Chunks-cleared tally. A locked-room chunk is "cleared" the first
  // frame its threats hit zero. Compare against the previous-frame
  // count so the counter only ticks up on the transition.
  const prevRoot = nextWorld.rootEntity.get(DiveRoot);
  let chunksClearedCount = prevRoot?.chunksClearedCount ?? 0;
  if (
    activeChunk &&
    activeChunkArchetypeSlots?.travel === "locked-room"
  ) {
    const chunkSuffix = `-c${activeChunk.index}`;
    const livePredators = result.scene.predators.filter(
      (p) => p.id.endsWith(chunkSuffix) || p.id.includes(`${chunkSuffix}-`),
    ).length;
    const livePirates = result.scene.pirates.filter(
      (p) => p.id.endsWith(chunkSuffix) || p.id.includes(`${chunkSuffix}-`),
    ).length;
    if (livePredators + livePirates === 0) {
      // Only increment once per chunk — dedupe via a per-chunk
      // sentinel in the JSON state. We store the latest cleared
      // chunk index; if it matches, don't re-tick.
      const clearedKey = `cleared:${activeChunk.index}`;
      const json = prevRoot?.objectiveQueueJson ?? "[]";
      if (!json.includes(clearedKey)) {
        chunksClearedCount += 1;
      }
    }
  }

  // Re-advance objectives with the real chunksClearedCount. The engine
  // also ran the pass but passed 0; we correct it here with the
  // lifetime count so clear-regions objectives progress.
  const queueWithClearTally = result.scene.objectiveQueue.map((entry) => {
    if (entry.completed) return entry;
    if (entry.objective.kind !== "clear-regions") return entry;
    const next = Math.min(entry.objective.target, chunksClearedCount);
    return {
      objective: entry.objective,
      current: next,
      completed: next >= entry.objective.target,
    };
  });

  nextWorld.rootEntity.set(DiveRoot, {
    totalTime: args.totalTime,
    threatFlashAlpha:
      nextWorld.rootEntity.get(DiveRoot)?.threatFlashAlpha ?? 0,
    depthTravelMeters: result.scene.depthTravelMeters,
    cameraTravel,
    activeChunkBoundsLeftPx,
    activeChunkBoundsRightPx,
    objectiveQueueJson: JSON.stringify(queueWithClearTally),
    chunksClearedCount,
  });

  return {
    world: nextWorld,
    result: { ...result, scene: { ...result.scene, objectiveQueue: queueWithClearTally } },
  };
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
