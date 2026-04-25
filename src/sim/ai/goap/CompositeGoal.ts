import { Goal } from "./Goal";

/**
 * A goal whose body is a stack of subgoals. Subgoals are executed
 * top-of-stack first; completed/failed subgoals are popped and the next
 * one runs. Used by Think (the brain) and by any compound plan a
 * GoalEvaluator builds.
 */
export class CompositeGoal<TOwner> extends Goal<TOwner> {
  subgoals: Goal<TOwner>[] = [];

  /** Push a subgoal on top of the stack — it runs *next*. */
  addSubgoal(goal: Goal<TOwner>): this {
    this.subgoals.unshift(goal);
    return this;
  }

  removeSubgoal(goal: Goal<TOwner>): this {
    const idx = this.subgoals.indexOf(goal);
    if (idx >= 0) this.subgoals.splice(idx, 1);
    return this;
  }

  clearSubgoals(): this {
    for (const subgoal of this.subgoals) {
      subgoal.terminate();
    }
    this.subgoals.length = 0;
    return this;
  }

  /** Top-of-stack subgoal — the one that's actually running. */
  currentSubgoal(): Goal<TOwner> | null {
    if (this.subgoals.length === 0) return null;
    return this.subgoals[this.subgoals.length - 1];
  }

  /**
   * Mirrors Yuka's executeSubgoals: pop completed/failed goals from the
   * back of the list, then tick the new top. Returns the active subgoal's
   * status so the parent can react.
   */
  executeSubgoals(): GoalStatusOrCompleted {
    // Drop any completed/failed goals at the back of the queue.
    for (let i = this.subgoals.length - 1; i >= 0; i--) {
      const subgoal = this.subgoals[i];
      if (subgoal.completed() || subgoal.failed()) {
        if (subgoal instanceof CompositeGoal) {
          subgoal.clearSubgoals();
        }
        subgoal.terminate();
        this.subgoals.pop();
      } else {
        break;
      }
    }

    const subgoal = this.currentSubgoal();
    if (!subgoal) return "completed";

    subgoal.activateIfInactive();
    subgoal.execute();

    // Composite-of-composite: keep ticking even if the inner goal just
    // finished, so the next subgoal in the stack gets activated this frame.
    if (subgoal.completed() && this.subgoals.length > 1) {
      return "active";
    }

    return subgoal.status;
  }
}

type GoalStatusOrCompleted =
  | "inactive"
  | "active"
  | "completed"
  | "failed";
