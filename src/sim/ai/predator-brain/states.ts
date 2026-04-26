/**
 * Predator brain states. Each extends Yuka's `State` so the
 * `StateMachine` calls enter/execute/exit at the right boundaries.
 *
 * The state catalogue:
 *
 * - **PatrolState** — wander a loose box around spawn. Low arousal, no
 *   awareness of the player. Transitions to Stalk on Vision detection.
 *
 * - **StalkState** — aware of the player. Closes in at stalkMaxSpeed
 *   while keeping an angle. Transitions to Charge when commitRadius
 *   met OR the FuzzyModule reports high desirability.
 *
 * - **ChargeState** — windup before strike. Speed drops, body coils.
 *   Ends after chargeWindupSeconds → Strike. If the player escapes
 *   the angle during windup, falls back to Stalk.
 *
 * - **StrikeState** — active lunge at strikeMaxSpeed. Brief, decisive.
 *   Always followed by Recover (no early-exit so the player gets a
 *   readable strike-then-recover rhythm).
 *
 * - **RecoverState** — disoriented post-strike. Sluggish, vulnerable.
 *   After recoverDurationSeconds, drops back to Patrol (re-entering
 *   Stalk requires the player to come back into vision).
 *
 * - **FleeState** — entered via MessageDispatcher when the brain
 *   takes damage from the player's lamp or a packmate dies nearby.
 *   Veers away from the player at strikeMaxSpeed for a brief window.
 *
 * - **AmbientState** — the leviathan's home state. Slow roam, oblivious
 *   to the player. Never transitions on its own; the brain's
 *   `isLeviathan` flag pins it here.
 *
 * Each state mutates the brain's steering manager weights to express
 * the active behaviour. The State subclasses don't import steering
 * primitives directly — they call methods on the brain so the
 * steering wiring stays centralised in PredatorBrain.
 */
import { State, Vector3 } from "yuka";
import type { PredatorBrain } from "./PredatorBrain";

export const PATROL = "patrol" as const;
export const STALK = "stalk" as const;
export const CHARGE = "charge" as const;
export const STRIKE = "strike" as const;
export const RECOVER = "recover" as const;
export const FLEE = "flee" as const;
export const AMBIENT = "ambient" as const;

const _scratch = new Vector3();

abstract class TimedState extends State<PredatorBrain> {
  /** Seconds elapsed since enter() */
  protected elapsed = 0;
  /** Subclasses set this in enter() to drive stateProgress. */
  protected duration = 1;

  enter(_owner: PredatorBrain): void {
    this.elapsed = 0;
  }

  /** Drive elapsed forward each tick. Called by subclasses. */
  protected tickElapsed(owner: PredatorBrain): void {
    this.elapsed += owner.lastDelta;
    owner.publishStateProgress(Math.min(1, this.elapsed / this.duration));
  }
}

export class PatrolState extends TimedState {
  enter(owner: PredatorBrain): void {
    super.enter(owner);
    this.duration = 999; // patrol is open-ended; progress is meaningless
    owner.activatePatrolBehaviour();
    owner.publishAiState("patrol");
  }

  execute(owner: PredatorBrain): void {
    this.tickElapsed(owner);
    owner.maintainPatrolAnchor();
    if (owner.canSeePlayer()) {
      owner.stateMachine.changeTo(STALK);
    }
  }

  exit(owner: PredatorBrain): void {
    owner.deactivatePatrolBehaviour();
  }
}

export class StalkState extends TimedState {
  enter(owner: PredatorBrain): void {
    super.enter(owner);
    this.duration = 999;
    owner.activateStalkBehaviour();
    owner.publishAiState("stalk");
    owner.broadcastEngage();
  }

  execute(owner: PredatorBrain): void {
    this.tickElapsed(owner);
    // If the brain entered stalk via a flank telegram, hold the
    // offset until it arrives — then drop to direct pursuit so the
    // commit comes from the flank position, not the original spawn
    // angle.
    owner.maintainFlankApproach();

    if (!owner.hasMemoryOfPlayer()) {
      owner.stateMachine.changeTo(PATROL);
      return;
    }

    if (owner.distanceToPlayer() <= owner.effectiveCommitRadius()) {
      owner.stateMachine.changeTo(CHARGE);
      return;
    }

    if (owner.fuzzyAttackDesirability() > 0.65 && owner.canSeePlayer()) {
      owner.stateMachine.changeTo(CHARGE);
    }
  }

  exit(owner: PredatorBrain): void {
    owner.deactivateStalkBehaviour();
  }
}

export class ChargeState extends TimedState {
  /** Player position locked at charge-start so the windup commits to
   *  a vector instead of tracking — that's what makes lunges *readable*. */
  private chargeTarget = new Vector3();

  enter(owner: PredatorBrain): void {
    super.enter(owner);
    this.duration = owner.effectiveChargeWindup();
    this.chargeTarget.copy(owner.lastKnownPlayerPosition);
    owner.activateChargeBehaviour(this.chargeTarget);
    owner.publishAiState("charge");
  }

  execute(owner: PredatorBrain): void {
    this.tickElapsed(owner);
    if (this.elapsed >= this.duration) {
      owner.stateMachine.changeTo(STRIKE);
    }
  }

  exit(owner: PredatorBrain): void {
    owner.deactivateChargeBehaviour();
  }
}

export class StrikeState extends TimedState {
  private strikeVector = new Vector3();

  enter(owner: PredatorBrain): void {
    super.enter(owner);
    this.duration = owner.profile.strikeDurationSeconds;
    // Lock the strike vector at strike-start. After this point the
    // player can sidestep — that's the whole point of telegraphs.
    _scratch.copy(owner.lastKnownPlayerPosition).sub(owner.position);
    const len = _scratch.length();
    if (len > 0) _scratch.divideScalar(len);
    this.strikeVector.copy(_scratch);
    owner.activateStrikeBehaviour(this.strikeVector);
    owner.publishAiState("strike");
  }

  execute(owner: PredatorBrain): void {
    this.tickElapsed(owner);
    if (this.elapsed >= this.duration) {
      owner.stateMachine.changeTo(RECOVER);
    }
  }

  exit(owner: PredatorBrain): void {
    owner.deactivateStrikeBehaviour();
    // Hunger reset: a strike was attempted (regardless of hit). The
    // brain returns to its baseline aggression and ramps up again
    // only if it goes 30+ seconds without another committed strike.
    owner.lastStrikeAttemptTime = owner.currentTime;
  }
}

export class RecoverState extends TimedState {
  enter(owner: PredatorBrain): void {
    super.enter(owner);
    this.duration = owner.profile.recoverDurationSeconds;
    owner.activateRecoverBehaviour();
    owner.publishAiState("recover");
  }

  execute(owner: PredatorBrain): void {
    this.tickElapsed(owner);
    if (this.elapsed >= this.duration) {
      owner.stateMachine.changeTo(PATROL);
    }
  }

  exit(owner: PredatorBrain): void {
    owner.deactivateRecoverBehaviour();
  }
}

export class FleeState extends TimedState {
  enter(owner: PredatorBrain): void {
    super.enter(owner);
    this.duration = owner.profile.fleeDurationSeconds;
    owner.activateFleeBehaviour();
    owner.publishAiState("flee");
  }

  execute(owner: PredatorBrain): void {
    this.tickElapsed(owner);
    if (this.elapsed >= this.duration) {
      owner.stateMachine.changeTo(PATROL);
    }
  }

  exit(owner: PredatorBrain): void {
    owner.deactivateFleeBehaviour();
  }
}

export class AmbientState extends TimedState {
  enter(owner: PredatorBrain): void {
    super.enter(owner);
    this.duration = 999;
    owner.activateAmbientBehaviour();
    owner.publishAiState("ambient");
  }

  execute(owner: PredatorBrain): void {
    this.tickElapsed(owner);
  }

  exit(owner: PredatorBrain): void {
    owner.deactivateAmbientBehaviour();
  }
}
