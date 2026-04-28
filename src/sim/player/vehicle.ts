/**
 * PlayerVehicle is infrastructure analogous to GameVehicle in
 * src/sim/ai/steering.ts — NOT a factory-pyramid actor (rule 9
 * applies to spawnable creatures/predators/pirates, not the
 * one-and-only player Vehicle the runtime constructs).
 *
 * Free factory + free thrust function — no class, no inheritance,
 * no Yuka leak into the sim contract beyond what GameVehicle
 * already imports under-the-hood.
 *
 * NaN guards on every input: a misbehaving touch driver passing
 * NaN coords cannot poison velocity / position. Rejected inputs
 * leave the vehicle untouched.
 */

import { GameVehicle } from "@/sim/ai/steering";

export interface PlayerVehicleConfig {
  /** Cruise max speed (px/sec) — typical movement. */
  cruiseMaxSpeed: number;
  /** Multiplier on cruise when sprint is held. */
  sprintMultiplier: number;
  /** Drag coefficient (per second). Higher = stops faster on input release. */
  drag: number;
  /** Vehicle mass — passed through to Yuka's force integration. */
  mass: number;
}

export interface ThrustInput {
  /** Thrust vector x component, normalized 0..1 magnitude. */
  tx: number;
  /** Thrust vector y component, normalized 0..1 magnitude. */
  ty: number;
  /** Sprint hold flag — when true, maxSpeed jumps to cruise × sprintMultiplier. */
  sprint: boolean;
}

/** Below this magnitude, joystick input is ignored as drift. */
const JOYSTICK_DEADZONE = 0.1;

/** Force scalar on full-magnitude thrust. */
const THRUST_FORCE_SCALAR = 800;

/**
 * Caps deltaTime in applyThrust so a backgrounded-tab return with a
 * huge dt can't produce a velocity spike larger than one frame's
 * worth of thrust. Yuka does the same internally.
 */
const MAX_DELTA_TIME = 0.1;

export function createPlayerVehicle(
  config: PlayerVehicleConfig,
  start: { x: number; y: number },
): GameVehicle {
  // Validate config — mass=0 would divide-by-zero into velocity.
  if (
    !(config.mass > 0) ||
    !(config.cruiseMaxSpeed > 0) ||
    !(config.sprintMultiplier > 0) ||
    !(config.drag >= 0) ||
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y)
  ) {
    throw new Error(
      `createPlayerVehicle: invalid config or start position: ${JSON.stringify({ config, start })}`,
    );
  }
  const v = new GameVehicle("player");
  v.position.set(start.x, start.y, 0);
  v.velocity.set(0, 0, 0);
  v.maxSpeed = config.cruiseMaxSpeed;
  v.maxForce = THRUST_FORCE_SCALAR * 2;
  v.mass = config.mass;
  return v;
}

export function applyThrust(
  vehicle: GameVehicle,
  config: PlayerVehicleConfig,
  input: ThrustInput,
  deltaTime: number,
): void {
  // NaN/Infinity guard — bad input leaves vehicle untouched.
  if (
    !Number.isFinite(input.tx) ||
    !Number.isFinite(input.ty) ||
    !Number.isFinite(deltaTime)
  ) {
    return;
  }

  // Cap dt so a backgrounded-tab return doesn't produce a single-frame
  // velocity spike. Drag will absorb anything in-band over multiple
  // frames; this just bounds the per-frame overshoot.
  const dt = Math.max(0, Math.min(deltaTime, MAX_DELTA_TIME));
  if (dt === 0) return;

  vehicle.maxSpeed = input.sprint
    ? config.cruiseMaxSpeed * config.sprintMultiplier
    : config.cruiseMaxSpeed;

  const magnitude = Math.hypot(input.tx, input.ty);
  if (magnitude >= JOYSTICK_DEADZONE) {
    // Joystick input contract: tx/ty form a vector with magnitude in
    // [0, 1]. Above-deadzone magnitude scales force linearly with
    // throw — a half-throw gives half acceleration. Callers (joystick
    // hook, keyboard hook) MUST clamp the vector to unit-or-less
    // before passing it in.
    const accel = (THRUST_FORCE_SCALAR / config.mass) * dt;
    vehicle.velocity.x += input.tx * accel;
    vehicle.velocity.y += input.ty * accel;
  }

  // Drag — exponential decay. Always applied so input release leaves
  // the sub coasting then settling, matching submarine inertia.
  const dragFactor = Math.max(0, 1 - config.drag * dt);
  vehicle.velocity.x *= dragFactor;
  vehicle.velocity.y *= dragFactor;

  // Speed clamp.
  const speed = Math.hypot(vehicle.velocity.x, vehicle.velocity.y);
  if (speed > vehicle.maxSpeed) {
    vehicle.velocity.x = (vehicle.velocity.x / speed) * vehicle.maxSpeed;
    vehicle.velocity.y = (vehicle.velocity.y / speed) * vehicle.maxSpeed;
  }
}
