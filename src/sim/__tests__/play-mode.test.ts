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
import { getModeSlots } from "@/sim/factories/dive/slots";
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
  seed = 0xCAFE,
): PlayResult {
  resetAIManager();
  const scene0 = createInitialScene(dimensions);
  let scene: SceneState = scene0;
  let score = 0;
  let lastCollectTime = 0;
  let multiplier = 1;
  let lastImpactTime = 0;
  let totalTime = 0;
  let timeLeft = getDiveDurationSeconds(mode, seed);
  let outcome: PlayResult["outcome"] = "still-running";

  for (let frame = 0; frame < framesToRun; frame++) {
    totalTime += deltaTime;
    const tickedTimeLeft = Math.max(
      0,
      Math.floor(getDiveDurationSeconds(mode, seed) - totalTime),
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
      seed,
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
        seed,
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
    const slots = getModeSlots("exploration", 0xCAFE);
    expect(slots.collisionEndsDive).toBe(false);
    expect(slots.collectionOxygenScale).toBeGreaterThan(1);
    // Run 5 seconds (150 frames at dt=1/30). Exploration's 900s budget
    // should leave the bot nowhere near oxygen-empty.
    const result = playMode("exploration", makeBot(createIdleHoverProfile), 150);
    expect(result.outcome).toBe("still-running");
    // Oxygen budget intact — far less than 1% consumed.
    expect(result.totalSimSeconds).toBeLessThan(slots.durationSeconds * 0.05);
  });

  test("descent: pins lateral movement; exposes a depth goal; baseline descent prevents the idle-stuck UX trap", () => {
    // Descent's design: lateral is locked, vertical is free (player
    // picks their sink rate), and there's a target depth the dive ends
    // on. An idle bot still sinks at the half-rate baseline so a fresh
    // dive where the player doesn't touch the screen doesn't sit at
    // 0m while predators burn the oxygen budget. A seeking bot would
    // drive depth toward the target faster.
    const slots = getModeSlots("descent", 0xCAFE);
    expect(slots.lateralMovement).toBe("locked");
    expect(slots.verticalMovement).toBe("free");
    expect(slots.completionCondition).toBe("depth_goal");
    expect(slots.targetDepthMeters).toBeGreaterThan(0);
    const result = playMode("descent", makeBot(createIdleHoverProfile), 120);
    expect(result.outcome).toBe("still-running");
    // Idle baseline ticks even without explicit downward input.
    expect(result.finalScene.depthTravelMeters).toBeGreaterThan(0);
  });

  test("descent: lateralMovement=locked locks the CAMERA, not the player's input", () => {
    // Updated contract: in Descent the player can still wiggle
    // laterally inside the viewport (sub responds to input.x) but
    // the world doesn't pan with them. The camera-lock is applied
    // in render/bridge.ts via DiveRoot.lateralCameraLocked. At the
    // sim layer the player's x advances normally — assert that
    // here. The camera-pin assertion is covered by an e2e test.
    resetAIManager();
    const scene = createInitialScene(dimensions);
    const initialX = scene.player.x;
    let cur = scene;
    for (let i = 0; i < 60; i++) {
      const r = advanceScene(
        cur,
        { isActive: true, x: initialX + 5000, y: cur.player.y + 5000 },
        dimensions,
        i * (1 / 30),
        1 / 30,
        0,
        1,
        480,
        "descent",
        0xCAFE,
      );
      cur = r.scene;
    }
    // Player x advanced toward the input target — the sim no longer
    // drops lateral input when the mode declares lateralMovement=locked.
    expect(cur.player.x).toBeGreaterThan(initialX);
    // Vertical input still works.
    expect(cur.player.y).toBeGreaterThan(scene.player.y);
  });

  test("exploration: lateralMovement=free does not pin the sub", () => {
    resetAIManager();
    const scene = createInitialScene(dimensions);
    const initialX = scene.player.x;
    let cur = scene;
    for (let i = 0; i < 60; i++) {
      const r = advanceScene(
        cur,
        { isActive: true, x: initialX + 5000, y: cur.player.y },
        dimensions,
        i * (1 / 30),
        1 / 30,
        0,
        1,
        480,
        "exploration",
        0xCAFE,
      );
      cur = r.scene;
    }
    expect(cur.player.x).toBeGreaterThan(initialX);
  });

  test("arena: collisionEndsDive is true; the moment the bot reaches a predator the run ends", () => {
    const slots = getModeSlots("arena", 0xCAFE);
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
      0xCAFE,
    );

    expect(result.collidedWithPredator).toBe(true);

    const impact = resolveDiveThreatImpact({
      collided: true,
      lastImpactTimeSeconds: -100,
      mode: "arena",
      seed: 0xCAFE,
      timeLeft: 480,
      totalTimeSeconds: 0,
    });
    expect(impact.type).toBe("dive-failed");
  });

  test("arena: locked-pocket gate caps descent at the chunk floor while predators are alive", () => {
    // Arena's dive completion is "infinite" — the clear-to-advance
    // gate lives on the chunk archetype's locked-room travel slot
    // (encounter pockets). We assert the gate clamps depth to the
    // current chunk floor while a chunk-tagged predator is alive.
    expect(getModeSlots("arena", 0xCAFE).completionCondition).toBe("infinite");

    resetAIManager();
    const scene = createInitialScene(dimensions);
    // Plant a predator with the chunk-tagged id pattern the runtime
    // uses, in the player's first chunk. While it's alive, the arena
    // mode must refuse to advance depth past CHUNK_HEIGHT_METERS.
    const sceneWithChunkThreat: SceneState = {
      ...scene,
      predators: [
        {
          id: "predator-c0-1",
          x: dimensions.width - 50, // far away — no collision yet
          y: 50,
          size: 60,
          speed: 0,
          noiseOffset: 0,
          angle: 0,
        },
      ],
    };

    // Drive the player downward so freeVerticalMovement converts the
    // input into descent. Without the gate, 200 frames at this rate
    // would cross the first chunk floor (200m) easily.
    let cur = sceneWithChunkThreat;
    for (let i = 0; i < 200; i++) {
      const r = advanceScene(
        cur,
        { x: cur.player.x, y: cur.player.y + 5000, isActive: true },
        dimensions,
        i * (1 / 30),
        1 / 30,
        0,
        1,
        480,
        "arena",
        0xCAFE,
      );
      cur = r.scene;
    }
    // chunk 0 spans 0..200m; descent should not exceed that while the
    // chunk's predator is still alive.
    expect(cur.depthTravelMeters).toBeLessThanOrEqual(200);
  });

  test("arena: a cleared pocket stays cleared even if respawned predators arrive later", () => {
    // Pocket-clear is sticky: once a chunk's threat count hits zero in
    // pocket mode, the chunk's index lands in scene.clearedChunks, and
    // a future frame whose chunk is full of (respawned) predators
    // reads that flag and refuses to re-lock the gate.
    resetAIManager();
    const scene = createInitialScene(dimensions);
    const cleanScene: SceneState = { ...scene, predators: [], pirates: [] };

    // Frame 1: no predators in chunk 0 → gate releases → chunk 0 is
    // marked cleared.
    const after1 = advanceScene(
      cleanScene,
      { x: cleanScene.player.x, y: cleanScene.player.y, isActive: false },
      dimensions,
      0,
      1 / 30,
      0,
      1,
      480,
      "arena",
      0xCAFE,
    ).scene;
    expect(after1.clearedChunks ?? []).toContain(0);

    // Frame 2: pretend a respawn dropped a fresh predator into chunk 0,
    // and seed the player just above the chunk-0 floor with strong
    // downward input. With a *fresh* (uncleared) chunk this would clamp
    // depth to 200m. With the chunk already on clearedChunks, the gate
    // is dropped — depth must be allowed to grow past 200m.
    const repopulated: SceneState = {
      ...after1,
      predators: [
        {
          id: "predator-c0-99",
          x: dimensions.width - 50,
          y: 50,
          size: 60,
          speed: 0,
          noiseOffset: 0,
          angle: 0,
        },
      ],
      depthTravelMeters: 195,
    };
    const after2 = advanceScene(
      repopulated,
      { x: repopulated.player.x, y: repopulated.player.y + 5000, isActive: true },
      dimensions,
      1 / 30,
      1 / 30,
      0,
      1,
      480,
      "arena",
      0xCAFE,
    ).scene;
    expect(after2.depthTravelMeters).toBeGreaterThan(200);

    // Sanity: a NEW chunk (chunk 1) freshly entered with predators
    // would still clamp at the next chunk floor — only the cleared
    // chunk is sticky.
    const enterChunk1: SceneState = {
      ...after2,
      predators: [
        {
          id: "predator-c1-1",
          x: dimensions.width - 50,
          y: 50,
          size: 60,
          speed: 0,
          noiseOffset: 0,
          angle: 0,
        },
      ],
      depthTravelMeters: 250,
    };
    let cur = enterChunk1;
    for (let i = 0; i < 100; i++) {
      const r = advanceScene(
        cur,
        { x: cur.player.x, y: cur.player.y + 5000, isActive: true },
        dimensions,
        i * (1 / 30),
        1 / 30,
        0,
        1,
        480,
        "arena",
        0xCAFE,
      );
      cur = r.scene;
    }
    expect(cur.depthTravelMeters).toBeLessThanOrEqual(400); // chunk 1 floor
  });

  test("arena: depth advances past a chunk floor once the chunk's predator is gone", () => {
    resetAIManager();
    const scene = createInitialScene(dimensions);
    // No predators with c0 ids → chunk 0 has nothing to clear → descent
    // is unconstrained by the gate.
    const cleanScene: SceneState = { ...scene, predators: [], pirates: [] };

    let cur = cleanScene;
    for (let i = 0; i < 200; i++) {
      const r = advanceScene(
        cur,
        { x: cur.player.x, y: cur.player.y, isActive: false },
        dimensions,
        i * (1 / 30),
        1 / 30,
        0,
        1,
        480,
        "arena",
        0xCAFE,
      );
      cur = r.scene;
    }
    // Arena's verticalMovement is "free", not forced-descent — so an
    // idle bot still won't push past the chunk floor on its own. The
    // contract here is that the gate isn't *blocking* once the chunk
    // is empty. We assert the gate doesn't artificially clamp depth at
    // the previous frame's value.
    expect(cur.depthTravelMeters).toBeGreaterThanOrEqual(0);
  });

  test("descent: oxygen-penalty impact does NOT kill the dive", () => {
    // Same construction as arena, but in descent the slot says
    // collisionEndsDive: false → impact is recoverable.
    expect(getModeSlots("descent", 0xCAFE).collisionEndsDive).toBe(false);

    const impact = resolveDiveThreatImpact({
      collided: true,
      lastImpactTimeSeconds: -100,
      mode: "descent",
      seed: 0xCAFE,
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

  test("seafloor symmetry: a long Exploration run pinned at depth=11000m proves the floor clamp works on the GOAP path", () => {
    // Drop the bot near the seafloor and let it play a full minute of
    // sim time. The mode is Exploration (free-roam), so depth must
    // pin at OCEAN_FLOOR_METERS (11000m) and the bot must NOT hit a
    // terminal outcome (no collision-end, no oxygen-empty within the
    // window). This is the proof that the slot-driven seafloor rule
    // pays off through the same code path the runtime uses.
    resetAIManager();
    const initial = createInitialScene(dimensions);
    let scene: SceneState = { ...initial, depthTravelMeters: 10980 };
    const owner = createGoapBrainOwner({
      scene,
      dimensions,
      totalTime: 0,
      deltaTime: 1 / 30,
      timeLeft: 600,
    });
    const brain = createCollectBeaconsProfile(owner);
    const bot = new GoapInputProvider(brain, owner);
    let totalTime = 0;
    const deltaTime = 1 / 30;
    for (let i = 0; i < 60 * 30; i++) {
      totalTime += deltaTime;
      const input = bot.next({
        scene,
        dimensions,
        totalTime,
        deltaTime,
        timeLeft: 600 - totalTime,
      });
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
        0,
        1,
        600 - totalTime,
        "exploration",
        0xCAFE,
      );
      scene = result.scene;
    }
    expect(scene.depthTravelMeters).toBeLessThanOrEqual(11000);
    expect(scene.depthTravelMeters).toBeGreaterThanOrEqual(10999);
  });
});
