/**
 * Cavitation event emitter — closure-backed factory, sim-time only.
 *
 * Tracks how long the player has been sprinting at high speed, then
 * emits a single CavitationEvent crossing the threshold and holding
 * the cooldown. The renderer subscribes for particle bursts; the
 * AIManager subscribes to bump predator MemorySystem within an
 * audible radius (sound bypasses LoS — it travels through walls).
 *
 * Sim-time throughout: under devFastDive's time-scale, the loop
 * passes scaled `dt` and `simTime` so cooldown + threshold both
 * track sim seconds, not wall-clock.
 */

const MIN_SECONDS_TO_EMIT = 0.3;
const COOLDOWN_SECONDS = 0.6;
/**
 * Speed must be at least this fraction of cruise before cavitation
 * can begin accumulating. Below this, sprint is "ramping up" and the
 * counter stays at zero. The 0.95 floor is intentional: it means
 * cavitation only fires when the sub is ACTUALLY past cruise speed,
 * not just when the sprint flag is set.
 */
const CAVITATION_SPEED_FRACTION = 0.95;

export interface CavitationEvent {
  /** Sim-time the event fired. */
  simT: number;
  /** Position the event fired at — reserved for renderer subscriber. */
  x: number;
  y: number;
  /** 0..1 — fraction of the way past cruise toward sprint max. */
  intensity: number;
}

export interface CavitationEmitter {
  /**
   * Tick the emitter. Returns a fresh event when one fires this
   * frame; null otherwise. Position is required — the runtime knows
   * the player's current position, and a default of (0,0) would be
   * a silent wrong value at world origin.
   */
  step(
    velocityX: number,
    velocityY: number,
    sprinting: boolean,
    deltaTime: number,
    simTime: number,
    posX: number,
    posY: number,
  ): CavitationEvent | null;
}

export function createCavitationEmitter(
  cruiseMaxSpeed: number,
  sprintMaxSpeed: number,
): CavitationEmitter {
  if (!(cruiseMaxSpeed > 0) || !Number.isFinite(cruiseMaxSpeed)) {
    throw new Error(`createCavitationEmitter: cruiseMaxSpeed must be finite and > 0, got ${cruiseMaxSpeed}`);
  }
  if (!Number.isFinite(sprintMaxSpeed) || sprintMaxSpeed <= 0) {
    throw new Error(`createCavitationEmitter: sprintMaxSpeed must be finite and > 0, got ${sprintMaxSpeed}`);
  }

  let secondsAboveThreshold = 0;
  let cooldownUntil = -1;

  return {
    step(velocityX, velocityY, sprinting, deltaTime, simTime, posX, posY) {
      // NaN/Infinity guards — bad input leaves state intact, no event.
      if (
        !Number.isFinite(velocityX) ||
        !Number.isFinite(velocityY) ||
        !Number.isFinite(deltaTime) ||
        !Number.isFinite(simTime) ||
        !Number.isFinite(posX) ||
        !Number.isFinite(posY)
      ) {
        return null;
      }

      const speed = Math.hypot(velocityX, velocityY);
      const speedThreshold = cruiseMaxSpeed * CAVITATION_SPEED_FRACTION;
      const isCavitating = sprinting && speed >= speedThreshold;

      if (!isCavitating) {
        secondsAboveThreshold = 0;
        return null;
      }

      secondsAboveThreshold += Math.max(0, deltaTime);

      if (simTime < cooldownUntil) return null;
      if (secondsAboveThreshold < MIN_SECONDS_TO_EMIT) return null;

      // Fire one event, set cooldown.
      const cruiseToSprint = sprintMaxSpeed - cruiseMaxSpeed;
      const intensity = cruiseToSprint > 0
        ? Math.max(0, Math.min(1, (speed - cruiseMaxSpeed) / cruiseToSprint))
        : 0;

      cooldownUntil = simTime + COOLDOWN_SECONDS;
      // Reset the threshold counter so the NEXT event still requires
      // a fresh MIN_SECONDS_TO_EMIT window of sustained cavitation.
      secondsAboveThreshold = 0;

      return { simT: simTime, x: posX, y: posY, intensity };
    },
  };
}
