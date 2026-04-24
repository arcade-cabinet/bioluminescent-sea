import type { CreatureType, AnomalyType } from "../types";

/**
 * The factory's input language. Every spawnable actor is described as one
 * of these archetype records — pure data, no behaviour. The factory reads
 * the archetype's `behaviour` slot and the AI manager wires the matching
 * Yuka steering profile when the actor is born.
 *
 * Archetypes are the seam between content (JSON) and runtime: tweak a
 * tagline or rebalance a creature without touching the spawner or the
 * sim. Adding a new actor kind is a one-line addition here plus a Yuka
 * profile in the manager.
 */
export type ActorBehaviour =
  | "drift" // gentle perlin wander, the default for collectibles
  | "flock" // alignment + cohesion + separation
  | "stalk-and-dash" // predators
  | "patrol-lantern" // pirates with detection cone
  | "leviathan-roam" // slow, large, oblivious to player
  | "enemy-sub-hunt" // patrolling enemy submersibles
  | "powerup-anomaly" // pulsing pickup
  | "player-sub"; // the player vehicle

export type ActorKind =
  | "creature"
  | "predator"
  | "pirate"
  | "anomaly"
  | "enemy-sub"
  | "leviathan"
  | "player";

export interface ActorArchetypeBase {
  /** Stable id for content authoring (`stygian-leviathan`, `repel-anomaly`). */
  id: string;
  kind: ActorKind;
  behaviour: ActorBehaviour;
  /** Render-side glyph hint. Renderer maps this to the actual sprite path. */
  glyph: string;
  /** World units. Sim treats this as the collision radius in playfield pixels. */
  baseSize: number;
  /** Speed range used by the spawner when the actor is materialised. */
  speedRange: readonly [number, number];
  /** Optional weighting when the spawner picks among same-kind archetypes. */
  weight?: number;
}

export interface CreatureArchetype extends ActorArchetypeBase {
  kind: "creature";
  creatureType: CreatureType;
  /** Hex pair for surface vs glow tint. */
  palette: { color: string; glow: string };
  /** Score awarded on collection. */
  scoreValue: number;
  /** Oxygen restored on collection (pre mode-scale). */
  oxygenBonusSeconds: number;
}

export interface PredatorArchetype extends ActorArchetypeBase {
  kind: "predator";
}

export interface PirateArchetype extends ActorArchetypeBase {
  kind: "pirate";
}

export interface LeviathanArchetype extends ActorArchetypeBase {
  kind: "leviathan";
  /** Spawn chance within an eligible chunk (0..1). */
  spawnChance: number;
}

export interface EnemySubArchetype extends ActorArchetypeBase {
  kind: "enemy-sub";
  /** Detection radius — when player enters, the sub commits to pursuit. */
  detectionRadius: number;
  /** Cooldown between torpedo attacks in seconds. */
  attackCooldownSeconds: number;
}

export interface AnomalyArchetype extends ActorArchetypeBase {
  kind: "anomaly";
  anomalyType: AnomalyType;
  /** Buff duration in seconds. */
  effectSeconds: number;
}

export interface PlayerArchetype extends ActorArchetypeBase {
  kind: "player";
  /** Hull starting integrity (0..1). */
  hull: number;
}

export type ActorArchetype =
  | CreatureArchetype
  | PredatorArchetype
  | PirateArchetype
  | LeviathanArchetype
  | EnemySubArchetype
  | AnomalyArchetype
  | PlayerArchetype;

/**
 * The canonical archetype catalogue. Authored as a pure-data record so it
 * stays JSON-portable even though the file lives in TS for type safety.
 *
 * Higher-order composites (a school of fish, a leviathan with two
 * outriders) reference these by id rather than redeclaring stats — see
 * `factory.ts`.
 */
export const ARCHETYPE_CATALOGUE = {
  // ── Creatures (collectibles) ─────────────────────────────────────────────
  "fish-shoal": {
    id: "fish-shoal",
    kind: "creature",
    creatureType: "fish",
    behaviour: "flock",
    glyph: "fish",
    baseSize: 22,
    speedRange: [0.18, 0.55],
    palette: { color: "#c4b5fd", glow: "#8b5cf6" },
    scoreValue: 50,
    oxygenBonusSeconds: 6,
    weight: 0.5,
  } satisfies CreatureArchetype,

  "jellyfish-bloom": {
    id: "jellyfish-bloom",
    kind: "creature",
    creatureType: "jellyfish",
    behaviour: "drift",
    glyph: "jellyfish",
    baseSize: 28,
    speedRange: [0.12, 0.32],
    palette: { color: "#7dd3fc", glow: "#0ea5e9" },
    scoreValue: 30,
    oxygenBonusSeconds: 8,
    weight: 0.3,
  } satisfies CreatureArchetype,

  "plankton-mote": {
    id: "plankton-mote",
    kind: "creature",
    creatureType: "plankton",
    behaviour: "drift",
    glyph: "plankton",
    baseSize: 14,
    speedRange: [0.08, 0.22],
    palette: { color: "#a5f3fc", glow: "#22d3ee" },
    scoreValue: 10,
    oxygenBonusSeconds: 4,
    weight: 0.2,
  } satisfies CreatureArchetype,

  // ── Threats ──────────────────────────────────────────────────────────────
  "abyssal-predator": {
    id: "abyssal-predator",
    kind: "predator",
    behaviour: "stalk-and-dash",
    glyph: "predator",
    baseSize: 64,
    speedRange: [0.5, 0.75],
  } satisfies PredatorArchetype,

  "pirate-lantern": {
    id: "pirate-lantern",
    kind: "pirate",
    behaviour: "patrol-lantern",
    glyph: "pirate",
    baseSize: 56,
    speedRange: [0.6, 0.9],
  } satisfies PirateArchetype,

  "stygian-leviathan": {
    id: "stygian-leviathan",
    kind: "leviathan",
    behaviour: "leviathan-roam",
    glyph: "leviathan",
    baseSize: 200,
    speedRange: [0.2, 0.4],
    spawnChance: 0.5,
  } satisfies LeviathanArchetype,

  "marauder-sub": {
    id: "marauder-sub",
    kind: "enemy-sub",
    behaviour: "enemy-sub-hunt",
    glyph: "enemy-sub",
    baseSize: 60,
    speedRange: [0.7, 1.05],
    detectionRadius: 220,
    attackCooldownSeconds: 4,
  } satisfies EnemySubArchetype,

  // ── Powerups ─────────────────────────────────────────────────────────────
  "repel-anomaly": {
    id: "repel-anomaly",
    kind: "anomaly",
    anomalyType: "repel",
    behaviour: "powerup-anomaly",
    glyph: "anomaly-repel",
    baseSize: 24,
    speedRange: [0, 0],
    effectSeconds: 15,
  } satisfies AnomalyArchetype,

  "overdrive-anomaly": {
    id: "overdrive-anomaly",
    kind: "anomaly",
    anomalyType: "overdrive",
    behaviour: "powerup-anomaly",
    glyph: "anomaly-overdrive",
    baseSize: 24,
    speedRange: [0, 0],
    effectSeconds: 10,
  } satisfies AnomalyArchetype,

  // ── Player ───────────────────────────────────────────────────────────────
  "ranger-sub": {
    id: "ranger-sub",
    kind: "player",
    behaviour: "player-sub",
    glyph: "player-sub",
    baseSize: 48,
    speedRange: [1, 1],
    hull: 1,
  } satisfies PlayerArchetype,
} as const;

export type ArchetypeId = keyof typeof ARCHETYPE_CATALOGUE;

export function getArchetype<TId extends ArchetypeId>(
  id: TId,
): (typeof ARCHETYPE_CATALOGUE)[TId] {
  return ARCHETYPE_CATALOGUE[id];
}

export function archetypesOfKind(kind: ActorKind): ActorArchetype[] {
  return Object.values(ARCHETYPE_CATALOGUE).filter(
    (archetype) => archetype.kind === kind,
  ) as ActorArchetype[];
}

/** Probability-weighted pick over a list of same-kind archetypes. */
export function pickWeightedArchetype<T extends ActorArchetype>(
  archetypes: readonly T[],
  rng: { next: () => number },
): T {
  if (archetypes.length === 0) {
    throw new Error("pickWeightedArchetype called with empty list");
  }
  const totalWeight = archetypes.reduce(
    (sum, a) => sum + (a.weight ?? 1),
    0,
  );
  let target = rng.next() * totalWeight;
  for (const archetype of archetypes) {
    target -= archetype.weight ?? 1;
    if (target <= 0) return archetype;
  }
  return archetypes[archetypes.length - 1];
}
