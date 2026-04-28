import { Vehicle, SteeringBehavior, Vector3 } from "yuka";
import { playBandMaxX, playBandMinX } from "@/sim/_shared/playBand";
import { createRng, type Rng } from "@/sim/rng";

export class GameVehicle extends Vehicle {
  public entityId: string;
  
  constructor(id: string) {
    super();
    this.entityId = id;
  }
}

export class WanderBehavior extends SteeringBehavior {
  private wanderRadius: number = 50;
  private wanderDistance: number = 100;
  private wanderJitter: number = 20;
  private wanderTarget: Vector3 = new Vector3();
  private rng: Rng;

  constructor(seed: number) {
    super();
    this.rng = createRng(seed);
    const theta = this.rng.range(0, Math.PI * 2);
    this.wanderTarget.set(
      this.wanderRadius * Math.cos(theta),
      this.wanderRadius * Math.sin(theta),
      0
    );
  }

  calculate(vehicle: Vehicle, force: Vector3, _delta: number): Vector3 {
    this.wanderTarget.x += (this.rng.next() - 0.5) * this.wanderJitter;
    this.wanderTarget.y += (this.rng.next() - 0.5) * this.wanderJitter;
    this.wanderTarget.normalize().multiplyScalar(this.wanderRadius);
    
    const targetLocal = new Vector3(this.wanderDistance, 0, 0);
    targetLocal.add(this.wanderTarget);
    
    const targetWorld = targetLocal.applyMatrix4(vehicle.worldMatrix);
    
    force.subVectors(targetWorld, vehicle.position).normalize().multiplyScalar(vehicle.maxSpeed);
    return force.sub(vehicle.velocity);
  }
}

export class WrapPlayBandBehavior extends SteeringBehavior {
  private width: number;
  
  constructor(width: number) {
    super();
    this.width = width;
  }
  
  calculate(vehicle: Vehicle, force: Vector3, _delta: number): Vector3 {
    const leftBound = playBandMinX(this.width);
    const rightBound = playBandMaxX(this.width);
    
    if (vehicle.position.x < leftBound) {
      vehicle.position.x = rightBound;
    } else if (vehicle.position.x > rightBound) {
      vehicle.position.x = leftBound;
    }
    
    return force.set(0, 0, 0);
  }
}

/**
 * Enemy-sub hunting behaviour. Distinct from StalkAndDash — enemy subs
 * patrol a loose box until the player enters `detectionRadius`, then
 * commit to a short pursuit for `pursueSeconds`, then drop back to
 * patrol. Feels like a military sub instead of a feral predator: they
 * don't chase forever, they *engage*, then break off.
 */
export class EnemySubHuntBehavior extends SteeringBehavior {
  private target: Vector3;
  private baseSpeed: number;
  private detectionRadius: number;
  private pursueSpeed: number;
  private pursueSeconds: number;
  private cooldownSeconds: number;
  private state: "patrol" | "pursue" | "cooldown" = "patrol";
  private stateElapsed = 0;
  private patrolAnchor: Vector3;
  private patrolAnchorInitialized = false;
  private patrolPhase: number;
  private rng: Rng;

  constructor(target: Vector3, baseSpeed: number, detectionRadius: number, seed: number) {
    super();
    this.target = target;
    this.baseSpeed = baseSpeed;
    this.detectionRadius = detectionRadius;
    this.pursueSpeed = baseSpeed * 2.2;
    this.pursueSeconds = 2.5;
    this.cooldownSeconds = 3;
    this.rng = createRng(seed);
    this.patrolAnchor = new Vector3(0, 0, 0);
    this.patrolPhase = this.rng.range(0, Math.PI * 2);
  }

  calculate(vehicle: Vehicle, force: Vector3, delta: number): Vector3 {
    this.stateElapsed += delta;
    if (!this.patrolAnchorInitialized) {
      // First call — anchor the patrol around the sub's spawn position.
      // A boolean flag avoids the false-positive when a sub legitimately
      // spawns at world origin (squaredLength() === 0).
      this.patrolAnchor.copy(vehicle.position);
      this.patrolAnchorInitialized = true;
    }

    const toTarget = new Vector3().subVectors(this.target, vehicle.position);
    const distToPlayer = toTarget.length();

    switch (this.state) {
      case "patrol":
        if (distToPlayer < this.detectionRadius) {
          this.state = "pursue";
          this.stateElapsed = 0;
        }
        break;
      case "pursue":
        if (this.stateElapsed >= this.pursueSeconds) {
          this.state = "cooldown";
          this.stateElapsed = 0;
        }
        break;
      case "cooldown":
        if (this.stateElapsed >= this.cooldownSeconds) {
          this.state = "patrol";
          this.stateElapsed = 0;
        }
        break;
    }

    if (this.state === "pursue") {
      vehicle.maxSpeed = this.pursueSpeed;
      toTarget.normalize().multiplyScalar(vehicle.maxSpeed);
      force.copy(toTarget).sub(vehicle.velocity);
      return force;
    }

    // Patrol: orbit the anchor in a lazy ellipse whose phase drifts slowly.
    this.patrolPhase += delta * 0.5;
    const orbitRadius = 90;
    const targetX = this.patrolAnchor.x + Math.cos(this.patrolPhase) * orbitRadius;
    const targetY = this.patrolAnchor.y + Math.sin(this.patrolPhase * 0.8) * orbitRadius * 0.5;
    const orbit = new Vector3(targetX - vehicle.position.x, targetY - vehicle.position.y, 0);
    vehicle.maxSpeed = this.state === "cooldown" ? this.baseSpeed * 0.6 : this.baseSpeed;
    orbit.normalize().multiplyScalar(vehicle.maxSpeed);
    force.copy(orbit).sub(vehicle.velocity);
    return force;
  }
}

/**
 * StalkAndDashBehavior — predators with a real attention budget.
 *
 * Old version pursued forever inside detection range. That made
 * idle Exploration bleed oxygen at 2-3x because a predator that
 * caught sight of the player would camp on top of them, trigger
 * impact-grace cycles, and never disengage. Now they have a
 * state machine:
 *
 *   patrol  — drift on a sinusoid around their spawn position
 *   alert   — player just entered detection radius; close to stalk range
 *   commit  — short pursuit window, can dash if they get close
 *   cooldown — broke off, drift away from player for a few seconds
 *
 * The result feels like an animal that hunts, takes a swing, then
 * resets. Player has clear breathing room between contacts.
 */
export class StalkAndDashBehavior extends SteeringBehavior {
  private target: Vector3;
  private baseSpeed: number;
  private dashSpeed: number;
  private dashDistance: number;
  private detectionRadius: number;
  private wanderSeed: number;

  // State machine. Initial state is "patrol" — predator must SEE
  // the player before it changes course.
  private state: "patrol" | "alert" | "commit" | "cooldown" = "patrol";
  private stateElapsed = 0;
  // Per-instance tuning. Populated from seeded RNG ranges in the
  // constructor so two predators in the same dive don't move in
  // lockstep — and two dives with different seeds don't share their
  // hunting cadence at all. Exposed read-only so tests can drive the
  // state machine for the exact duration this instance picked.
  readonly commitSeconds: number;
  readonly cooldownSeconds: number;
  readonly alertToCommitSeconds: number;

  /**
   * @param target  Player vehicle's position vector (live ref, not snapshot)
   * @param baseSpeed  Per-instance base swim speed
   * @param seed  Predator's individual seed (subseeded from chunk + index)
   */
  constructor(target: Vector3, baseSpeed: number, seed: number) {
    super();
    this.target = target;
    this.baseSpeed = baseSpeed;
    const rng = createRng(seed);
    this.dashSpeed = baseSpeed * rng.range(2.0, 2.8);
    this.dashDistance = rng.range(140, 220);
    this.detectionRadius = rng.range(320, 440);
    this.commitSeconds = rng.range(1.2, 2.0);
    this.cooldownSeconds = rng.range(2.8, 4.2);
    this.alertToCommitSeconds = rng.range(0.4, 0.8);
    this.wanderSeed = rng.range(0, Math.PI * 2);
  }

  calculate(vehicle: Vehicle, force: Vector3, delta: number): Vector3 {
    this.stateElapsed += delta;
    const toTarget = new Vector3().subVectors(this.target, vehicle.position);
    const dist = toTarget.length();

    // State transitions.
    switch (this.state) {
      case "patrol":
        if (dist < this.detectionRadius) {
          this.state = "alert";
          this.stateElapsed = 0;
        }
        break;
      case "alert":
        if (dist > this.detectionRadius * 1.3) {
          this.state = "patrol";
          this.stateElapsed = 0;
        } else if (this.stateElapsed >= this.alertToCommitSeconds) {
          this.state = "commit";
          this.stateElapsed = 0;
        }
        break;
      case "commit":
        if (this.stateElapsed >= this.commitSeconds) {
          this.state = "cooldown";
          this.stateElapsed = 0;
        }
        break;
      case "cooldown":
        if (this.stateElapsed >= this.cooldownSeconds) {
          this.state = "patrol";
          this.stateElapsed = 0;
        }
        break;
    }

    if (this.state === "patrol") {
      // Drift on a slow loop, ignoring the player entirely. Speed
      // bumped from 0.4 → 0.7 so the predator looks like it's
      // *actually swimming around hunting*, not floating in place.
      // Wander phase advances on time so the loop doesn't stall when
      // the predator is at a fixed x.
      vehicle.maxSpeed = this.baseSpeed * 0.7;
      const t = vehicle.position.x * 0.0015 + this.wanderSeed;
      force.set(
        Math.cos(t) * vehicle.maxSpeed,
        Math.sin(t * 1.3) * vehicle.maxSpeed * 0.55,
        0,
      );
      force.sub(vehicle.velocity);
      return force;
    }

    if (this.state === "alert") {
      // Slow down, look at the player but don't close yet — gives
      // the player a clear visual tell that contact is coming.
      vehicle.maxSpeed = this.baseSpeed * 0.55;
      toTarget.normalize().multiplyScalar(vehicle.maxSpeed);
      force.copy(toTarget).sub(vehicle.velocity);
      return force;
    }

    if (this.state === "commit") {
      // Active pursuit window — dash if close, otherwise close in.
      if (dist < this.dashDistance) {
        vehicle.maxSpeed = this.dashSpeed;
      } else {
        vehicle.maxSpeed = this.baseSpeed * 1.4;
      }
      toTarget.normalize().multiplyScalar(vehicle.maxSpeed);
      force.copy(toTarget).sub(vehicle.velocity);
      return force;
    }

    // Cooldown: drift AWAY from the player so the next pass is
    // a clean re-engagement instead of a continuous nuisance.
    vehicle.maxSpeed = this.baseSpeed * 0.5;
    toTarget.normalize().multiplyScalar(-vehicle.maxSpeed);
    force.copy(toTarget).sub(vehicle.velocity);
    return force;
  }
}

/**
 * Player-aware flee. When the player is within `radius` of the
 * creature, push the creature away with a smooth-falloff force.
 *
 * Used as a SHARED instance per species (not per-creature) — matches
 * the AlignmentBehavior / CohesionBehavior / SeparationBehavior
 * wiring in AIManager.syncCreatures. `calculate` is pure w.r.t.
 * `this` beyond reading `radius` and `playerRef`.
 *
 * Force scales by `vehicle.maxSpeed` (not `vehicle.maxForce` which
 * defaults to 1 and would produce invisible nudges) — same shape
 * Yuka's WanderBehavior uses.
 *
 * NaN guards: if any of vehicle.position, player position, or radius
 * is non-finite, returns force unchanged.
 */
export class FleeFromPlayerBehavior extends SteeringBehavior {
  public radius: number;
  public playerRef: Vehicle | null = null;

  constructor(radiusPx: number) {
    super();
    this.radius = radiusPx;
  }

  calculate(vehicle: Vehicle, force: Vector3, _delta: number): Vector3 {
    if (!this.playerRef) return force;
    if (
      !Number.isFinite(vehicle.position.x) ||
      !Number.isFinite(vehicle.position.y) ||
      !Number.isFinite(this.playerRef.position.x) ||
      !Number.isFinite(this.playerRef.position.y) ||
      !Number.isFinite(this.radius)
    ) {
      return force;
    }

    const dx = vehicle.position.x - this.playerRef.position.x;
    const dy = vehicle.position.y - this.playerRef.position.y;
    const distSq = dx * dx + dy * dy;
    const r = this.radius;
    if (distSq >= r * r) return force;

    const dist = Math.sqrt(distSq);
    if (dist === 0) {
      // Coincident: no defined "away" direction. Leave force
      // unchanged — the school's other steering will move the
      // creature off-coincident next frame.
      return force;
    }

    // Smooth falloff: 1 at center, 0 at edge.
    const magnitude = 1 - dist / r;
    const invDist = 1 / dist;
    force.x += dx * invDist * magnitude * vehicle.maxSpeed;
    force.y += dy * invDist * magnitude * vehicle.maxSpeed;
    return force;
  }
}
