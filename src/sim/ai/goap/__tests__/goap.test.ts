import { describe, expect, test } from "vitest";
import { createInitialScene } from "@/sim/engine/advance";
import {
  createCollectBeaconsProfile,
  createIdleHoverProfile,
  createRamPredatorProfile,
} from "../profiles";
import { Goal } from "../Goal";
import { CompositeGoal } from "../CompositeGoal";
import { Think } from "../Think";
import { GoalEvaluator } from "../GoalEvaluator";
import {
  type GoapBrainOwner,
  type PlayerSubObservation,
  createGoapBrainOwner,
} from "../../PlayerSubController";

const dimensions = { width: 800, height: 600 };

function makeOwner(overrides: Partial<PlayerSubObservation> = {}): GoapBrainOwner {
  const scene = createInitialScene(dimensions);
  return createGoapBrainOwner({
    scene: { ...scene, creatures: scene.creatures, predators: scene.predators },
    dimensions,
    deltaTime: 1 / 60,
    timeLeft: 600,
      perception: { occluders: [] },
    totalTime: 0,
    ...overrides,
  });
}

describe("GOAP base classes", () => {
  test("Goal moves through inactive → active → terminate via activateIfInactive", () => {
    const owner = makeOwner();
    let activated = false;
    let terminated = false;
    class Test extends Goal<GoapBrainOwner> {
      override activate(): void {
        activated = true;
      }
      override terminate(): void {
        terminated = true;
      }
    }
    const g = new Test(owner);
    expect(g.inactive()).toBe(true);
    g.activateIfInactive();
    expect(g.active()).toBe(true);
    expect(activated).toBe(true);
    g.terminate();
    expect(terminated).toBe(true);
  });

  test("CompositeGoal runs the back-of-array goal and pops it on completion", () => {
    // Yuka semantic: the goal at `subgoals[length-1]` runs first. Once it
    // completes, the head of the next executeSubgoals call pops it.
    const owner = makeOwner();
    class OneShot extends Goal<GoapBrainOwner> {
      override execute(): void {
        this.status = "completed";
      }
    }
    const cg = new CompositeGoal<GoapBrainOwner>(owner);
    cg.addSubgoal(new OneShot(owner));
    expect(cg.subgoals.length).toBe(1);

    // Tick 1: the goal runs, completes. Still in the list (popped lazily).
    cg.executeSubgoals();
    // Tick 2: the cleanup loop pops the completed goal.
    cg.executeSubgoals();
    expect(cg.subgoals.length).toBe(0);
  });

  test("CompositeGoal cleanup loop pops multiple completed goals at once", () => {
    const owner = makeOwner();
    class Done extends Goal<GoapBrainOwner> {
      constructor(o: GoapBrainOwner) {
        super(o);
        this.status = "completed"; // pre-completed
      }
    }
    class Live extends Goal<GoapBrainOwner> {
      override execute(): void {
        // stays active forever
      }
    }
    const cg = new CompositeGoal<GoapBrainOwner>(owner);
    const live = new Live(owner);
    cg.addSubgoal(live); // back of array — would normally run first
    cg.addSubgoal(new Done(owner));
    cg.addSubgoal(new Done(owner));
    expect(cg.subgoals.length).toBe(3);

    // First execute: cleanup loop pops zero (back is `live`, still active),
    // ticks live. live still active — but the two pre-completed goals are
    // sitting at the front of the list. Yuka only pops from the back, so
    // they remain. This proves the back-only popping behaviour.
    cg.executeSubgoals();
    expect(cg.subgoals.length).toBe(3);
    expect(cg.currentSubgoal()).toBe(live);
  });

  test("Think.arbitrate picks the highest-desirability evaluator", () => {
    const owner = makeOwner();
    const calls: string[] = [];
    class Lo extends GoalEvaluator<GoapBrainOwner> {
      calculateDesirability(): number {
        return 0.1;
      }
      setGoal(): void {
        calls.push("lo");
      }
    }
    class Hi extends GoalEvaluator<GoapBrainOwner> {
      calculateDesirability(): number {
        return 0.9;
      }
      setGoal(): void {
        calls.push("hi");
      }
    }
    const brain = new Think(owner);
    brain.addEvaluator(new Lo());
    brain.addEvaluator(new Hi());
    brain.arbitrate();
    expect(calls).toEqual(["hi"]);
  });

  test("characterBias scales evaluator desirability", () => {
    const owner = makeOwner();
    const calls: string[] = [];
    class A extends GoalEvaluator<GoapBrainOwner> {
      calculateDesirability(): number {
        return 0.5;
      }
      setGoal(): void {
        calls.push("a");
      }
    }
    class B extends GoalEvaluator<GoapBrainOwner> {
      calculateDesirability(): number {
        return 0.4;
      }
      setGoal(): void {
        calls.push("b");
      }
    }
    const brain = new Think(owner);
    brain.addEvaluator(new A(0.5)); // 0.25 effective
    brain.addEvaluator(new B(2)); // 0.8 effective
    brain.arbitrate();
    expect(calls).toEqual(["b"]);
  });
});

describe("GOAP profiles", () => {
  test("idle-hover profile keeps emitting no-input forever", () => {
    const owner = makeOwner();
    const brain = createIdleHoverProfile(owner);
    brain.execute();
    expect(owner.output).toEqual({ x: 0, y: 0, isActive: false });
    brain.execute();
    expect(owner.output).toEqual({ x: 0, y: 0, isActive: false });
  });

  test("collect-beacons profile aims toward the nearest creature", () => {
    const owner = makeOwner({
      scene: {
        ...createInitialScene(dimensions),
        creatures: [
          {
            id: "b1",
            type: "fish",
            x: 600,
            y: 400,
            size: 24,
            color: "#fff",
            glowColor: "#fff",
            glowIntensity: 1,
            noiseOffsetX: 0,
            noiseOffsetY: 0,
            pulsePhase: 0,
            speed: 0.3,
          },
        ],
      },
    });
    const brain = createCollectBeaconsProfile(owner);
    brain.execute();
    expect(owner.output.isActive).toBe(true);
    expect(owner.output.x).toBeCloseTo(600);
    expect(owner.output.y).toBeCloseTo(400);
  });

  test("collect-beacons profile flees when a predator is closer than the threshold", () => {
    const scene = createInitialScene(dimensions);
    const owner = makeOwner({
      scene: {
        ...scene,
        creatures: [
          // beacon present but far away
          {
            id: "b1",
            type: "fish",
            x: 700,
            y: 500,
            size: 24,
            color: "#fff",
            glowColor: "#fff",
            glowIntensity: 1,
            noiseOffsetX: 0,
            noiseOffsetY: 0,
            pulsePhase: 0,
            speed: 0.3,
          },
        ],
        predators: [
          // predator is 50px right of the player at the same Y
          {
            id: "p1",
            x: scene.player.x + 50,
            y: scene.player.y,
            size: 60,
            angle: 0,
            noiseOffset: 0,
            speed: 0.5,
          },
        ],
      },
    });
    const brain = createCollectBeaconsProfile(owner);
    brain.execute();
    // The flee target is to the LEFT of the player (away from the predator).
    expect(owner.output.x).toBeLessThan(scene.player.x);
  });

  test("ram-predator profile aims directly at the nearest predator", () => {
    const scene = createInitialScene(dimensions);
    const predator = {
      id: "p1",
      x: scene.player.x + 200,
      y: scene.player.y - 100,
      size: 60,
      angle: 0,
      noiseOffset: 0,
      speed: 0.5,
    };
    const owner = makeOwner({
      scene: { ...scene, predators: [predator] },
    });
    const brain = createRamPredatorProfile(owner);
    brain.execute();
    expect(owner.output.isActive).toBe(true);
    expect(owner.output.x).toBeCloseTo(predator.x);
    expect(owner.output.y).toBeCloseTo(predator.y);
  });
});
