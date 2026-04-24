import { Vehicle, SteeringBehavior, Vector3 } from "yuka";
import { playBandMaxX, playBandMinX } from "@/sim/_shared/playBand";

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

  constructor() {
    super();
    const theta = Math.random() * Math.PI * 2;
    this.wanderTarget.set(
      this.wanderRadius * Math.cos(theta),
      this.wanderRadius * Math.sin(theta),
      0
    );
  }

  calculate(vehicle: Vehicle, force: Vector3, _delta: number): Vector3 {
    this.wanderTarget.x += (Math.random() - 0.5) * this.wanderJitter;
    this.wanderTarget.y += (Math.random() - 0.5) * this.wanderJitter;
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
