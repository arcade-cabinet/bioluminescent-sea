import { chunksInWindow } from "@/sim/chunk";
import { spawnCreaturesForChunks } from "@/sim/entities/chunked-spawn";
import {
  spawnSeededParticles,
  spawnSeededPirates,
  spawnSeededPlayer,
  spawnSeededPredators,
} from "@/sim/entities/seeded-spawn";
import { createRng, hashSeed } from "@/sim/rng";
import type { SceneState, ViewportDimensions } from "./types";

/**
 * Chunk-driven scene factory — PR F.3 production path.
 *
 * Unlike `createSeededScene`, which spawns a fixed 18 creatures in a
 * single viewport, this factory takes an initial depth and spawns
 * creatures from every chunk in the camera's look-ahead window. The
 * sim still advances the same sceneState shape so
 * advanceScene/telemetry work unchanged; the runtime difference is
 * that creatures are now distributed across the full trench depth.
 *
 * Not yet used by the production Game — that migration requires the
 * renderer to project worldYMeters through a scrolling camera. This
 * factory is the target shape; Game.tsx can switch over when camera-
 * scroll lands.
 *
 * Predators, pirates, and particles still use the viewport-centric
 * seeded spawners for now. They'll move to chunks in a follow-up.
 */
export function createChunkedScene(
  seed: number,
  viewport: ViewportDimensions,
  initialDepthTravelMeters = 0,
): SceneState {
  const predatorRng = createRng(hashSeed(seed, 0x1002));
  const pirateRng = createRng(hashSeed(seed, 0x1003));
  const particleRng = createRng(hashSeed(seed, 0x1004));

  // Creature spawning: pull chunks in the lookahead window around the
  // initial camera position, then flat-map per-chunk spawns.
  //
  // viewportHeightMeters is a proxy — the viewport is in pixels, but
  // we model the camera's vertical field-of-view as ~400m (two chunks)
  // for initial spawning. The renderer will refine this when it gains
  // real camera-scroll.
  const VIEWPORT_HEIGHT_METERS = 400;
  const chunks = chunksInWindow({
    depthTravelMeters: initialDepthTravelMeters,
    viewportHeightMeters: VIEWPORT_HEIGHT_METERS,
    masterSeed: hashSeed(seed, 0x1001),
  });
  const creatures = spawnCreaturesForChunks(chunks, viewport);

  return {
    creatures,
    particles: spawnSeededParticles(particleRng, viewport),
    pirates: spawnSeededPirates(pirateRng, viewport),
    player: spawnSeededPlayer(viewport),
    predators: spawnSeededPredators(predatorRng, viewport),
    depthTravelMeters: initialDepthTravelMeters,
  };
}
