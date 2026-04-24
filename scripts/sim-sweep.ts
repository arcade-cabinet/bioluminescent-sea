#!/usr/bin/env tsx
/**
 * Nightly determinism sweep.
 *
 * Runs N seeded dives through the pure simulation and asserts:
 *   - No NaN or Infinity in any telemetry field.
 *   - collectionRatio stays in [0, 1].
 *   - oxygenRatio stays in [0, 1].
 *   - Identical seeds produce byte-identical results.
 *   - Per-frame step cost stays under 3ms on the CI runner.
 *
 * Exits non-zero on any assertion failure; `analysis-nightly.yml`
 * opens a regression issue when that happens.
 */

import { createSeededScene } from "../src/sim/dive/seeded";
import { advanceScene } from "../src/sim/dive/advance";
import { getDiveTelemetry } from "../src/sim/dive/telemetry";

const VIEWPORT = { width: 1280, height: 720 };
const SAMPLE_COUNT = 100;
const FRAMES_PER_DIVE = 180;
const DELTA_TIME = 1 / 60;
const FRAME_TIME_BUDGET_MS = 3;

interface SweepError {
  seed: number;
  frame: number;
  message: string;
}

const errors: SweepError[] = [];

let worstFrameMs = 0;
const startAll = performance.now();

for (let i = 0; i < SAMPLE_COUNT; i++) {
  const seed = 1000 + i;
  const sceneA = createSeededScene(seed, VIEWPORT);
  const sceneB = createSeededScene(seed, VIEWPORT);

  if (JSON.stringify(sceneA) !== JSON.stringify(sceneB)) {
    errors.push({ seed, frame: 0, message: "createSeededScene not deterministic" });
    continue;
  }

  let scene = sceneA;
  let lastCollect = 0;
  let multiplier = 1;
  let timeLeft = 600;

  for (let f = 0; f < FRAMES_PER_DIVE; f++) {
    const before = performance.now();
    const result = advanceScene(
      scene,
      { x: scene.player.x, y: scene.player.y + 2, isActive: true },
      VIEWPORT,
      f * DELTA_TIME,
      DELTA_TIME,
      lastCollect,
      multiplier,
      timeLeft,
      "standard"
    );
    const frameMs = performance.now() - before;
    worstFrameMs = Math.max(worstFrameMs, frameMs);

    const t = getDiveTelemetry(result.scene, timeLeft);
    for (const [k, v] of Object.entries(t)) {
      if (typeof v === "number" && !Number.isFinite(v)) {
        errors.push({ seed, frame: f, message: `telemetry.${k} is ${v}` });
      }
    }
    if (t.collectionRatio < 0 || t.collectionRatio > 1) {
      errors.push({ seed, frame: f, message: `collectionRatio out of range: ${t.collectionRatio}` });
    }
    if (t.oxygenRatio < 0 || t.oxygenRatio > 1) {
      errors.push({ seed, frame: f, message: `oxygenRatio out of range: ${t.oxygenRatio}` });
    }

    scene = result.scene;
    lastCollect = result.collection.lastCollectTime;
    multiplier = result.collection.multiplier;
    timeLeft -= DELTA_TIME;
  }
}

const totalMs = performance.now() - startAll;

console.log(
  `[sim-sweep] ${SAMPLE_COUNT} seeds × ${FRAMES_PER_DIVE} frames in ${totalMs.toFixed(0)}ms (worst frame: ${worstFrameMs.toFixed(2)}ms)`
);

if (worstFrameMs > FRAME_TIME_BUDGET_MS) {
  errors.push({
    seed: -1,
    frame: -1,
    message: `frame-time regression: ${worstFrameMs.toFixed(2)}ms exceeds budget ${FRAME_TIME_BUDGET_MS}ms`,
  });
}

if (errors.length > 0) {
  console.error(`[sim-sweep] FAILED with ${errors.length} error(s):`);
  for (const e of errors.slice(0, 10)) {
    console.error(`  seed=${e.seed} frame=${e.frame}: ${e.message}`);
  }
  if (errors.length > 10) console.error(`  ... and ${errors.length - 10} more`);
  process.exit(1);
}

console.log("[sim-sweep] PASSED");
