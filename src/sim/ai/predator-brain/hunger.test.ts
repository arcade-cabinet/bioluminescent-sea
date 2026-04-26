import { describe, expect, test } from "vitest";
import { PredatorBrain } from "./PredatorBrain";
import { PREDATOR_PROFILES } from "./archetype-profiles";

const profile = PREDATOR_PROFILES["torpedo-eel"];

function makeBrain(): PredatorBrain {
  const b = new PredatorBrain("torpedo-eel-1", profile, 100, 100);
  // Simulate brain having been spawned at t=10 (the AIManager would
  // do this via brain.lastStrikeAttemptTime = currentTime).
  b.lastStrikeAttemptTime = 10;
  b.currentTime = 10;
  return b;
}

describe("predator hunger", () => {
  test("at spawn, hunger factor is exactly 1 (well-fed)", () => {
    const b = makeBrain();
    expect(b.hungerFactor()).toBe(1);
    expect(b.hungerLevel()).toBe(0);
  });

  test("hunger factor stays 1 immediately after a strike", () => {
    const b = makeBrain();
    b.currentTime = 10; // same tick as last strike
    expect(b.hungerFactor()).toBe(1);
  });

  test("hunger ramps linearly toward 1.5 over 30 s", () => {
    const b = makeBrain();
    // Halfway through ramp window.
    b.currentTime = 25; // 15s after lastStrikeAttemptTime=10
    expect(b.hungerFactor()).toBeCloseTo(1.25, 5);
    expect(b.hungerLevel()).toBeCloseTo(0.5, 5);
  });

  test("hunger plateaus at 1.5 at the 30 s cap", () => {
    const b = makeBrain();
    b.currentTime = 40; // 30s after spawn
    expect(b.hungerFactor()).toBeCloseTo(1.5, 5);
    expect(b.hungerLevel()).toBeCloseTo(1, 5);
  });

  test("hunger does not exceed 1.5 even at long lulls", () => {
    const b = makeBrain();
    b.currentTime = 1000; // ~16 minutes
    expect(b.hungerFactor()).toBe(1.5);
    expect(b.hungerLevel()).toBe(1);
  });

  test("detection radius scales with hunger", () => {
    const b = makeBrain();
    const baseline = b.effectiveDetectionRadius();
    // Starve to max.
    b.currentTime = 40;
    const starved = b.effectiveDetectionRadius();
    expect(starved).toBeCloseTo(baseline * 1.5, 1);
  });

  test("commit radius scales with hunger", () => {
    const b = makeBrain();
    const baseline = b.effectiveCommitRadius();
    b.currentTime = 40;
    const starved = b.effectiveCommitRadius();
    expect(starved).toBeCloseTo(baseline * 1.5, 1);
  });

  test("hunger compounds with biome aggression", () => {
    const b = makeBrain();
    b.biomeAggression = 1.4;
    const fedRadius = b.effectiveDetectionRadius();
    expect(fedRadius).toBeCloseTo(profile.detectionRadiusPx * 1.4, 1);

    b.currentTime = 40; // max hunger
    const starvedRadius = b.effectiveDetectionRadius();
    expect(starvedRadius).toBeCloseTo(profile.detectionRadiusPx * 1.4 * 1.5, 1);
  });

  test("striking resets hunger (lastStrikeAttemptTime updates)", () => {
    const b = makeBrain();
    b.currentTime = 30; // partially starved
    expect(b.hungerLevel()).toBeGreaterThan(0);
    // Simulate StrikeState.exit stamping the time.
    b.lastStrikeAttemptTime = b.currentTime;
    expect(b.hungerFactor()).toBe(1);
    expect(b.hungerLevel()).toBe(0);
  });

  test("hungerLevel returns valid range when currentTime < lastStrikeAttemptTime", () => {
    // Defensive: shouldn't happen in practice but logic should not
    // produce negative hunger.
    const b = makeBrain();
    b.lastStrikeAttemptTime = 50;
    b.currentTime = 25;
    expect(b.hungerFactor()).toBe(1);
    expect(b.hungerLevel()).toBe(0);
  });
});
