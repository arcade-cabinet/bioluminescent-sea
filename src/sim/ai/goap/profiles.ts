import type { Creature, Player, Predator } from "@/sim/entities/types";
import type { GoapBrainOwner } from "../PlayerSubController";
import {
  PLAYER_PERCEPTION_PROFILE,
  perceives,
  type PerceptionContext,
} from "../perception/perception";
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
 *
 * Perception: every helper filters scene contents through the
 * `observation.perception` context BEFORE iterating. The bot reasons
 * only about creatures and predators a real player could see at this
 * tick — radius, cone (omnidirectional for the player), and LoS.
 *
 * Fallback: when `observation.perception` is undefined (test fixtures
 * that don't set it up), helpers degrade to direct scene reads. This
 * keeps the older per-mode integration tests green; production runtime
 * always supplies perception via `AIManager.update`.
 */

interface Vec2 {
  x: number;
  y: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Filter targets the player can perceive. The perception context is
 * always non-null (PlayerSubObservation requires it); an empty
 * occluder list is the safe default for tests that don't care about
 * LoS — only radius + cone are checked then.
 */
function visibleTargets<T extends { x: number; y: number }>(
  perception: PerceptionContext,
  player: Player,
  targets: readonly T[],
): readonly T[] {
  const perceiver = { x: player.x, y: player.y, headingRad: player.angle };
  return targets.filter((t) => perceives(perception, perceiver, PLAYER_PERCEPTION_PROFILE, t));
}

function findNearestPerceived<T extends { x: number; y: number }>(
  player: Player,
  visible: readonly T[],
): Vec2 | null {
  let nearest: Vec2 | null = null;
  let bestDist = Infinity;
  for (const t of visible) {
    const dx = t.x - player.x;
    const dy = t.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      nearest = { x: t.x, y: t.y };
    }
  }
  return nearest;
}

function findNearestBeacon(owner: GoapBrainOwner): Vec2 | null {
  const { scene, perception } = owner.observation;
  const visible = visibleTargets(perception, scene.player, scene.creatures);
  return findNearestPerceived(scene.player, visible as Creature[]);
}

function nearestPredator(owner: GoapBrainOwner): Vec2 | null {
  const { scene, perception } = owner.observation;
  const visible = visibleTargets(perception, scene.player, scene.predators);
  return findNearestPerceived(scene.player, visible as Predator[]);
}

/**
 * Distance to the nearest perceived predator, or Infinity if none. The
 * pre-perception engine helper `findNearestThreatDistance` was
 * omniscient — it iterated `scene.predators` directly. We replace its
 * use with a perception-filtered version local to this module.
 */
function nearestPerceivedThreatDistance(owner: GoapBrainOwner): number {
  const { scene, perception } = owner.observation;
  const visible = visibleTargets(perception, scene.player, scene.predators);
  let best = Infinity;
  for (const p of visible) {
    const dx = p.x - scene.player.x;
    const dy = p.y - scene.player.y;
    const d = Math.hypot(dx, dy);
    if (d < best) best = d;
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
    const target = findNearestBeacon(this.owner);
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
    const target = findNearestBeacon(owner);
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
    const distance = nearestPerceivedThreatDistance(owner);
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
