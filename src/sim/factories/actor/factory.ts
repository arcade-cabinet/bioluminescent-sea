import { round } from "@/sim/_shared/math";
import { createRng, type Rng } from "@/sim/rng";
import type {
  Anomaly,
  Creature,
  Pirate,
  Player,
  Predator,
} from "@/sim/entities/types";
import {
  type ActorArchetype,
  type AnomalyArchetype,
  ARCHETYPE_CATALOGUE,
  type ArchetypeId,
  type CreatureArchetype,
  type EnemySubArchetype,
  getArchetype,
  type LeviathanArchetype,
  type PirateArchetype,
  type PlayerArchetype,
  type PredatorArchetype,
} from "./archetypes";

/**
 * Spawn parameters — provided by the chunked spawner / scene initializer
 * for each call. The factory never reaches out to viewport / world-y on
 * its own; callers compose those into placement before invoking it.
 */
export interface ActorSpawnContext {
  /** Stable id prefix; the factory appends `-<rng-suffix>` for uniqueness. */
  idPrefix: string;
  /** Initial position in playfield pixels. */
  x: number;
  y: number;
  /** Optional world-Y in meters when the entity supports chunked rendering. */
  worldYMeters?: number;
  /** Caller-supplied seeded rng so output is deterministic. */
  rng: Rng;
}

/**
 * Discriminated result of a factory call. The kind matches the archetype's
 * kind so callers can switch directly without type assertions.
 */
export type SpawnedActor =
  | { kind: "creature"; archetype: CreatureArchetype; entity: Creature }
  | { kind: "predator"; archetype: PredatorArchetype; entity: Predator }
  | { kind: "pirate"; archetype: PirateArchetype; entity: Pirate }
  | { kind: "leviathan"; archetype: LeviathanArchetype; entity: Predator }
  | { kind: "enemy-sub"; archetype: EnemySubArchetype; entity: Predator }
  | { kind: "anomaly"; archetype: AnomalyArchetype; entity: Anomaly }
  | { kind: "player"; archetype: PlayerArchetype; entity: Player };

function suffix(rng: Rng): string {
  return rng.int(1000, 9999).toString();
}

function spawnCreature(
  archetype: CreatureArchetype,
  ctx: ActorSpawnContext,
): Extract<SpawnedActor, { kind: "creature" }> {
  const { rng, x, y, idPrefix, worldYMeters } = ctx;
  return {
    kind: "creature",
    archetype,
    entity: {
      id: `${idPrefix}-${archetype.id}-${suffix(rng)}`,
      type: archetype.creatureType,
      x: round(x, 2),
      y: round(y, 2),
      size: round(archetype.baseSize * rng.range(0.85, 1.1), 2),
      color: archetype.palette.color,
      glowColor: archetype.palette.glow,
      glowIntensity: round(0.68 + rng.range(0, 0.28), 3),
      noiseOffsetX: round(rng.range(0, 1000), 2),
      noiseOffsetY: round(rng.range(0, 1000), 2),
      pulsePhase: round(rng.range(0, Math.PI * 2), 3),
      speed: round(rng.range(archetype.speedRange[0], archetype.speedRange[1]), 3),
      worldYMeters,
    },
  };
}

function spawnPredator(
  archetype: PredatorArchetype,
  ctx: ActorSpawnContext,
): Extract<SpawnedActor, { kind: "predator" }> {
  const { rng, x, y, idPrefix } = ctx;
  return {
    kind: "predator",
    archetype,
    entity: {
      id: `${idPrefix}-${archetype.id}-${suffix(rng)}`,
      x: round(x, 2),
      y: round(y, 2),
      size: round(archetype.baseSize * rng.range(0.85, 1.05), 2),
      angle: round(rng.range(-Math.PI, Math.PI), 3),
      noiseOffset: round(rng.range(0, 1000), 2),
      speed: round(rng.range(archetype.speedRange[0], archetype.speedRange[1]), 3),
    },
  };
}

function spawnLeviathan(
  archetype: LeviathanArchetype,
  ctx: ActorSpawnContext,
): Extract<SpawnedActor, { kind: "leviathan" }> {
  const { rng, x, y, idPrefix } = ctx;
  return {
    kind: "leviathan",
    archetype,
    entity: {
      id: `${idPrefix}-${archetype.id}-${suffix(rng)}`,
      x: round(x, 2),
      y: round(y, 2),
      size: round(archetype.baseSize * rng.range(0.95, 1.1), 2),
      angle: round(rng.range(-Math.PI, Math.PI), 3),
      noiseOffset: round(rng.range(0, 1000), 2),
      speed: round(rng.range(archetype.speedRange[0], archetype.speedRange[1]), 3),
      isLeviathan: true,
    },
  };
}

function spawnEnemySub(
  archetype: EnemySubArchetype,
  ctx: ActorSpawnContext,
): Extract<SpawnedActor, { kind: "enemy-sub" }> {
  const { rng, x, y, idPrefix } = ctx;
  // Enemy subs share the Predator entity shape on the sim side — they're a
  // faster, alerting predator with a detection cone. The archetype carries
  // the AI hookup so the manager wires the enemy-sub-hunt steering instead
  // of stalk-and-dash. This keeps the sim shape stable while letting modes
  // and spawners reason about archetype identity.
  return {
    kind: "enemy-sub",
    archetype,
    entity: {
      id: `${idPrefix}-${archetype.id}-${suffix(rng)}`,
      x: round(x, 2),
      y: round(y, 2),
      size: round(archetype.baseSize, 2),
      angle: round(rng.range(-Math.PI, Math.PI), 3),
      noiseOffset: round(rng.range(0, 1000), 2),
      speed: round(rng.range(archetype.speedRange[0], archetype.speedRange[1]), 3),
    },
  };
}

function spawnPirate(
  archetype: PirateArchetype,
  ctx: ActorSpawnContext,
): Extract<SpawnedActor, { kind: "pirate" }> {
  const { rng, x, y, idPrefix } = ctx;
  return {
    kind: "pirate",
    archetype,
    entity: {
      id: `${idPrefix}-${archetype.id}-${suffix(rng)}`,
      x: round(x, 2),
      y: round(y, 2),
      angle: round(rng.range(-Math.PI, Math.PI), 3),
      noiseOffset: round(rng.range(0, 1000), 2),
      speed: round(rng.range(archetype.speedRange[0], archetype.speedRange[1]), 3),
      lanternPhase: round(rng.next() * Math.PI * 2, 3),
    },
  };
}

function spawnAnomaly(
  archetype: AnomalyArchetype,
  ctx: ActorSpawnContext,
): Extract<SpawnedActor, { kind: "anomaly" }> {
  const { rng, x, y, idPrefix, worldYMeters } = ctx;
  return {
    kind: "anomaly",
    archetype,
    entity: {
      id: `${idPrefix}-${archetype.id}-${suffix(rng)}`,
      type: archetype.anomalyType,
      x: round(x, 2),
      y: round(y, 2),
      size: archetype.baseSize,
      pulsePhase: round(rng.range(0, Math.PI * 2), 3),
      worldYMeters,
    },
  };
}

function spawnPlayer(
  archetype: PlayerArchetype,
  ctx: ActorSpawnContext,
): Extract<SpawnedActor, { kind: "player" }> {
  const { x, y } = ctx;
  return {
    kind: "player",
    archetype,
    entity: {
      x,
      y,
      targetX: x,
      targetY: y,
      angle: 0,
      glowIntensity: 1,
      speedScale: 1,
      lampScale: 1,
      activeBuffs: { repelUntil: 0, overdriveUntil: 0, lureUntil: 0, lampFlareUntil: 0 },
    },
  };
}

/**
 * The single dispatch every spawner uses. Consumers don't switch on
 * archetype kind themselves — they call `createActor(archetype, ctx)` and
 * the caller's own kind narrowing falls out of the discriminated result.
 */
export function createActor(
  archetype: ActorArchetype,
  ctx: ActorSpawnContext,
): SpawnedActor {
  switch (archetype.kind) {
    case "creature":
      return spawnCreature(archetype, ctx);
    case "predator":
      return spawnPredator(archetype, ctx);
    case "pirate":
      return spawnPirate(archetype, ctx);
    case "leviathan":
      return spawnLeviathan(archetype, ctx);
    case "enemy-sub":
      return spawnEnemySub(archetype, ctx);
    case "anomaly":
      return spawnAnomaly(archetype, ctx);
    case "player":
      return spawnPlayer(archetype, ctx);
  }
}

/** Convenience — look up an archetype by id then dispatch. */
export function createActorById(
  id: ArchetypeId,
  ctx: ActorSpawnContext,
): SpawnedActor {
  return createActor(getArchetype(id), ctx);
}

// ─── Higher-order composites ───────────────────────────────────────────────
// Composites are expressed as small helpers that pull primitives from the
// catalogue, so a "school of seven jellyfish" stays a one-liner content
// authors can read.

export interface CompositeSpawnContext {
  idPrefix: string;
  /** Seed input for the composite. Each spawned member receives a derived rng. */
  seed: number;
  /** Anchor position; members spread around it deterministically. */
  centerX: number;
  centerY: number;
  /** Spread radius in pixels. */
  radius: number;
  /** Optional world-Y in meters. */
  worldYMeters?: number;
}

/** A flock-of-N around an anchor, all sharing the same archetype. */
export function spawnFlock(
  archetypeId: ArchetypeId,
  count: number,
  ctx: CompositeSpawnContext,
): SpawnedActor[] {
  const archetype = getArchetype(archetypeId) as ActorArchetype;
  const rng = createRng(ctx.seed);
  return Array.from({ length: count }, () => {
    const angle = rng.range(0, Math.PI * 2);
    const distance = rng.range(0, ctx.radius);
    return createActor(archetype, {
      idPrefix: ctx.idPrefix,
      x: ctx.centerX + Math.cos(angle) * distance,
      y: ctx.centerY + Math.sin(angle) * distance,
      worldYMeters: ctx.worldYMeters,
      rng,
    });
  });
}

/**
 * A leviathan with two predator outriders — the kind of higher-order beat
 * the chunked spawner can't author directly because it's a *relationship*
 * between archetypes. The factory owns these compositions.
 */
export function spawnLeviathanEscort(ctx: CompositeSpawnContext): SpawnedActor[] {
  const rng = createRng(ctx.seed + 4242);
  const leviathan = createActor(getArchetype("stygian-leviathan"), {
    idPrefix: ctx.idPrefix,
    x: ctx.centerX,
    y: ctx.centerY,
    worldYMeters: ctx.worldYMeters,
    rng,
  });
  const outriders = [-1, 1].map((dir) =>
    createActor(getArchetype("abyssal-predator"), {
      idPrefix: ctx.idPrefix,
      x: ctx.centerX + dir * ctx.radius,
      y: ctx.centerY + rng.range(-ctx.radius * 0.4, ctx.radius * 0.4),
      // Predator records don't carry worldYMeters today (unlike creatures
      // and anomalies) but the spawner anchors them at the same depth as
      // the leviathan they escort. Forward the meter for parity if the
      // shape grows that field later.
      worldYMeters: ctx.worldYMeters,
      rng,
    }),
  );
  return [leviathan, ...outriders];
}

export { ARCHETYPE_CATALOGUE };
