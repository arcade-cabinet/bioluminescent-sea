import {
  advanceCreature,
  advanceParticle,
  advancePlayer,
  createInitialPlayer,
} from "@/sim/entities";
import { CHUNK_HEIGHT_METERS } from "@/sim/factories/chunk";
import { createObjectiveQueue } from "@/sim/factories/dive";
import { normalizeSessionMode } from "@/sim/_shared/sessionMode";
import { biomeAtDepth } from "@/sim/factories/region/biomes";
import { advanceObjectiveQueue, tallyBeaconCharted } from "./objective";
import { collectAnomalies, collectCreatures, hasPredatorCollision } from "./collection";
import {
  DESCENT_SPEED_METERS_PER_SECOND,
  TRENCH_FLOOR_METERS,
} from "@/sim/dive/constants";
import { getDiveModeTuning } from "./mode";
import { getDiveTelemetry } from "./telemetry";
import { AIManager } from "@/sim/ai/manager";
import type {
  DiveInput,
  SceneAdvanceResult,
  SceneState,
  ViewportDimensions,
} from "@/sim/dive/types";

import type { SubUpgrades } from "@/sim/meta/upgrades";

export function createInitialScene(
  dimensions: ViewportDimensions,
  upgrades?: SubUpgrades,
  mode: string | null | undefined = "descent",
): SceneState {
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
    objectiveQueue: createObjectiveQueue(normalizeSessionMode(mode)),
    clearedChunks: [],
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
  timeLeft: number,
  mode: string | null | undefined,
  seed: number,
): SceneAdvanceResult {
  const tuning = getDiveModeTuning(mode, seed);
  
  if (!aiManager) {
    aiManager = new AIManager(dimensions, seed);
  }
  const ai = aiManager;

  const player = advancePlayer(
    scene.player,
    input,
    dimensions,
    totalTime,
    deltaTime,
    !tuning.freeLateralMovement,
  );

  ai.updatePlayer(player);
  ai.syncPredators(scene.predators);
  ai.syncPirates(scene.pirates);
  ai.syncCreatures(scene.creatures);
  ai.update(deltaTime);

  // Lure buff: collectibles within the lure radius drift toward the
  // player. Only acts on non-ambient creatures (scoring beacons) so
  // ambient atmosphere doesn't get sucked in. Strength scales with
  // distance — close beacons snap, far beacons gently nudge.
  const isLureActive = player.activeBuffs.lureUntil > totalTime;
  const lureRadius = 300;
  const lurePullPerSecond = 240; // px/s at the inside edge

  const creatures = scene.creatures.map((creature) => {
    const base = advanceCreature(creature, dimensions, totalTime, deltaTime);
    const flocking = ai.readCreature(base);
    let nx = flocking.x;
    let ny = flocking.y;
    if (isLureActive && !creature.ambient) {
      const dx = player.x - nx;
      const dy = player.y - ny;
      const dist = Math.hypot(dx, dy);
      if (dist > 1 && dist < lureRadius) {
        const strength = (1 - dist / lureRadius) * lurePullPerSecond * deltaTime;
        nx += (dx / dist) * strength;
        ny += (dy / dist) * strength;
      }
    }
    return { ...base, x: nx, y: ny };
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
  let activeLure = player.activeBuffs.lureUntil;
  let activeLampFlare = player.activeBuffs.lampFlareUntil;
  let breathBonus = 0;

  for (const collected of anomalyCollection.collected) {
    if (collected.type === "repel") activeRepel = totalTime + 15;
    if (collected.type === "overdrive") activeOverdrive = totalTime + 10;
    if (collected.type === "lure") activeLure = totalTime + 12;
    if (collected.type === "lamp-flare") activeLampFlare = totalTime + 14;
    if (collected.type === "breath") breathBonus += 30;
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
  // Free vertical movement: depth advances toward player input on
  // top of a baseline trickle. Without the baseline, an idle player
  // (no input) sits at 0m forever while predators stack and oxygen
  // burns. Descent's lateral lock just means the trickle is the
  // *only* descent source — input-driven descent stacks on top of it
  // in Exploration so the player can choose to dive faster.
  const inputDrivenDescent = tuning.freeVerticalMovement
    ? Math.max(0, player.targetY - player.y) * 0.05
    : 0;
  const baselineDescent = passiveDescent * 0.5;
  const targetDepthOffset = tuning.freeVerticalMovement
    ? inputDrivenDescent + baselineDescent
    : passiveDescent;

  // Encounter-pocket gating: in arena mode each chunk is a
  // locked-room travel slot (see factories/chunk/archetypes.ts). While
  // the pocket's threats are alive, cap descent at the chunk floor so
  // the player has to clear it before advancing. Once cleared, the cap
  // lifts and the player can swim into adjacent pockets.
  //
  // We detect arena-mode locked-rooms via the mode slot (Arena is the
  // only mode whose chunks use locked-room travel) so this stays a
  // one-line check — without needing to thread chunk-archetype
  // resolution into the engine. Per-chunk travel slots are still the
  // render-bridge's lateral-lock source; see render/bridge.ts.
  const currentChunkIndex = Math.floor(scene.depthTravelMeters / CHUNK_HEIGHT_METERS);
  const chunkSuffix = `-c${currentChunkIndex}`;
  const isThreatInCurrentChunk = (id: string): boolean => {
    if (id.endsWith(chunkSuffix)) return true; // leviathan, anomaly
    return id.includes(`${chunkSuffix}-`);
  };
  const livePredatorsInChunk =
    predators.filter((p) => isThreatInCurrentChunk(p.id)).length +
    pirates.filter((p) => isThreatInCurrentChunk(p.id)).length;
  // Arena's locked-room pockets: camera-lock lives on the chunk
  // archetype, engine-lock follows collisionEndsDive+respawnThreats as
  // a proxy for "this is arena" — only Arena combines both flags.
  const isPocketMode =
    tuning.collisionEndsDive && tuning.respawnThreats;
  const previouslyCleared = scene.clearedChunks ?? [];
  const chunkAlreadyCleared = previouslyCleared.includes(currentChunkIndex);
  // The pocket gate drops only if the chunk's still-live and not yet
  // marked cleared. Once cleared, respawning predators don't re-lock
  // the chunk — the player has bought permanent passage.
  const chunkLocked =
    isPocketMode && !chunkAlreadyCleared && livePredatorsInChunk > 0;
  const chunkFloorMeters = (currentChunkIndex + 1) * CHUNK_HEIGHT_METERS;
  // Promote the current chunk to "cleared" the first frame the player
  // is standing in a pocket-mode chunk with zero live threats.
  const nextClearedChunks =
    isPocketMode && !chunkAlreadyCleared && livePredatorsInChunk === 0
      ? [...previouslyCleared, currentChunkIndex]
      : previouslyCleared;

  let nextDepthTravelMeters: number;
  if (chunkLocked) {
    nextDepthTravelMeters = Math.min(
      chunkFloorMeters,
      scene.depthTravelMeters + targetDepthOffset,
    );
  } else if (tuning.completionCondition === "infinite") {
    nextDepthTravelMeters = scene.depthTravelMeters + targetDepthOffset;
  } else {
    nextDepthTravelMeters = Math.min(
      tuning.targetDepthMeters ?? TRENCH_FLOOR_METERS,
      scene.depthTravelMeters + targetDepthOffset,
    );
  }

  // Lamp-flare temporarily doubles the lamp scale for bigger
  // collection radius + brighter cone. Falls back to per-upgrade
  // baseline (player.lampScale) when the buff expires.
  const isLampFlare = activeLampFlare > totalTime;
  const lampScaleNext = isLampFlare ? player.lampScale * 2 : player.lampScale;

  const nextPlayer = {
    ...player,
    lampScale: lampScaleNext,
    activeBuffs: {
      repelUntil: activeRepel,
      overdriveUntil: activeOverdrive,
      lureUntil: activeLure,
      lampFlareUntil: activeLampFlare,
    },
  };

  const nextSceneBase: SceneState = {
    anomalies: anomalyCollection.anomalies.map(a => ({ ...a, pulsePhase: a.pulsePhase + deltaTime * 3 })),
    creatures: collection.creatures,
    particles,
    pirates,
    player: nextPlayer,
    predators,
    depthTravelMeters: nextDepthTravelMeters,
    objectiveQueue: scene.objectiveQueue,
    clearedChunks: nextClearedChunks,
  };

  // Objective progress advance. First apply per-frame increments
  // (reach-depth, sustain-chain) via advanceObjectiveQueue, then tally
  // any beacons charted this frame against
  // `collect-beacons-in-region` objectives whose region matches the
  // biome where each creature lived.
  let nextObjectiveQueue = advanceObjectiveQueue(
    scene.objectiveQueue,
    nextSceneBase,
    collection.multiplier,
    0,
  );
  if (collection.collected.length > 0) {
    for (const creature of collection.collected) {
      const y = creature.worldYMeters ?? scene.depthTravelMeters;
      const biome = biomeAtDepth(y);
      nextObjectiveQueue = tallyBeaconCharted(nextObjectiveQueue, biome.id);
    }
  }

  const nextScene: SceneState = {
    ...nextSceneBase,
    objectiveQueue: nextObjectiveQueue,
  };

  return {
    collection,
    collidedWithPredator: isCollision,
    scene: nextScene,
    telemetry: getDiveTelemetry(nextScene, timeLeft, tuning.durationSeconds),
    oxygenBonusSeconds: breathBonus,
  };
}
