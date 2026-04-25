import { findNearestThreatDistance } from "@/sim/engine/collection";
import type { Creature, Player } from "@/sim/entities/types";
import type { GoapBrainOwner } from "../PlayerSubController";
import { Goal } from "./Goal";
import { GoalEvaluator } from "./GoalEvaluator";
import { Think } from "./Think";

/**
 * Concrete GOAP profiles. Each profile is a `Think` populated with
 * evaluators — the brain picks the best one each tick. The owner type is
 * always `GoapBrainOwner` so all profiles share one interface and tests
 * can swap them at runtime.
 *
 * Profiles never mutate scene state. They read `owner.observation` and
 * write a DiveInput onto `owner.output`. The sim then advances normally
 * with that synthetic input.
 */

interface Vec2 {
  x: number;
  y: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function findNearestBeacon(player: Player, creatures: Creature[]): Vec2 | null {
  let nearest: Vec2 | null = null;
  let bestDist = Infinity;
  for (const c of creatures) {
    const dx = c.x - player.x;
    const dy = c.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      nearest = { x: c.x, y: c.y };
    }
  }
  return nearest;
}

function nearestPredator(owner: GoapBrainOwner): Vec2 | null {
  const { player, predators } = owner.observation.scene;
  let best: Vec2 | null = null;
  let bestDist = Infinity;
  for (const p of predators) {
    const dx = p.x - player.x;
    const dy = p.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      best = { x: p.x, y: p.y };
    }
  }
  return best;
}

// ─── Goals ─────────────────────────────────────────────────────────────────

class HoldStillGoal extends Goal<GoapBrainOwner> {
  override execute(): void {
    this.owner.output = { x: 0, y: 0, isActive: false };
    // Permanent goal — never completes; brain rearbitrates only when a
    // higher-desirability evaluator wins.
  }
}

class SeekBeaconGoal extends Goal<GoapBrainOwner> {
  override execute(): void {
    const { scene } = this.owner.observation;
    const target = findNearestBeacon(scene.player, scene.creatures);
    if (!target) {
      this.status = "completed";
      return;
    }
    this.owner.output = { x: target.x, y: target.y, isActive: true };
  }
}

class FleeThreatGoal extends Goal<GoapBrainOwner> {
  override execute(): void {
    const { scene, dimensions } = this.owner.observation;
    const nearest = nearestPredator(this.owner);
    if (!nearest) {
      this.status = "completed";
      return;
    }
    const dx = scene.player.x - nearest.x;
    const dy = scene.player.y - nearest.y;
    const m = Math.hypot(dx, dy) || 1;
    const targetX = clamp(scene.player.x + (dx / m) * 200, 20, dimensions.width - 20);
    const targetY = clamp(scene.player.y + (dy / m) * 200, 20, dimensions.height - 20);
    this.owner.output = { x: targetX, y: targetY, isActive: true };
  }
}

class RamPredatorGoal extends Goal<GoapBrainOwner> {
  override execute(): void {
    const nearest = nearestPredator(this.owner);
    if (!nearest) {
      this.status = "completed";
      return;
    }
    this.owner.output = { x: nearest.x, y: nearest.y, isActive: true };
  }
}

// ─── Evaluators ────────────────────────────────────────────────────────────

class BrainEvaluator extends GoalEvaluator<GoapBrainOwner> {
  protected brain: Think<GoapBrainOwner>;
  constructor(brain: Think<GoapBrainOwner>, characterBias = 1) {
    super(characterBias);
    this.brain = brain;
  }
  // Subclass overrides; default is noop.
  calculateDesirability(_owner: GoapBrainOwner): number {
    return 0;
  }
  setGoal(_owner: GoapBrainOwner): void {
    /* override */
  }
  /** Drop the running subgoal and push a fresh one of the requested kind. */
  protected installGoal(goal: Goal<GoapBrainOwner>): void {
    this.brain.clearSubgoals();
    this.brain.addSubgoal(goal);
  }
}

class HoldStillEvaluator extends BrainEvaluator {
  override calculateDesirability(): number {
    return 0.05;
  }
  override setGoal(owner: GoapBrainOwner): void {
    this.installGoal(new HoldStillGoal(owner));
  }
}

class SeekBeaconEvaluator extends BrainEvaluator {
  override calculateDesirability(owner: GoapBrainOwner): number {
    const { scene, dimensions } = owner.observation;
    const target = findNearestBeacon(scene.player, scene.creatures);
    if (!target) return 0;
    const w = dimensions.width || 1;
    const distance = Math.hypot(target.x - scene.player.x, target.y - scene.player.y);
    return clamp(1 - distance / (w * 2), 0.1, 0.95);
  }
  override setGoal(owner: GoapBrainOwner): void {
    this.installGoal(new SeekBeaconGoal(owner));
  }
}

class FleeEvaluator extends BrainEvaluator {
  override calculateDesirability(owner: GoapBrainOwner): number {
    const distance = findNearestThreatDistance(
      owner.observation.scene.player,
      owner.observation.scene.predators,
    );
    if (distance === Infinity) return 0;
    return clamp(1.6 - distance / 140, 0, 1.6);
  }
  override setGoal(owner: GoapBrainOwner): void {
    this.installGoal(new FleeThreatGoal(owner));
  }
}

class RamEvaluator extends BrainEvaluator {
  override calculateDesirability(owner: GoapBrainOwner): number {
    return nearestPredator(owner) === null ? 0 : 1;
  }
  override setGoal(owner: GoapBrainOwner): void {
    this.installGoal(new RamPredatorGoal(owner));
  }
}

// ─── Profile factories ─────────────────────────────────────────────────────

/**
 * "Stand still and let the trench act on me." Useful for asserting forced
 * descent (descent mode), oxygen tick (all modes), and biome transitions
 * without coupling the test to navigation logic.
 */
export function createIdleHoverProfile(owner: GoapBrainOwner): Think<GoapBrainOwner> {
  const brain = new Think(owner);
  brain.addEvaluator(new HoldStillEvaluator(brain));
  return brain;
}

/**
 * "Collect beacons; flee when a predator is on me." Used by the
 * exploration-mode test to confirm long survival + score growth.
 */
export function createCollectBeaconsProfile(owner: GoapBrainOwner): Think<GoapBrainOwner> {
  const brain = new Think(owner);
  brain.addEvaluator(new SeekBeaconEvaluator(brain));
  brain.addEvaluator(new FleeEvaluator(brain, 0.9));
  brain.addEvaluator(new HoldStillEvaluator(brain));
  return brain;
}

/**
 * "Find the nearest predator and ram it." Used by the arena-mode test to
 * deliberately cause a collision and assert collisionEndsDive semantics.
 */
export function createRamPredatorProfile(owner: GoapBrainOwner): Think<GoapBrainOwner> {
  const brain = new Think(owner);
  brain.addEvaluator(new RamEvaluator(brain));
  brain.addEvaluator(new HoldStillEvaluator(brain));
  return brain;
}
