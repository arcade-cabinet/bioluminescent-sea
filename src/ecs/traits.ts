import { trait } from "koota";
import type { Vec3 } from "@/sim/world";

/**
 * Koota traits — the world schema.
 *
 * Traits are the ONLY place entity data lives at runtime; the
 * simulation in src/sim/* produces pure data that gets lifted into
 * traits, and the renderer in src/render/* reads from traits through
 * queries. Sim never imports Koota; UI never writes traits directly.
 *
 * Populated by PR D.
 */

export const Position = trait(() => ({ x: 0, y: 0, z: 0 }) as Vec3);
export const Velocity = trait(() => ({ x: 0, y: 0, z: 0 }) as Vec3);
export const Glow = trait({ intensity: 0, color: "#6be6c1" });
export const Collider = trait({ radiusMeters: 0 });

export const Beacon = trait({
  species: "jellyfish" as "jellyfish" | "plankton" | "fish",
  scoreValue: 0,
  oxygenBonusSeconds: 0,
});

export const Threat = trait({
  kind: "predator" as "predator" | "pirate",
  detectionRadiusMeters: 0,
  lanternPhase: 0,
});

export const ChunkMember = trait({ chunkIndex: -1 });
export const Player = trait({ headlampAngleRadians: 0, sonarPhase: 0 });
