import { describe, expect, test } from "vitest";
import {
  advanceParticle,
  advancePlayer,
  advancePredator,
  advanceScene,
  type Creature,
  calculateMultiplier,
  collectCreatures,
  createInitialScene,
  findNearestBeaconVector,
  findNearestThreatDistance,
  GAME_DURATION,
  getDeterministicWrapX,
  getDiveCompletionCelebration,
  getDiveDurationSeconds,
  getDiveModeTuning,
  getDiveRouteLandmark,
  getDiveRunSummary,
  getDiveTelemetry,
  hasPredatorCollision,
  isDiveComplete,
  type Player,
  type Predator,
  resolveDiveThreatImpact,
  TOTAL_BEACONS,
} from "@/sim";

const desktop = { width: 1280, height: 720 };

describe("deep sea simulation", () => {
  test("creates a deterministic authored dive route", () => {
    const scene = createInitialScene(desktop);
    const again = createInitialScene(desktop);

    expect(scene).toEqual(again);
    expect(scene.creatures).toHaveLength(TOTAL_BEACONS);
    expect(scene.particles).toHaveLength(130);
    expect(scene.predators.map((predator) => predator.id)).toEqual(["angler-left", "eel-right"]);
    expect(scene.pirates.map((pirate) => pirate.id)).toEqual([
      "lantern-skiff-port",
      "lantern-skiff-starboard",
    ]);
    expect(new Set(scene.creatures.map((creature) => creature.type))).toEqual(
      new Set(["jellyfish", "plankton", "fish"])
    );
    expect(scene.player.x).toBe(desktop.width / 2);
  });

  test("moves the player toward active pointer input and clamps targets to the play band", () => {
    const player = createPlayer({ x: 100, y: 100 });
    const next = advancePlayer(
      player,
      { isActive: true, x: 2_000, y: -50 },
      { width: 320, height: 240 },
      0.5,
      1 / 60
    );

    expect(next.targetX).toBe(1280);
    expect(next.targetY).toBe(0);
    expect(next.x).toBeGreaterThan(player.x);
    expect(next.y).toBeLessThan(player.y);
    expect(next.angle).toBeLessThan(0);
    expect(player.x).toBe(100);
  });

  test("collects creatures, scores chains, and leaves distant creatures untouched", () => {
    const first = createCreature("plankton", 100, 100);
    const second = createCreature("fish", 105, 100);
    const distant = createCreature("jellyfish", 250, 100);

    const result = collectCreatures(
      [first, second, distant],
      createPlayer({ x: 100, y: 100 }),
      4,
      2.5,
      2
    );

    expect(result.collected.map((creature) => creature.id)).toEqual(["plankton", "fish"]);
    expect(result.creatures).toEqual([distant]);
    expect(result.multiplier).toBe(4);
    expect(result.oxygenBonusSeconds).toBe(4 + 6);
    expect(result.scoreDelta).toBe(10 * 3 + 50 * 4);
    expect(result.lastCollectTime).toBe(4);
  });

  test("resets stale combo windows and caps active chains", () => {
    expect(calculateMultiplier(0, 1, 4)).toBe(1);
    expect(calculateMultiplier(3, 7.2, 4)).toBe(1);
    expect(calculateMultiplier(3, 4.5, 4)).toBe(5);
    expect(calculateMultiplier(3, 4.5, 5)).toBe(5);
  });

  test("advances predators and detects collision pressure without mutating input", () => {
    const player = createPlayer({ x: 180, y: 120 });
    const predator: Predator = {
      angle: 0,
      id: "hunter",
      noiseOffset: 10,
      size: 80,
      speed: 1,
      x: 40,
      y: 120,
    };
    const next = advancePredator(predator, player, { width: 320, height: 240 }, 2, 1 / 60);

    expect(next.x).toBeGreaterThan(predator.x);
    expect(next.angle).toBeCloseTo(0, 1);
    expect(predator.x).toBe(40);
    expect(hasPredatorCollision(player, [{ ...predator, x: 170, y: 120 }])).toBe(true);
    expect(findNearestThreatDistance(player, [predator])).toBeGreaterThan(90);
  });

  test("maps session modes to recoverable dive pressure", () => {
    expect(getDiveDurationSeconds("standard")).toBe(GAME_DURATION);
    expect(getDiveDurationSeconds("standard")).toBeGreaterThanOrEqual(8 * 60);
    expect(getDiveDurationSeconds("standard")).toBeLessThanOrEqual(15 * 60);
    expect(getDiveDurationSeconds("cozy")).toBeGreaterThan(getDiveDurationSeconds("standard"));
    expect(getDiveDurationSeconds("challenge")).toBeLessThan(getDiveDurationSeconds("standard"));
    expect(getDiveModeTuning("challenge").threatRadiusScale).toBeGreaterThan(
      getDiveModeTuning("standard").threatRadiusScale
    );
    expect(getDiveModeTuning("cozy").predatorSpeedScale).toBeLessThan(
      getDiveModeTuning("standard").predatorSpeedScale
    );
    expect(getDiveModeTuning("standard").collisionEndsDive).toBe(false);
    expect(getDiveModeTuning("challenge").collisionEndsDive).toBe(true);
  });

  test("resolves predator contact as recoverable oxygen loss outside challenge", () => {
    const standardImpact = resolveDiveThreatImpact({
      collided: true,
      lastImpactTimeSeconds: -100,
      mode: "standard",
      timeLeft: 300,
      totalTimeSeconds: 90,
    });
    const graceImpact = resolveDiveThreatImpact({
      collided: true,
      lastImpactTimeSeconds: 90,
      mode: "standard",
      timeLeft: standardImpact.timeLeft,
      totalTimeSeconds: 92,
    });
    const challengeImpact = resolveDiveThreatImpact({
      collided: true,
      lastImpactTimeSeconds: -100,
      mode: "challenge",
      timeLeft: 300,
      totalTimeSeconds: 90,
    });

    expect(standardImpact).toMatchObject({
      oxygenPenaltySeconds: 45,
      timeLeft: 255,
      type: "oxygen-penalty",
    });
    expect(graceImpact).toMatchObject({
      oxygenPenaltySeconds: 0,
      timeLeft: 255,
      type: "none",
    });
    expect(challengeImpact).toMatchObject({
      timeLeft: 0,
      type: "dive-failed",
    });
  });

  test("wraps particles deterministically instead of using runtime randomness", () => {
    const particle = {
      drift: 1,
      opacity: 0.2,
      seed: 7,
      size: 2,
      speed: 4,
      x: 20,
      y: -4,
    };
    const wrapped = advanceParticle(particle, { width: 500, height: 300 }, 6.2, 1 / 60);

    expect(wrapped.y).toBe(302);
    expect(wrapped.x).toBe(getDeterministicWrapX(7, 6.2, 500));
    expect(advanceParticle(particle, { width: 500, height: 300 }, 6.2, 1 / 60)).toEqual(wrapped);
  });

  test("advances the full scene with collection, telemetry, and predator collision", () => {
    const scene = createInitialScene({ width: 320, height: 320 });
    const sceneWithBeaconAtPlayer = {
      ...scene,
      creatures: [
        { ...scene.creatures[0], x: scene.player.x, y: scene.player.y },
        { ...scene.creatures[1], x: 40, y: 40 },
      ],
      predators: [{ ...scene.predators[0], x: scene.player.x + 5, y: scene.player.y }],
    };
    const result = advanceScene(
      sceneWithBeaconAtPlayer,
      { isActive: false, x: 0, y: 0 },
      { width: 320, height: 320 },
      5,
      1 / 60,
      0,
      1,
      GAME_DURATION - 5
    );

    expect(result.collection.collected).toHaveLength(1);
    expect(result.collection.scoreDelta).toBeGreaterThan(0);
    expect(result.collidedWithPredator).toBe(true);
    expect(result.telemetry.objective).toContain("Predator");
  });

  test("advanceScene drives depthTravelMeters forward every frame", () => {
    const scene = createInitialScene(desktop);
    expect(scene.depthTravelMeters).toBe(0);

    // 60 frames at 1/60s delta = 1 second real-time. Descent speed is
    // 6 m/s so after 1 second we should be at ~6 meters deeper.
    let current = scene;
    for (let f = 0; f < 60; f++) {
      const result = advanceScene(
        current,
        { isActive: false, x: 0, y: 0 },
        desktop,
        f * (1 / 60),
        1 / 60,
        0,
        1,
        GAME_DURATION
      );
      current = result.scene;
    }
    expect(current.depthTravelMeters).toBeCloseTo(11, 1);
  });

  test("advanceScene clamps depthTravelMeters at the trench floor", () => {
    const scene = { ...createInitialScene(desktop), depthTravelMeters: 3199 };
    // One big frame that would overshoot the floor.
    const result = advanceScene(
      scene,
      { isActive: false, x: 0, y: 0 },
      desktop,
      0,
      5,
      0,
      1,
      GAME_DURATION
    );
    expect(result.scene.depthTravelMeters).toBeLessThanOrEqual(6400);
  });

  test("describes oxygen, depth, and collection telemetry", () => {
    const scene = createInitialScene(desktop);
    // depthTravelMeters is now a real sim state — set it explicitly so
    // we're asserting depth + biome from a known descent distance.
    const nearFloor = {
      ...scene,
      creatures: scene.creatures.slice(0, 3),
      depthTravelMeters: 2900,
    };
    const telemetry = getDiveTelemetry(nearFloor, 10);
    const cozyTelemetry = getDiveTelemetry(
      nearFloor,
      10,
      getDiveDurationSeconds("cozy")
    );

    expect(telemetry.collectionRatio).toBeGreaterThan(0.8);
    expect(telemetry.depthMeters).toBeGreaterThan(2_800);
    expect(telemetry.nearestBeaconDistance).toBeGreaterThan(0);
    expect(telemetry.beaconBearingRadians).not.toBeNull();
    expect(telemetry.routeLandmarkLabel).toBe("Abyss Orchard");
    expect(telemetry.routeLandmarkDistance).toBeGreaterThan(0);
    expect(telemetry.oxygenRatio).toBeCloseTo(1 / 60);
    expect(cozyTelemetry.oxygenRatio).toBeLessThan(telemetry.oxygenRatio);
    expect(["Ascent", "Hunted", "Critical", "Calm"]).toContain(telemetry.pressureLabel);
  });

  test("points sonar telemetry at the nearest uncharted beacon", () => {
    const player = createPlayer({ x: 100, y: 100 });
    const far = createCreature("fish", 300, 100);
    const near = createCreature("plankton", 120, 100);
    const vector = findNearestBeaconVector(player, [far, near]);

    expect(vector.distance).toBe(20);
    expect(vector.bearingRadians).toBeCloseTo(0);
  });

  test("advances route landmark telemetry with the beacon chain", () => {
    const early = getDiveRouteLandmark(0.1, { bearingRadians: 0.4, distance: 160 });
    const mid = getDiveRouteLandmark(0.46, { bearingRadians: 0.1, distance: 120 });
    const late = getDiveRouteLandmark(0.94, { bearingRadians: -0.2, distance: 42 });

    expect(early.label).toBe("Kelp Gate");
    expect(early.bearingRadians).toBeCloseTo(0.4);
    expect(mid.label).toBe("Whale-Fall Windows");
    expect(late.label).toBe("Living Map");
    expect(late.distance).toBeLessThan(early.distance);
  });

  test("reports dive completion and run summary when all beacons are recovered", () => {
    const scene = { ...createInitialScene(desktop), creatures: [] };
    const summary = getDiveRunSummary(scene, 12_500, 240);
    const celebration = getDiveCompletionCelebration(summary);

    expect(isDiveComplete(scene)).toBe(true);
    expect(summary).toMatchObject({
      beaconsRemaining: 0,
      completionPercent: 100,
      durationSeconds: GAME_DURATION,
      score: 12_500,
      timeLeft: 240,
      totalBeacons: TOTAL_BEACONS,
    });
    expect(celebration).toMatchObject({
      rating: "Radiant Route",
      title: "Living Map Complete",
    });
    expect(celebration.landmarkSequence).toContain("Abyss Orchard");
  });
});

function createPlayer(position: { x: number; y: number }): Player {
  return {
    angle: 0,
    glowIntensity: 1,
    targetX: position.x,
    targetY: position.y,
    x: position.x,
    y: position.y,
  };
}

function createCreature(type: Creature["type"], x: number, y: number): Creature {
  return {
    color: "#ffffff",
    glowColor: "#00ffff",
    glowIntensity: 1,
    id: type,
    noiseOffsetX: 0,
    noiseOffsetY: 0,
    pulsePhase: 0,
    size: 24,
    speed: 0.3,
    type,
    x,
    y,
  };
}

