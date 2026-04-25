import type { Goal } from "./Goal";

/**
 * Calculates how desirable its goal is for the current owner state. The
 * Think brain picks the highest-desirability evaluator each tick and asks
 * it to install its goal as the brain's next subgoal.
 *
 * `characterBias` lets a single content profile express personality — a
 * timid bot weights `Flee` higher, a greedy bot weights `Collect`. Same
 * machinery, different bias.
 */
export abstract class GoalEvaluator<TOwner> {
  characterBias: number;

  constructor(characterBias = 1) {
    this.characterBias = characterBias;
  }

  /** Pure function of owner state; must be deterministic for tests. */
  abstract calculateDesirability(owner: TOwner): number;

  /** Install the chosen goal on the brain's owner. */
  abstract setGoal(owner: TOwner): void;
}

export type EvaluatorFor<TOwner> = GoalEvaluator<TOwner>;

/** Convenience type alias used by Think for its currently-running goal. */
export type ActiveGoal<TOwner> = Goal<TOwner>;
