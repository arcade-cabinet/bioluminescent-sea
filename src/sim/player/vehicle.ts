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

export function createPlayerVehicle(
  config: PlayerVehicleConfig,
  start: { x: number; y: number },
): GameVehicle {
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
  // NaN/Infinity guards — security HIGH. Reject silently; vehicle
  // state remains valid for the next frame.
  if (
    !Number.isFinite(input.tx) ||
    !Number.isFinite(input.ty) ||
    !Number.isFinite(deltaTime)
  ) {
    return;
  }

  // Speed clamp follows sprint state. The clamp is applied after the
  // velocity update so a held sprint immediately unlocks the higher
  // ceiling, while releasing sprint lets drag pull velocity back below
  // cruise naturally.
  vehicle.maxSpeed = input.sprint
    ? config.cruiseMaxSpeed * config.sprintMultiplier
    : config.cruiseMaxSpeed;

  const magnitude = Math.hypot(input.tx, input.ty);
  if (magnitude >= JOYSTICK_DEADZONE) {
    // Apply thrust as an acceleration. Magnitude scales the force; the
    // direction is the unit input vector.
    const accel = (THRUST_FORCE_SCALAR / config.mass) * deltaTime;
    vehicle.velocity.x += (input.tx / magnitude) * magnitude * accel;
    vehicle.velocity.y += (input.ty / magnitude) * magnitude * accel;
  }

  // Drag — exponential decay. Always applied so input release leaves
  // the sub coasting then settling, matching submarine inertia.
  const dragFactor = Math.max(0, 1 - config.drag * deltaTime);
  vehicle.velocity.x *= dragFactor;
  vehicle.velocity.y *= dragFactor;

  // Speed clamp.
  const speed = Math.hypot(vehicle.velocity.x, vehicle.velocity.y);
  if (speed > vehicle.maxSpeed) {
    vehicle.velocity.x = (vehicle.velocity.x / speed) * vehicle.maxSpeed;
    vehicle.velocity.y = (vehicle.velocity.y / speed) * vehicle.maxSpeed;
  }
}
