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
import {
  collectAnomalies,
  collectCreatures,
  findCollidingThreatBearing,
  hasPredatorCollision,
} from "./collection";
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
  // Biome-driven aggression: deeper biomes turn the dial up.
  // photic-gate=1.0 → stygian-abyss=1.6. Lookup is by current
  // depthTravel, NOT player.y (which is screen-space).
  ai.setBiomeAggression(biomeAggressionForDepth(scene.depthTravelMeters));
  ai.syncPredators(scene.predators);
  ai.syncPirates(scene.pirates);
  ai.syncCreatures(scene.creatures);
  ai.update(deltaTime);

  // Lamp-pressure: predators inside the player's lamp cone take
  // damage and flip to FleeState. Lamp-flare buff scales the cone
  // by 1.35× (matching the renderer's `lampBoost` in player.ts) —
  // not a doubling, but enough to noticeably extend reach + width.
  // This is the player's only offensive tool — the lamp is the
  // bridge between "vehicle with a light" and "predator deterrent."
  const isLampFlareActive = player.activeBuffs.lampFlareUntil > totalTime;
  const lampBoost = isLampFlareActive ? 1.35 : 1;
  ai.applyLampPressure(player.x, player.y, player.angle, player.lampScale, lampBoost);

  // Lure buff: collectibles within the lure radius drift toward the
  // player. Only acts on non-ambient creatures (scoring beacons) so
  // ambient atmosphere doesn't get sucked in. Strength scales with
  // distance — close beacons snap, far beacons gently nudge.
  const isLureActive = player.activeBuffs.lureUntil > totalTime;
  const lureRadius = 300;
  const lurePullPerSecond = 240; // px/s at the inside edge

  // Wake scatter: ambient creatures (jellyfish/glowfish/plankton)
  // push gently away from the player when the sub passes close. The
  // perpendicular component biases against the player's heading so it
  // reads as a wake rather than a uniform repulsion field. Falls off
  // with distance to keep distant fish calm.
  const wakeRadius = 90;
  const wakePushPerSecond = 110;
  const playerHeadingX = Math.cos(player.angle);
  const playerHeadingY = Math.sin(player.angle);

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
    const wdx = nx - player.x;
    const wdy = ny - player.y;
    const wDist = Math.hypot(wdx, wdy);
    if (wDist > 1 && wDist < wakeRadius) {
      const falloff = 1 - wDist / wakeRadius;
      const approach = playerHeadingX * (wdx / wDist) + playerHeadingY * (wdy / wDist);
      const wakeBoost = approach < 0 ? 1 + Math.abs(approach) * 1.2 : 1;
      const push = falloff * wakePushPerSecond * wakeBoost * deltaTime;
      nx += (wdx / wDist) * push;
      ny += (wdy / wDist) * push;
    }
    return { ...base, x: nx, y: ny };
  });

  // Two-stage death pipeline:
  //
  // 1. `justKilled` — predators whose HP hit 0 THIS frame. Drop loot
  //    once at the death position, then the brain enters its
  //    sink-and-fade animation.
  //
  // 2. `dead` — predators whose death animation fully elapsed. These
  //    are pruned from the scene; the next syncPredators tick removes
  //    the brain map entry too.
  //
  // Dying-but-not-yet-pruned predators stay in the scene so the
  // renderer can drive `deathProgress` (sink + fade + bubbles).
  const justKilled = ai.getJustKilledPredatorIds();
  const deadIds = ai.getDeadPredatorIds();
  const lootDrops: import("@/sim/entities/types").Anomaly[] = [];
  for (const dead of scene.predators) {
    if (!justKilled.has(dead.id)) continue;
    if (dead.isLeviathan) continue; // leviathans are ambient, never lamp-killed
    lootDrops.push({
      id: `loot-${dead.id}-${Math.floor(totalTime * 1000)}`,
      type: "breath",
      x: dead.x,
      y: dead.y,
      size: 18,
      pulsePhase: totalTime,
    });
  }
  const predators = scene.predators
    .filter((p) => !deadIds.has(p.id))
    .map((p) => {
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
  let activeAdrenaline = player.activeBuffs.adrenalineUntil;
  let activeAdrenalineCooldown = player.activeBuffs.adrenalineCooldownUntil;
  let breathBonus = 0;

  // Adrenaline trigger: when threat intensity is at full saturation
  // (4+ active stalk/charge/strike predators near the player) and
  // the cooldown gate is open, fire a 1.5s burst. While active,
  // game-loop deltaTime is scaled 0.7× by the runtime — the player
  // experiences slow-mo + ~1.4× input gain, can dodge a flank press
  // that would otherwise be unwinnable. Cooldown locks for 8s after
  // the burst ends so the mechanic stays meaningful.
  const threatIntensityNow = ai.computeThreatIntensity(player.x, player.y);
  const adrenalineActive = activeAdrenaline > totalTime;
  if (
    threatIntensityNow >= 0.95 &&
    !adrenalineActive &&
    totalTime >= activeAdrenalineCooldown
  ) {
    activeAdrenaline = totalTime + 1.5;
    activeAdrenalineCooldown = totalTime + 1.5 + 8;
  }

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
      adrenalineUntil: activeAdrenaline,
      adrenalineCooldownUntil: activeAdrenalineCooldown,
    },
    // Stamp impact wall-time for the renderer's hull flicker. The
    // 0.6s window matches the renderer's flicker duration; older
    // values just stay around (no harm — the flicker math has a
    // hard cutoff).
    lastImpactSeconds: isCollision ? totalTime : (player.lastImpactSeconds ?? -Infinity),
    lastImpactBearing: isCollision
      ? (findCollidingThreatBearing(player, predators, tuning.threatRadiusScale) ??
         findCollidingThreatBearing(player, pirates as unknown as import("@/sim/entities/types").Predator[], tuning.threatRadiusScale) ??
         player.lastImpactBearing)
      : player.lastImpactBearing,
  };

  const nextSceneBase: SceneState = {
    // Surviving anomalies advance their pulsePhase; freshly-dropped
    // loot from this frame's predator deaths is appended at full
    // pulse so the player sees the drop pop in.
    anomalies: [
      ...anomalyCollection.anomalies.map(a => ({ ...a, pulsePhase: a.pulsePhase + deltaTime * 3 })),
      ...lootDrops,
    ],
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

  // Strike-burst feedback: if any predator is mid-strike inside a
  // generous radius around the player, surface that to the runtime
  // so it can fire the threat-flash camera shake even when the
  // collision check missed. Tuned wider than the actual hit radius
  // (~140 vs 60) so a near-miss still feels dangerous.
  const predatorStrikeNearPlayer = ai.anyPredatorStrikingNear(player.x, player.y, 140);
  // Continuous threat axis for the ambient audio layer.
  const threatIntensity = ai.computeThreatIntensity(player.x, player.y);
  // Pack-call edge detection: any brain broadcast in the last
  // deltaTime window. Cheaper than tracking per-brain state on the
  // runtime side.
  const predatorPackCallThisFrame = ai.anyEngageBroadcastSince(totalTime - deltaTime - 0.001);
  // Kill count for SFX — justKilled is already computed above.
  const predatorKillsThisFrame = justKilled.size;
  const pirateAlertThisFrame = ai.anyPirateAlertedThisFrame();

  return {
    collection,
    collidedWithPredator: isCollision,
    scene: nextScene,
    telemetry: getDiveTelemetry(nextScene, timeLeft, tuning.durationSeconds),
    oxygenBonusSeconds: breathBonus,
    predatorStrikeNearPlayer,
    threatIntensity,
    predatorPackCallThisFrame,
    predatorKillsThisFrame,
    pirateAlertThisFrame,
    // Snapshot the scatter buffer — AIManager mutates the same array
    // on the next frame so we have to copy here. Most frames the
    // array is empty so the spread is cheap.
    lampScatterPoints: [...ai.lastLampScatterPoints],
    // 800px radar — covers ~2× viewport so threats pressing in from
    // off-screen show up as arcs before they cross the edge.
    threatBearings: ai.threatBearings(player.x, player.y, 800),
    // Impact ripple anchor — non-null only on the frame collision
    // first registers. The runtime edge-detects on
    // `lastImpactSeconds` rising so re-emitting during the grace
    // window doesn't fire a ring per frame.
    impactRippleAt: isCollision ? { x: player.x, y: player.y } : null,
    // Leviathan presence — used by audio (sub-bass drone) +
    // renderer (edge-vignette pulse). 0 most frames; non-zero only
    // when a leviathan-flagged predator is within 1200px.
    leviathanProximity: ai.leviathanProximity(player.x, player.y),
    // Active flank broadcasts — fading arcs in FX layer that show
    // pack convergence vectors at the moment the engage call fires.
    flankBroadcasts: ai.recentFlankPairs(1.2),
    adrenalineActive: activeAdrenaline > totalTime,
    // Readiness 0..1 — 1 means adrenaline is off cooldown and the
    // brain pack pressure could trigger it. While the burst itself
    // is active, readiness is 0; while cooling down, it linearly
    // ramps from 0 → 1 over the 8s cooldown window.
    adrenalineReadiness:
      activeAdrenaline > totalTime
        ? 0
        : activeAdrenalineCooldown <= totalTime
          ? 1
          : Math.max(0, 1 - (activeAdrenalineCooldown - totalTime) / 8),
    anomalyPickups: anomalyCollection.collected.map((a) => ({
      x: a.x,
      y: a.y,
      type: a.type,
    })),
  };
}

/**
 * Map descended depth to the biome aggression multiplier consumed
 * by AIManager.setBiomeAggression. The five biome bands are:
 *
 *   0–800m       photic-gate      1.00  (surface, calm)
 *   800–2400m    twilight-shelf   1.15
 *   2400–4800m   midnight-column  1.30
 *   4800–6400m   abyssal-trench   1.45
 *   >6400m       stygian-abyss    1.60
 *
 * Biome-keyed (not interpolated) so the player feels a clean tonal
 * shift each time they cross a band boundary, matching the existing
 * caustics + ambient pad transitions.
 */
function biomeAggressionForDepth(depthMeters: number): number {
  const biome = biomeAtDepth(depthMeters);
  switch (biome.id) {
    case "photic-gate": return 1.0;
    case "twilight-shelf": return 1.15;
    case "midnight-column": return 1.3;
    case "abyssal-trench": return 1.45;
    case "stygian-abyss": return 1.6;
    default: return 1.0;
  }
}
