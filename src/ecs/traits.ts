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
 * Entity categories (each is a row in the ECS world):
 *   - 1 player entity (PlayerAvatar + BeaconGlow + Position)
 *   - N beacon entities (CreatureKind + Position + BeaconGlow +
 *     Collectible + OxygenBonus)
 *   - N threat entities (ThreatKind + Position + ThreatDetection)
 *   - N particle entities (ParticleDrift + Position)
 *
 * For PR D we lift the existing sim payload types directly into the
 * traits. PR F swaps positions to Vec3 world-meters when the camera
 * + chunking lands.
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
