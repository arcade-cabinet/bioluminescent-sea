// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createInitialScene, getDiveTelemetry, GAME_DURATION } from "@/sim";
import {
  DIVE_SAVE_KEY,
  type DeepSeaRunSnapshot,
  resolveDeepSeaSnapshot,
  writeDeepSeaSnapshot,
} from "./diveSnapshot";

const dimensions = { width: 800, height: 600 };

function makeSnapshot(timeLeft: number): DeepSeaRunSnapshot {
  const scene = createInitialScene(dimensions);
  return {
    lastCollectTime: 0,
    mode: "descent",
    multiplier: 1,
    scene,
    score: 0,
    seed: 42,
    telemetry: getDiveTelemetry(scene, timeLeft, GAME_DURATION),
    timeLeft,
  };
}

describe("dive snapshot persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("writes and resolves a healthy mid-dive snapshot", () => {
    writeDeepSeaSnapshot(makeSnapshot(420));
    const restored = resolveDeepSeaSnapshot();
    expect(restored).not.toBeNull();
    expect(restored?.timeLeft).toBe(420);
  });

  test("never restores a snapshot with timeLeft <= 0 (finished dive)", () => {
    // The race that produced this bug: DiveScreen's unmount cleanup
    // wrote the dead state to storage AFTER onGameOver cleared it.
    // resolveDeepSeaSnapshot() must reject any timeLeft <= 0 to defend
    // against this even if the writer ever regresses.
    writeDeepSeaSnapshot(makeSnapshot(0));
    expect(resolveDeepSeaSnapshot()).toBeNull();
    expect(localStorage.getItem(DIVE_SAVE_KEY)).toBeNull();

    writeDeepSeaSnapshot(makeSnapshot(-5));
    expect(resolveDeepSeaSnapshot()).toBeNull();
  });
});
