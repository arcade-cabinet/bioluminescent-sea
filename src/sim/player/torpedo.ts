/**
 * Torpedo launcher + projectile step.
 *
 * Closure-backed launcher: `createTorpedoLauncher()` returns
 * `{ fire(player, aimRad, simTime) → Torpedo | null }`. The cooldown
 * timer is internal — callers cannot double-fire by holding stale
 * state. NaN guards reject malformed input INSIDE fire(), before
 * any state mutation, so a rejected call doesn't burn the cooldown.
 *
 * Predator dodge + damage live on PredatorBrain (a `dodgeUntil`
 * field + a steering modifier in tick()). Spec 4c-runtime wires:
 *   - advance.ts steps every torpedo, removes expired ones
 *   - collision: torpedo within predator size → applyTorpedoDamage
 *   - near-miss within DODGE_DETECT_PX → set predator.dodgeUntil
 *   - launch: ai.applyCavitationBump at TORPEDO_AUDIBLE_RADIUS
 * Caller (runtime) owns oxygen-cost gating: it checks oxygen
 * before calling fire(), subtracts the cost on success. fire()
 * does not see oxygen.
 */

export interface Torpedo {
  id: string;
  /** Position. */
  x: number;
  y: number;
  /** Velocity (px/sec). Set at launch from aim; never changes. */
  vx: number;
  vy: number;
  /** Sim-time at launch — for FX age gating. */
  launchedAt: number;
  /** Sim-time the torpedo expires. */
  expiresAt: number;
}

/** Speed in playfield px/sec. Fast — torpedo reads as a streak of light. */
export const TORPEDO_SPEED_PX_PER_SEC = 800;
/** Lifespan after launch (sim-seconds). */
export const TORPEDO_LIFESPAN_SECONDS = 1.5;
/** Minimum sim-seconds between fires. */
export const TORPEDO_COOLDOWN_SECONDS = 0.6;

let nextId = 0;

export interface TorpedoLauncher {
  /**
   * Attempt to fire a torpedo at the given aim direction. Returns the
   * new Torpedo or null when rejected (cooldown active or non-finite
   * input). Internal cooldown advances ONLY on a successful fire.
   */
  fire(
    player: { x: number; y: number },
    aimRad: number,
    simTime: number,
  ): Torpedo | null;
}

export function createTorpedoLauncher(): TorpedoLauncher {
  let lastFireTime = -Infinity;

  return {
    fire(player, aimRad, simTime) {
      // Internal NaN guard — rejected before any state mutation.
      if (
        !Number.isFinite(player.x) ||
        !Number.isFinite(player.y) ||
        !Number.isFinite(aimRad) ||
        !Number.isFinite(simTime)
      ) {
        return null;
      }
      // Cooldown gate.
      if (simTime - lastFireTime < TORPEDO_COOLDOWN_SECONDS) {
        return null;
      }

      lastFireTime = simTime;
      nextId += 1;
      return {
        id: `torpedo-${nextId}`,
        x: player.x,
        y: player.y,
        vx: Math.cos(aimRad) * TORPEDO_SPEED_PX_PER_SEC,
        vy: Math.sin(aimRad) * TORPEDO_SPEED_PX_PER_SEC,
        launchedAt: simTime,
        expiresAt: simTime + TORPEDO_LIFESPAN_SECONDS,
      };
    },
  };
}

/**
 * Advance a torpedo one frame. Returns null when the torpedo has
 * expired (its `expiresAt` is in the past). Position is integrated
 * by velocity × dt — no drag, no homing.
 *
 * Caller pattern:
 *   const stepped = stepTorpedo(t, simTime, dt);
 *   if (stepped === null) // remove from scene
 *   else // collide-test against predators, apply damage, etc.
 *
 * Implementation note: the function takes simTime explicitly (not
 * inferred from torpedo.launchedAt + dt counters) so it can compare
 * against expiresAt without coupling to a clock the caller doesn't
 * own. dt is the per-frame step.
 */
export function stepTorpedo(torpedo: Torpedo, simTime: number, dt = 1 / 30): Torpedo | null {
  if (!Number.isFinite(simTime) || !Number.isFinite(dt)) return null;
  if (simTime >= torpedo.expiresAt) return null;
  return {
    ...torpedo,
    x: torpedo.x + torpedo.vx * dt,
    y: torpedo.y + torpedo.vy * dt,
  };
}
