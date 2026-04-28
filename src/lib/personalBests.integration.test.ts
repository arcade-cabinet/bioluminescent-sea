// @vitest-environment jsdom
/**
 * Integration test: simulates a partial dive through `advanceScene`,
 * builds a `DiveRunSummary` via `getDiveRunSummary`, and verifies that
 * `recordDive` writes BOTH `score > 0` AND `depthMeters > 0` to
 * personalBests.
 *
 * Guards against the "23 dives logged but BEST SCORE 0 / DEEPEST 0m"
 * regression flagged in iteration-1 visual assessment — if either
 * field stops accumulating from real summaries, this fails.
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  advanceScene,
  createInitialScene,
  resetAIManager,
  type SceneState,
} from "@/sim/dive";
import { getDiveRunSummary } from "@/sim/engine/telemetry";
import type { Creature } from "@/sim/entities/types";
import { clearPersonalBestsForTest, getPersonalBests, recordDive } from "./personalBests";

const dimensions = { width: 800, height: 600 };
const seed = 0xCAFE;

beforeEach(() => {
  clearPersonalBestsForTest();
  resetAIManager();
});

afterEach(() => {
  clearPersonalBestsForTest();
});

describe("personalBests — integration with sim engine", () => {
  test("a completed dive with score + depth writes both > 0 to bests", () => {
    // Build an initial scene then plant a single creature directly on
    // top of the player so the collision distance trips on the first
    // tick — the test isn't about spawn dispersion, it's about whether
    // a real `advanceScene` → `getDiveRunSummary` → `recordDive`
    // pipeline preserves both score and depth.
    let scene: SceneState = createInitialScene(dimensions);
    const creature: Creature = {
      id: "fixture-creature-1",
      type: "fish",
      x: scene.player.x,
      y: scene.player.y,
      size: 80,
      color: "#c4b5fd",
      glowColor: "#8b5cf6",
      glowIntensity: 1,
      noiseOffsetX: 0,
      noiseOffsetY: 0,
      speed: 0,
      pulsePhase: 0,
    };
    scene = { ...scene, creatures: [...scene.creatures, creature] };

    let score = 0;
    let lastCollectTime = 0;
    let multiplier = 1;
    const dt = 1 / 30;

    // Tick once with the collection target the player is already on.
    const tick1 = advanceScene(
      scene,
      { x: scene.player.x, y: scene.player.y, isActive: true },
      dimensions,
      0,
      dt,
      lastCollectTime,
      multiplier,
      600,
      "exploration",
      seed,
    );
    scene = tick1.scene;
    score += tick1.collection.scoreDelta;
    if (tick1.collection.collected.length > 0) {
      multiplier = tick1.collection.multiplier;
      lastCollectTime = tick1.collection.lastCollectTime;
    }

    // Now drive depth with a downward target for a handful of frames so
    // depthTravelMeters accumulates. The creature is already collected;
    // remaining frames purely descend.
    for (let i = 1; i < 90; i++) {
      const totalTime = i * dt;
      const r = advanceScene(
        scene,
        { x: scene.player.x, y: scene.player.y + 5000, isActive: true },
        dimensions,
        totalTime,
        dt,
        lastCollectTime,
        multiplier,
        600,
        "exploration",
        seed,
      );
      scene = r.scene;
      score += r.collection.scoreDelta;
    }

    const summary = getDiveRunSummary(scene, score, /* timeLeft */ 540);

    // Sanity: simulated dive really produced both signals before we
    // assert the writer preserves them.
    expect(summary.depthMeters).toBeGreaterThan(0);
    expect(summary.score).toBeGreaterThan(0);

    const { bests } = recordDive(summary);
    const persisted = getPersonalBests();

    // The writer must propagate BOTH score and depth — the original
    // visual finding observed `BEST SCORE 0` with `DEEPEST 0m` despite
    // 23 logged dives, which would mean exactly this assertion failed.
    expect(bests.score).toBeGreaterThan(0);
    expect(bests.depthMeters).toBeGreaterThan(0);
    expect(bests.divesLogged).toBe(1);
    expect(persisted.score).toBe(bests.score);
    expect(persisted.depthMeters).toBe(bests.depthMeters);
  });
});
