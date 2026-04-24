import { EntityManager, Time, SeekBehavior } from "yuka";
import type { Player, Predator, Pirate } from "@/sim/entities/types";
import { GameVehicle, WanderBehavior, WrapPlayBandBehavior } from "./steering";
import type { ViewportDimensions } from "@/sim/dive/types";

export class AIManager {
  public entityManager: EntityManager;
  public time: Time;
  private playerVehicle: GameVehicle;
  private vehicleMap: Map<string, GameVehicle>;
  private viewportWidth: number;

  constructor(viewport: ViewportDimensions) {
    this.entityManager = new EntityManager();
    this.time = new Time();
    this.vehicleMap = new Map();
    this.viewportWidth = viewport.width;
    
    this.playerVehicle = new GameVehicle("player");
    this.playerVehicle.position.set(0, 0, 0);
    this.entityManager.add(this.playerVehicle);
  }

  updatePlayer(player: Player) {
    this.playerVehicle.position.set(player.x, player.y, 0);
  }

  syncPredators(predators: Predator[]) {
    for (const p of predators) {
      let vehicle = this.vehicleMap.get(p.id);
      if (!vehicle) {
        vehicle = new GameVehicle(p.id);
        vehicle.position.set(p.x, p.y, 0); // Initialize position!
        vehicle.maxSpeed = p.speed * 60;
        
        const seek = new SeekBehavior(this.playerVehicle.position);
        vehicle.steering.add(seek);
        
        const wrap = new WrapPlayBandBehavior(this.viewportWidth);
        vehicle.steering.add(wrap);
        
        this.entityManager.add(vehicle);
        this.vehicleMap.set(p.id, vehicle);
      }
    }
  }

  syncPirates(pirates: Pirate[]) {
    for (const p of pirates) {
      let vehicle = this.vehicleMap.get(p.id);
      if (!vehicle) {
        vehicle = new GameVehicle(p.id);
        vehicle.position.set(p.x, p.y, 0); // Initialize position!
        vehicle.maxSpeed = p.speed * 60;
        
        const wander = new WanderBehavior();
        vehicle.steering.add(wander);
        
        const wrap = new WrapPlayBandBehavior(this.viewportWidth);
        vehicle.steering.add(wrap);
        
        this.entityManager.add(vehicle);
        this.vehicleMap.set(p.id, vehicle);
      }
    }
  }

  update(deltaTime: number) {
    this.time.update();
    this.entityManager.update(deltaTime);
  }

  readPredator(p: Predator): Predator {
    const vehicle = this.vehicleMap.get(p.id);
    if (!vehicle) return p;
    
    return {
      ...p,
      x: vehicle.position.x,
      y: vehicle.position.y,
      angle: Math.atan2(vehicle.velocity.y, vehicle.velocity.x),
    };
  }

  readPirate(p: Pirate): Pirate {
    const vehicle = this.vehicleMap.get(p.id);
    if (!vehicle) return p;

    return {
      ...p,
      x: vehicle.position.x,
      y: vehicle.position.y,
      angle: Math.atan2(vehicle.velocity.y, vehicle.velocity.x),
    };
  }
}
