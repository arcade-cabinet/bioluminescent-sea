import type { PredatorArchetypeProfile } from "./types";

/**
 * Per-archetype tuning. Adding a new predator species is a row in
 * this catalogue, not a new behaviour fork. The brain wires the
 * states + steering identically; profiles dial intensity.
 *
 * The trio below is intentional: each archetype embodies a different
 * silhouette of pressure.
 *
 * - **abyssal-predator** — the baseline stalker. Patient stalk, then a
 *   committed lunge. Easy to read, hard to escape if you're caught
 *   without lateral room.
 *
 * - **torpedo-eel** — the sprint darter. Long detection radius, brief
 *   charge, devastating strike speed. Player sees them at distance
 *   and has to move *now*. The wide flank offset means a pack of eels
 *   pinches in from sharp angles.
 *
 * - **shadow-octopus** — the grappler. Slow charge, low strike speed
 *   but the tight commit radius means it appears suddenly *inside*
 *   close range. Long recovery so once you read its tell, you have
 *   a window to escape its tentacles.
 *
 * The fallback profile is keyed `default` and applies to any predator
 * id prefix the catalogue doesn't recognise (e.g. dive-specific custom
 * archetypes added later).
 */
export const PREDATOR_PROFILES: Record<string, PredatorArchetypeProfile> = {
  "abyssal-predator": {
    id: "abyssal-predator",
    patrolRadiusPx: 220,
    detectionRadiusPx: 320,
    commitRadiusPx: 110,
    chargeWindupSeconds: 0.55,
    strikeDurationSeconds: 0.35,
    recoverDurationSeconds: 1.2,
    patrolMaxSpeed: 28,
    stalkMaxSpeed: 60,
    strikeMaxSpeed: 180,
    fovRadians: Math.PI * 0.85,
    memorySpanSeconds: 4,
    flankAngleOffset: Math.PI / 5,
  },
  "torpedo-eel": {
    id: "torpedo-eel",
    patrolRadiusPx: 280,
    detectionRadiusPx: 460,
    commitRadiusPx: 180,
    chargeWindupSeconds: 0.32,
    strikeDurationSeconds: 0.45,
    recoverDurationSeconds: 0.8,
    patrolMaxSpeed: 36,
    stalkMaxSpeed: 80,
    strikeMaxSpeed: 280,
    fovRadians: Math.PI * 1.0,
    memorySpanSeconds: 3,
    flankAngleOffset: Math.PI / 3,
  },
  "shadow-octopus": {
    id: "shadow-octopus",
    patrolRadiusPx: 160,
    detectionRadiusPx: 240,
    commitRadiusPx: 80,
    chargeWindupSeconds: 0.85,
    strikeDurationSeconds: 0.5,
    recoverDurationSeconds: 1.6,
    patrolMaxSpeed: 18,
    stalkMaxSpeed: 38,
    strikeMaxSpeed: 110,
    fovRadians: Math.PI * 1.4,
    memorySpanSeconds: 6,
    flankAngleOffset: Math.PI / 6,
  },
  default: {
    id: "default",
    patrolRadiusPx: 220,
    detectionRadiusPx: 320,
    commitRadiusPx: 110,
    chargeWindupSeconds: 0.55,
    strikeDurationSeconds: 0.35,
    recoverDurationSeconds: 1.2,
    patrolMaxSpeed: 28,
    stalkMaxSpeed: 60,
    strikeMaxSpeed: 180,
    fovRadians: Math.PI * 0.85,
    memorySpanSeconds: 4,
    flankAngleOffset: Math.PI / 5,
  },
};

/**
 * Resolve an entity id (e.g. `torpedo-eel-c3-7`) to its profile by
 * matching the longest archetype-id prefix. Falls back to `default`.
 */
export function profileForPredatorId(predatorId: string): PredatorArchetypeProfile {
  let best = PREDATOR_PROFILES.default;
  let bestLen = 0;
  for (const [prefix, profile] of Object.entries(PREDATOR_PROFILES)) {
    if (prefix === "default") continue;
    if (predatorId.startsWith(prefix) && prefix.length > bestLen) {
      best = profile;
      bestLen = prefix.length;
    }
  }
  return best;
}
