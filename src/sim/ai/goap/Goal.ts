/**
 * Goal-driven agent design — TypeScript port of the small Yuka goal stack.
 *
 * The Yuka reference (~/src/reference-codebases/yuka/src/goal/) ships
 * `Goal`, `CompositeGoal`, `GoalEvaluator`, and `Think` as JS classes
 * intertwined with `GameEntity` uuid plumbing. We only need the FSM +
 * subgoal stack semantics, so this module re-implements just that surface
 * with strong typing and zero engine coupling. The owner is generic so
 * the same Goal/Think machinery serves the player sub, enemy subs, or
 * any future factory-produced controller.
 */

export type GoalStatus = "inactive" | "active" | "completed" | "failed";

export class Goal<TOwner> {
  owner: TOwner;
  status: GoalStatus = "inactive";

  constructor(owner: TOwner) {
    this.owner = owner;
  }

  /** Called once when the goal transitions inactive → active. */
  activate(): void {
    /* override */
  }

  /** Called every tick while the goal is active. Status mutates here. */
  execute(): void {
    /* override */
  }

  /** Called when the goal terminates (completed, failed, or cleared). */
  terminate(): void {
    /* override */
  }

  active(): boolean {
    return this.status === "active";
  }

  inactive(): boolean {
    return this.status === "inactive";
  }

  completed(): boolean {
    return this.status === "completed";
  }

  failed(): boolean {
    return this.status === "failed";
  }

  replanIfFailed(): void {
    if (this.failed()) this.status = "inactive";
  }

  activateIfInactive(): void {
    if (this.inactive()) {
      this.status = "active";
      this.activate();
    }
  }
}
