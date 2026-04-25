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

export class StalkAndDashBehavior extends SteeringBehavior {
  private target: Vector3;
  private baseSpeed: number;
  private dashSpeed: number;
  private dashDistance: number;
  private stalkDistance: number;
  private detectionRadius: number;
  // Per-instance phase so out-of-detection drift differs across
  // predators in the same chunk.
  private wanderSeed: number;

  constructor(target: Vector3, baseSpeed: number) {
    super();
    this.target = target;
    this.baseSpeed = baseSpeed;
    this.dashSpeed = baseSpeed * 2.8; // Huge burst of speed
    this.dashDistance = 240; // Starts dash when close
    this.stalkDistance = 450; // Slows down to match speed when in this band
    // Beyond this radius the predator drifts on its own loop instead
    // of beelining toward the player. Tightened to 380px after live-
    // QA showed 700 still pulled chunk-0 spawns into immediate
    // pursuit on small viewports. 380 ≈ half a phone-portrait
    // viewport height; the chunk-0 carve-out (30% of height away
    // from the player) keeps fresh spawns out of range.
    this.detectionRadius = 380;
    // Seed the wander phase off the predator's spawn-time speed so
    // each predator drifts on a different orbit. Avoids Math.random()
    // (the sim layer must stay deterministic) without needing a full
    // RNG plumb-through.
    this.wanderSeed = (baseSpeed * 7919) % (Math.PI * 2);
  }

  calculate(vehicle: Vehicle, force: Vector3, _delta: number): Vector3 {
    const toTarget = new Vector3().subVectors(this.target, vehicle.position);
    const dist = toTarget.length();

    // Out of detection range: drift on a slow sinusoid so predators
    // patrol their pocket rather than beelining for the player.
    if (dist > this.detectionRadius) {
      vehicle.maxSpeed = this.baseSpeed * 0.45;
      const t = vehicle.position.x * 0.001 + this.wanderSeed;
      force.set(
        Math.cos(t) * vehicle.maxSpeed,
        Math.sin(t * 1.3) * vehicle.maxSpeed * 0.5,
        0,
      );
      force.sub(vehicle.velocity);
      return force;
    }

    if (dist < this.dashDistance) {
      vehicle.maxSpeed = this.dashSpeed;
    } else if (dist < this.stalkDistance) {
      // Stalking: match speed or go slightly slower than base to "hover"
      vehicle.maxSpeed = this.baseSpeed * 0.6;
    } else {
      // Catching up
      vehicle.maxSpeed = this.baseSpeed * 1.2;
    }

    toTarget.normalize().multiplyScalar(vehicle.maxSpeed);
    force.copy(toTarget).sub(vehicle.velocity);
    return force;
  }
}
