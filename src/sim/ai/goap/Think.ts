import { CompositeGoal } from "./CompositeGoal";
import type { GoalEvaluator } from "./GoalEvaluator";

/**
 * The brain — picks the highest-desirability goal each arbitration tick
 * and installs it as the current subgoal. Identical conceptually to
 * Yuka's Think but generic over owner type and free of UUID plumbing.
 */
export class Think<TOwner> extends CompositeGoal<TOwner> {
  evaluators: GoalEvaluator<TOwner>[] = [];

  addEvaluator(evaluator: GoalEvaluator<TOwner>): this {
    this.evaluators.push(evaluator);
    return this;
  }

  removeEvaluator(evaluator: GoalEvaluator<TOwner>): this {
    const idx = this.evaluators.indexOf(evaluator);
    if (idx >= 0) this.evaluators.splice(idx, 1);
    return this;
  }

  /** Find the highest-desirability evaluator and let it install its goal. */
  arbitrate(): this {
    let bestDesirability = -1;
    let bestEvaluator: GoalEvaluator<TOwner> | null = null;

    for (const evaluator of this.evaluators) {
      const score = evaluator.calculateDesirability(this.owner) * evaluator.characterBias;
      if (score >= bestDesirability) {
        bestDesirability = score;
        bestEvaluator = evaluator;
      }
    }

    if (bestEvaluator !== null) {
      bestEvaluator.setGoal(this.owner);
    }

    return this;
  }

  override activate(): void {
    this.arbitrate();
  }

  override execute(): void {
    this.activateIfInactive();
    const status = this.executeSubgoals();
    if (status === "completed" || status === "failed") {
      this.status = "inactive";
    }
  }

  override terminate(): void {
    this.clearSubgoals();
  }
}
