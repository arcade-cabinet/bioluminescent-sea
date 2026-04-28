import type { DiveInput, SceneState, ViewportDimensions } from "@/sim/dive/types";
import type { PerceptionContext } from "./perception/perception";
import { Think } from "./goap/Think";

/**
 * The player sub is governed the same way enemy subs are: a tickable
 * controller that reads the world and emits a per-frame DiveInput. The
 * source of that input is pluggable.
 *
 * Production: a `TouchInputProvider` reads pointer events and writes the
 *   `targetX/targetY` straight onto the player record. The controller is
 *   effectively a passthrough.
 *
 * Tests / autoplay: a `GoapInputProvider` runs a `Think` brain whose
 *   evaluators inspect the scene and produce a synthetic DiveInput. The
 *   same governance enemy subs use, just driving the player record.
 *
 * The sim never imports Yuka — `Vehicle` ownership stays in `AIManager`.
 * The controller speaks plain `DiveInput` so all callers can substitute
 * one input source for another without touching the sim.
 */

export interface PlayerSubObservation {
  scene: SceneState;
  dimensions: ViewportDimensions;
  totalTime: number;
  deltaTime: number;
  /** Seconds remaining in the current dive — bots can panic when low. */
  timeLeft: number;
  /**
   * Perception context for THIS tick. Populated by `AIManager.update`
   * before any provider's `next()` is called. The GOAP brain reads
   * scene contents only through `perception.perceives(...)` so the
   * bot governance is faithful to what a player can see.
   *
   * Optional because tests / fixtures may construct an observation
   * without a perception layer; production runtime always supplies it.
   */
  perception?: PerceptionContext;
}

export interface PlayerInputProvider {
  /** Compute a DiveInput for this frame given everything the bot can see. */
  next(observation: PlayerSubObservation): DiveInput;
}

/**
 * Headless-friendly: produces an idle DiveInput. Useful as the safe
 * default while a real provider is being wired up.
 */
export class IdleInputProvider implements PlayerInputProvider {
  next(): DiveInput {
    return { x: 0, y: 0, isActive: false };
  }
}

/**
 * Wraps a `Think` brain whose evaluators write a DiveInput on the owner.
 * The brain ticks once per `next()` and the resulting input is read off
 * the controller's output buffer.
 */
export class GoapInputProvider implements PlayerInputProvider {
  brain: Think<GoapBrainOwner>;
  owner: GoapBrainOwner;

  constructor(brain: Think<GoapBrainOwner>, owner: GoapBrainOwner) {
    this.brain = brain;
    this.owner = owner;
  }

  next(observation: PlayerSubObservation): DiveInput {
    this.owner.observation = observation;
    this.owner.output = { x: 0, y: 0, isActive: false };
    this.brain.execute();
    return this.owner.output;
  }
}

/**
 * The shared mutable surface evaluators and goals read/write each tick.
 * Goals never mutate the scene — they pull values out of `observation`
 * and write the chosen `DiveInput` to `output`.
 */
export interface GoapBrainOwner {
  observation: PlayerSubObservation;
  output: DiveInput;
}

export function createGoapBrainOwner(
  observation: PlayerSubObservation,
): GoapBrainOwner {
  return { observation, output: { x: 0, y: 0, isActive: false } };
}
