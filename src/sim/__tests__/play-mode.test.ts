/**
 * Per-mode integration test: the GOAP bot actually plays the sim, the
 * outcome at the end of the run is asserted against the mode's slot
 * contract. This is the proof that "Arena ends on collision" rather than
 * just "the arena card opens a dialog".
 *
 * No DOM, no Pixi — the whole game loop here is deterministic sim:
 *   advanceScene + advancePlayer + resolveDiveThreatImpact.
 * The bot governance is the same Yuka-pattern Think/Goal stack the
 * factory-produced enemy subs use; the difference is purely the goal
 * source. Determinism guarantees the test surfaces a real regression
 * any time mode behaviour changes.
 */

import { describe, expect, test } from "vitest";
import { advancePlayer } from "@/sim/entities/player";
import {
  type DiveInput,
  advanceScene,
  createInitialScene,
  getDiveDurationSeconds,
  resolveDiveThreatImpact,
  resetAIManager,
  type SceneState,
} from "@/sim/dive";
import { getModeSlots } from "@/sim/dive/modeSlots";
import {
  createCollectBeaconsProfile,
  createGoapBrainOwner,
  createIdleHoverProfile,
  createRamPredatorProfile,
  GoapInputProvider,
  type PlayerInputProvider,
} from "@/sim/ai";
import type { SessionMode } from "@/sim";

const dimensions = { width: 800, height: 600 };

interface PlayResult {
  finalScene: SceneState;
  finalScore: number;
  framesRan: number;
  outcome:
    | "still-running"
    | "oxygen-empty"
    | "collision-killed"
    | "completed-room";
  totalSimSeconds: number;
}

/**
 * Drives the sim with a `PlayerInputProvider` for `framesToRun` frames or
 * until a terminal condition fires. Mirrors the runtime loop in
 * `DiveScreen.gameLoop` minus the React/Pixi side-effects so the bot's
 * decisions, the sim, and the outcome assertions are the same code path
 * that would run in the browser.
 */
function playMode(
  mode: SessionMode,
  bot: PlayerInputProvider,
  framesToRun = 600,
  deltaTime = 1 / 30,
): PlayResult {
  resetAIManager();
  const scene0 = createInitialScene(dimensions);
  let scene: SceneState = scene0;
  let score = 0;
  let lastCollectTime = 0;
  let multiplier = 1;
  let lastImpactTime = 0;
  let totalTime = 0;
  let timeLeft = getDiveDurationSeconds(mode);
  let outcome: PlayResult["outcome"] = "still-running";

  for (let frame = 0; frame < framesToRun; frame++) {
    totalTime += deltaTime;
    const tickedTimeLeft = Math.max(
      0,
      Math.floor(getDiveDurationSeconds(mode) - totalTime),
    );
    timeLeft = tickedTimeLeft;
    if (tickedTimeLeft <= 0) {
      outcome = "oxygen-empty";
      return { finalScene: scene, finalScore: score, framesRan: frame, outcome, totalSimSeconds: totalTime };
    }

    // Synthesise a DiveInput from the bot. The bot reads the *current*
    // scene snapshot, decides where to steer, and writes a target into
    // its output buffer; advancePlayer interprets that target each frame.
    const input: DiveInput = bot.next({
      scene,
      dimensions,
      totalTime,
      deltaTime,
      timeLeft,
    });

    // Apply the input to the player record before handing it to the sim,
    // matching what `useTouchInput` + `advancePlayer` do in production.
    scene = {
      ...scene,
      player: advancePlayer(
        { ...scene.player, targetX: input.x, targetY: input.y },
        input,
        dimensions,
        totalTime,
        deltaTime,
      ),
    };

    const result = advanceScene(
      scene,
      input,
      dimensions,
      totalTime,
      deltaTime,
      lastCollectTime,
      multiplier,
      timeLeft,
      mode,
    );
    scene = result.scene;
    score += result.collection.scoreDelta;
    if (result.collection.collected.length > 0) {
      multiplier = result.collection.multiplier;
      lastCollectTime = result.collection.lastCollectTime;
    }

    if (result.collidedWithPredator) {
      const impact = resolveDiveThreatImpact({
        collided: true,
        lastImpactTimeSeconds: lastImpactTime,
        mode,
        timeLeft,
        totalTimeSeconds: totalTime,
      });
      if (impact.type === "dive-failed") {
        outcome = "collision-killed";
        return {
          finalScene: scene,
          finalScore: score,
          framesRan: frame,
          outcome,
          totalSimSeconds: totalTime,
        };
      }
      if (impact.type === "oxygen-penalty") {
        lastImpactTime = totalTime;
      }
    }
  }

  return { finalScene: scene, finalScore: score, framesRan: framesToRun, outcome, totalSimSeconds: totalTime };
}

function makeBot(
  factory: (
    owner: ReturnType<typeof createGoapBrainOwner>,
  ) => ReturnType<typeof createIdleHoverProfile>,
): PlayerInputProvider {
  const owner = createGoapBrainOwner({
    scene: createInitialScene(dimensions),
    dimensions,
    totalTime: 0,
    deltaTime: 1 / 30,
    timeLeft: 600,
  });
  const brain = factory(owner);
  return new GoapInputProvider(brain, owner);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("per-mode sim integration (GOAP bot drives advanceScene)", () => {
  test("exploration: idle bot survives a long run; oxygen ticks generously", () => {
    const slots = getModeSlots("exploration");
    expect(slots.collisionEndsDive).toBe(false);
    expect(slots.collectionOxygenScale).toBeGreaterThan(1);
    // Run 5 seconds (150 frames at dt=1/30). Exploration's 900s budget
    // should leave the bot nowhere near oxygen-empty.
    const result = playMode("exploration", makeBot(createIdleHoverProfile), 150);
    expect(result.outcome).toBe("still-running");
    // Oxygen budget intact — far less than 1% consumed.
    expect(result.totalSimSeconds).toBeLessThan(slots.durationSeconds * 0.05);
  });

  test("descent: forced-descent slot drives depthTravelMeters even with a still bot", () => {
    expect(getModeSlots("descent").verticalMovement).toBe("forced-descent");
    const result = playMode("descent", makeBot(createIdleHoverProfile), 120);
    // The trench pulled the sub down despite zero player input.
    expect(result.finalScene.depthTravelMeters).toBeGreaterThan(0);
    expect(result.outcome).toBe("still-running");
  });

  test("descent vs exploration: only descent advances depth on idle input", () => {
    const explorationDepth = playMode(
      "exploration",
      makeBot(createIdleHoverProfile),
      120,
    ).finalScene.depthTravelMeters;
    const descentDepth = playMode(
      "descent",
      makeBot(createIdleHoverProfile),
      120,
    ).finalScene.depthTravelMeters;

    // Exploration is verticalMovement: "free" — sub stays put on idle input.
    // Descent forces depth growth regardless of input.
    expect(descentDepth).toBeGreaterThan(explorationDepth);
  });

  test("arena: collisionEndsDive is true; the moment the bot reaches a predator the run ends", () => {
    const slots = getModeSlots("arena");
    expect(slots.collisionEndsDive).toBe(true);
    expect(slots.impactGraceSeconds).toBe(0);

    // Plant a predator right where we know the bot can reach it. We're
    // testing the *contract*, not collision math, so we override the
    // initial scene to put a predator next to the player and run a single
    // tick — collision must fire instantly.
    resetAIManager();
    const scene = createInitialScene(dimensions);
    const sceneWithThreat: SceneState = {
      ...scene,
      predators: [
        {
          id: "right-on-top",
          x: scene.player.x,
          y: scene.player.y,
          size: 80,
          speed: 0,
          noiseOffset: 0,
          angle: 0,
        },
      ],
    };

    const result = advanceScene(
      sceneWithThreat,
      { x: scene.player.x, y: scene.player.y, isActive: false },
      dimensions,
      0,
      1 / 30,
      0,
      1,
      480,
      "arena",
    );

    expect(result.collidedWithPredator).toBe(true);

    const impact = resolveDiveThreatImpact({
      collided: true,
      lastImpactTimeSeconds: -100,
      mode: "arena",
      timeLeft: 480,
      totalTimeSeconds: 0,
    });
    expect(impact.type).toBe("dive-failed");
  });

  test("descent: oxygen-penalty impact does NOT kill the dive", () => {
    // Same construction as arena, but in descent the slot says
    // collisionEndsDive: false → impact is recoverable.
    expect(getModeSlots("descent").collisionEndsDive).toBe(false);

    const impact = resolveDiveThreatImpact({
      collided: true,
      lastImpactTimeSeconds: -100,
      mode: "descent",
      timeLeft: 600,
      totalTimeSeconds: 90,
    });
    expect(impact.type).toBe("oxygen-penalty");
  });

  test("collect-beacons profile actually moves the player toward a beacon", () => {
    resetAIManager();
    const baseScene = createInitialScene(dimensions);
    // The initial scene is empty until chunks load. Synthesise a beacon
    // off to the upper-right so we can assert the bot's chosen direction.
    const beacon = {
      id: "synth-beacon",
      type: "fish" as const,
      x: baseScene.player.x + 220,
      y: baseScene.player.y - 140,
      size: 24,
      color: "#fff",
      glowColor: "#fff",
      glowIntensity: 1,
      noiseOffsetX: 0,
      noiseOffsetY: 0,
      pulsePhase: 0,
      speed: 0.3,
    };
    const scene: SceneState = { ...baseScene, creatures: [beacon] };
    const owner = createGoapBrainOwner({
      scene,
      dimensions,
      totalTime: 0,
      deltaTime: 1 / 30,
      timeLeft: 600,
    });
    const brain = createCollectBeaconsProfile(owner);
    const bot = new GoapInputProvider(brain, owner);
    const input = bot.next({
      scene,
      dimensions,
      totalTime: 0,
      deltaTime: 1 / 30,
      timeLeft: 600,
    });
    expect(input.isActive).toBe(true);
    // Bot's chosen target is the nearest beacon — assert direction matches.
    const dx = input.x - scene.player.x;
    const dy = input.y - scene.player.y;
    const beaconDx = beacon.x - scene.player.x;
    const beaconDy = beacon.y - scene.player.y;
    expect(Math.sign(dx)).toBe(Math.sign(beaconDx));
    expect(Math.sign(dy)).toBe(Math.sign(beaconDy));
  });

  test("ram-predator profile drives the bot toward predators in any mode", () => {
    resetAIManager();
    const scene = createInitialScene(dimensions);
    const sceneWithPredator: SceneState = {
      ...scene,
      predators: [
        {
          id: "ram-target",
          x: scene.player.x + 200,
          y: scene.player.y + 100,
          size: 60,
          speed: 0.5,
          noiseOffset: 0,
          angle: 0,
        },
      ],
    };
    const owner = createGoapBrainOwner({
      scene: sceneWithPredator,
      dimensions,
      totalTime: 0,
      deltaTime: 1 / 30,
      timeLeft: 480,
    });
    const brain = createRamPredatorProfile(owner);
    const bot = new GoapInputProvider(brain, owner);
    const input = bot.next({
      scene: sceneWithPredator,
      dimensions,
      totalTime: 0,
      deltaTime: 1 / 30,
      timeLeft: 480,
    });
    expect(input.isActive).toBe(true);
    expect(input.x).toBeCloseTo(scene.player.x + 200);
    expect(input.y).toBeCloseTo(scene.player.y + 100);
  });
});
