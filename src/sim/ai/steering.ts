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

export class StalkAndDashBehavior extends SteeringBehavior {
  private target: Vector3;
  private baseSpeed: number;
  private dashSpeed: number;
  private dashDistance: number;
  private stalkDistance: number;
  
  constructor(target: Vector3, baseSpeed: number) {
    super();
    this.target = target;
    this.baseSpeed = baseSpeed;
    this.dashSpeed = baseSpeed * 2.8; // Huge burst of speed
    this.dashDistance = 240; // Starts dash when close
    this.stalkDistance = 450; // Slows down to match speed when in this band
  }

  calculate(vehicle: Vehicle, force: Vector3, _delta: number): Vector3 {
    const toTarget = new Vector3().subVectors(this.target, vehicle.position);
    const dist = toTarget.length();

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
