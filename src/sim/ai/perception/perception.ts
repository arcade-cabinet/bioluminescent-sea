/**
 * Perception — the unified sensor surface for player governance and
 * enemy AI.
 *
 * Single free function `perceives(context, perceiver, profile, target)`.
 * No factory, no second method, no `hasHeading` flag —
 * `coneHalfAngleRad >= Math.PI` signals omnidirectional perception,
 * which short-circuits the cone test.
 *
 * Order of culling: radius → cone → line-of-sight (per occluder).
 * NaN guards on all inputs so a degenerate scene state cannot produce
 * a spurious "yes."
 *
 * Profile constants for the three perceiver classes (player, predator,
 * pirate) live below. Per-archetype predator tuning maps onto a
 * profile via `predatorProfile(archetypeProfile)`.
 */

import type { Occluder } from "./occluders";
import { segmentIntersectsCircle, segmentIntersectsRect } from "./geometry";

export interface PerceptionContext {
  readonly occluders: readonly Occluder[];
}

export interface PerceiverProfile {
  /** Visual radius in playfield pixels. */
  radiusPx: number;
  /** Cone half-angle in radians. >= Math.PI is omnidirectional. */
  coneHalfAngleRad: number;
}

export interface PerceiverState {
  x: number;
  y: number;
  /** Forward heading in radians. Unused when profile is omnidirectional. */
  headingRad: number;
}

export interface Target {
  x: number;
  y: number;
}

/**
 * True when the perceiver can see the target through the given context's
 * occluder list, given the perceiver's profile and current heading.
 *
 * Returns false on any non-finite coordinate input (NaN/Infinity) so a
 * degenerate scene cannot leak through.
 */
export function perceives(
  context: PerceptionContext,
  perceiver: PerceiverState,
  profile: PerceiverProfile,
  target: Target,
): boolean {
  if (
    !Number.isFinite(perceiver.x) ||
    !Number.isFinite(perceiver.y) ||
    !Number.isFinite(perceiver.headingRad) ||
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y)
  ) {
    return false;
  }

  const dx = target.x - perceiver.x;
  const dy = target.y - perceiver.y;
  const distSq = dx * dx + dy * dy;
  const r = profile.radiusPx;

  // 1. Radius cull.
  if (distSq > r * r) return false;

  // 2. Cone cull. Skip when omnidirectional. Also skip when perceiver
  //    is on top of target (zero-length ray has no defined direction).
  if (profile.coneHalfAngleRad < Math.PI && distSq > 0) {
    const dist = Math.sqrt(distSq);
    const fx = Math.cos(perceiver.headingRad);
    const fy = Math.sin(perceiver.headingRad);
    const dot = (fx * dx + fy * dy) / dist;
    if (dot < Math.cos(profile.coneHalfAngleRad)) return false;
  }

  // 3. LoS cull. Iterate occluders; reject on first segment-intersect.
  for (const o of context.occluders) {
    if (o.kind === "wall") {
      const x1 = Math.min(o.x1, o.x2);
      const x2 = Math.max(o.x1, o.x2);
      const y1 = Math.min(o.y1, o.y2);
      const y2 = Math.max(o.y1, o.y2);
      // A wall is a 1D segment; segmentIntersectsRect against a
      // zero-area rect is effectively segment-segment intersection.
      if (segmentIntersectsRect(perceiver.x, perceiver.y, target.x, target.y, x1, y1, x2, y2)) {
        return false;
      }
    } else {
      // Circle occluder (debris / leviathan).
      // Skip occluder if either endpoint is the occluder itself —
      // a leviathan as perceiver should not be occluded by itself.
      // Self-exclusion at collection time already handles the
      // perceiver case; this guards the target case (e.g., the
      // perceiver hunting another leviathan).
      const dxp = perceiver.x - o.x;
      const dyp = perceiver.y - o.y;
      if (dxp * dxp + dyp * dyp <= o.radius * o.radius) {
        // Perceiver inside this occluder's radius — it doesn't block
        // the perceiver's outgoing ray.
        continue;
      }
      const dxt = target.x - o.x;
      const dyt = target.y - o.y;
      if (dxt * dxt + dyt * dyt <= o.radius * o.radius) {
        // Target is inside the occluder — perception of the target
        // itself is the goal, so this occluder isn't a blocker.
        continue;
      }
      if (segmentIntersectsCircle(perceiver.x, perceiver.y, target.x, target.y, o.x, o.y, o.radius)) {
        return false;
      }
    }
  }

  return true;
}

// ─── Profile constants ─────────────────────────────────────────────────────

/**
 * Player perception. Omnidirectional radius — the player has eyes
 * everywhere on screen — but bounded by viewport-diagonal so the bot
 * can't reason about creatures beyond what the renderer shows. Same
 * occluders apply (debris, leviathans, locked-room walls).
 */
export const PLAYER_PERCEPTION_PROFILE: PerceiverProfile = {
  radiusPx: 520,
  coneHalfAngleRad: Math.PI, // omnidirectional
};

/**
 * Pirate perception. Forward-cone "lantern" — mirrors the renderer's
 * lantern wedge geometry. Pirates see the player only when the player
 * is inside their lantern arc.
 */
export const PIRATE_PERCEPTION_PROFILE: PerceiverProfile = {
  radiusPx: 220,
  coneHalfAngleRad: Math.PI / 5, // ~36°, matches existing pirate cone
};

/**
 * Predator perception. Per-archetype: the archetype profile carries
 * `detectionRadiusPx` and `fovRadians`, and the brain's effective
 * detection radius takes biome + hunger multipliers into account.
 *
 * Build a perceiver profile from a predator brain's effective radius
 * and the archetype's fov.
 */
export function predatorProfile(detectionRadiusPx: number, fovRadians: number): PerceiverProfile {
  return {
    radiusPx: detectionRadiusPx,
    coneHalfAngleRad: fovRadians * 0.5,
  };
}
