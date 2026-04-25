import { trait } from "koota";
import type {
  Anomaly,
  Creature,
  Particle,
  Pirate,
  Player,
  Predator,
} from "@/sim/entities/types";

/**
 * Koota traits — the world schema.
 *
 * Traits are the ONLY place entity data lives at runtime; the
 * simulation in src/sim/* produces pure data that gets lifted into
 * traits, and the renderer in src/render/* reads from traits through
 * queries. Sim never imports Koota; UI never writes traits directly.
 *
 * ## Trait ↔ Archetype mapping
 *
 * Every archetype produced by `src/sim/entities/factory` materialises
 * onto exactly one of these traits. Archetypes are the *content
 * identity* (what spawns, with what stats, under what AI profile);
 * traits are the *runtime shape* (what the renderer + AI manager see).
 * Multiple archetypes can map to the same trait when their runtime
 * shape is identical — what differs is their archetype-driven
 * behaviour and rendering glyph.
 *
 *   creature archetypes  → CreatureEntity  (fish-shoal, jellyfish-bloom,
 *                                           plankton-mote)
 *   predator             → PredatorEntity  (abyssal-predator)
 *   pirate               → PirateEntity    (pirate-lantern)
 *   leviathan            → PredatorEntity  (stygian-leviathan, with
 *                                           `isLeviathan: true` flag)
 *   enemy-sub            → PredatorEntity  (marauder-sub) — shares the
 *                                           Predator runtime shape but
 *                                           the AI manager wires the
 *                                           enemy-sub-hunt steering
 *                                           profile based on the
 *                                           originating archetype id.
 *   anomaly              → AnomalyEntity   (repel-anomaly,
 *                                           overdrive-anomaly)
 *   player               → PlayerAvatar    (ranger-sub)
 *
 * The id naming convention `<archetype>-c<chunkIdx>-<n>` lets the AI
 * manager route to the correct steering by parsing the archetype
 * prefix off the entity id.
 */

export const PlayerAvatar = trait(
  () => ({ value: null as unknown as Player })
);

export const AnomalyEntity = trait(
  () => ({ value: null as unknown as Anomaly })
);

export const CreatureEntity = trait(
  () => ({ value: null as unknown as Creature })
);

export const PredatorEntity = trait(
  () => ({ value: null as unknown as Predator })
);

export const PirateEntity = trait(
  () => ({ value: null as unknown as Pirate })
);

export const ParticleEntity = trait(
  () => ({ value: null as unknown as Particle })
);

/**
 * DiveRoot holds scene-wide runtime state that doesn't belong on a
 * specific entity: the elapsed simulation time, the current
 * CollectionBurst list, the latest telemetry snapshot, etc. Exactly
 * one DiveRoot entity exists per world.
 */
export const DiveRoot = trait({
  totalTime: 0,
  threatFlashAlpha: 0,
  /**
   * Cumulative descent in world-meters mirror of
   * `SceneState.depthTravelMeters`. The sim advances it every frame;
   * the ECS lifts it here so queries (audio filter, renderer camera)
   * can read scene-wide depth without walking back to the sim.
   */
  depthTravelMeters: 0,
});
