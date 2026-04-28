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

/**
 * Closure-backed torpedo launcher. Returned function attempts a fire
 * and returns the new Torpedo or null when rejected (cooldown active
 * or non-finite input). All state — `lastFireTime`, `nextId` — is
 * scoped to this closure, so multiple launcher instances are
 * independently deterministic and tests cannot collide via module-
 * level counters.
 */
export type TorpedoLauncher = (
  player: { x: number; y: number },
  aimRad: number,
  simTime: number,
) => Torpedo | null;

export function createTorpedoLauncher(): TorpedoLauncher {
  let lastFireTime = -Infinity;
  let nextId = 0;

  return (player, aimRad, simTime) => {
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
  };
}

/**
 * Advance a torpedo one frame: position += velocity × dt. No drag,
 * no homing. Caller owns lifecycle: filter expired torpedoes by
 * comparing `simTime >= torpedo.expiresAt` BEFORE calling this.
 *
 * Returns null on non-finite input or non-finite torpedo state
 * (defensive — a runtime mutation that NaNs the velocity would
 * otherwise produce silently broken positions).
 */
export function advanceTorpedo(torpedo: Torpedo, dt: number): Torpedo | null {
  if (
    !Number.isFinite(dt) ||
    !Number.isFinite(torpedo.x) ||
    !Number.isFinite(torpedo.y) ||
    !Number.isFinite(torpedo.vx) ||
    !Number.isFinite(torpedo.vy)
  ) {
    return null;
  }
  return {
    ...torpedo,
    x: torpedo.x + torpedo.vx * dt,
    y: torpedo.y + torpedo.vy * dt,
  };
}
