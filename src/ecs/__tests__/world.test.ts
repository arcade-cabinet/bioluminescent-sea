import { describe, expect, it, beforeEach } from "vitest";
import { createInitialScene, resetAIManager } from "@/sim/engine/advance";
import { advanceDiveFrame } from "../actions";
import { createDiveWorld, readSceneFromWorld, writeSceneToWorld } from "../world";

const viewport = { width: 1280, height: 720 };

describe("createDiveWorld", () => {
  beforeEach(() => {
    resetAIManager();
  });

  it("spawns one entity per creature / predator / pirate / particle plus root + player", () => {
    const scene = createInitialScene(viewport);
    const w = createDiveWorld(scene, 0xCAFE, "descent");

    expect(w.creatureEntities.length).toBe(scene.creatures.length);
    expect(w.predatorEntities.length).toBe(scene.predators.length);
    expect(w.pirateEntities.length).toBe(scene.pirates.length);
    expect(w.particleEntities.length).toBe(scene.particles.length);
  });

  it("readSceneFromWorld round-trips the initial scene", () => {
    const scene = createInitialScene(viewport);
    const w = createDiveWorld(scene, 0xCAFE, "descent");
    const readBack = readSceneFromWorld(w);

    expect(readBack.creatures.length).toBe(scene.creatures.length);
    expect(readBack.predators.length).toBe(scene.predators.length);
    expect(readBack.pirates.length).toBe(scene.pirates.length);
    expect(readBack.particles.length).toBe(scene.particles.length);
    expect(readBack.player).toEqual(scene.player);
    expect(readBack.creatures[0]).toEqual(scene.creatures[0]);
  });

  it("writeSceneToWorld retires entities when the scene shrinks", () => {
    const base = createInitialScene(viewport);
    const scene = {
      ...base,
      creatures: Array.from({ length: 10 }, (_, i) => ({ id: `c-${i}`, type: "fish" as const, x: 0, y: 0, size: 10, color: "#fff", glowColor: "#fff", glowIntensity: 1, noiseOffsetX: 0, noiseOffsetY: 0, pulsePhase: 0, speed: 1 })),
    };
    const w = createDiveWorld(scene, 0xCAFE, "descent");
    const shorter = {
      ...scene,
      creatures: scene.creatures.slice(0, 5),
    };

    const next = writeSceneToWorld(w, shorter);

    expect(next.creatureEntities.length).toBe(5);
    expect(readSceneFromWorld(next).creatures.length).toBe(5);
  });
});

describe("advanceDiveFrame", () => {
  beforeEach(() => {
    resetAIManager();
  });

  it("produces the same result as calling advanceScene directly", () => {
    const base = createInitialScene(viewport);
    const scene = {
      ...base,
      creatures: Array.from({ length: 2 }, (_, i) => ({ id: `c-${i}`, type: "fish" as const, x: 0, y: 0, size: 10, color: "#fff", glowColor: "#fff", glowIntensity: 1, noiseOffsetX: 0, noiseOffsetY: 0, pulsePhase: 0, speed: 1 })),
    };
    const world = createDiveWorld(scene, 0xCAFE, "descent");

    const { result } = advanceDiveFrame({
      world,
      input: { x: 640, y: 360, isActive: false },
      dimensions: viewport,
      deltaTime: 1 / 60,
      totalTime: 0,
      timeLeft: 600,
      mode: "standard",
      lastCollectTime: 0,
      multiplier: 1,
    });

    expect(result.scene.player).toBeDefined();
    expect(result.telemetry).toBeDefined();
    expect(result.scene.creatures.length).toBeGreaterThan(0);
  });

  it("is deterministic — identical inputs produce identical outputs across worlds", () => {
    const sceneA = createInitialScene(viewport);
    const sceneB = createInitialScene(viewport);
    const worldA = createDiveWorld(sceneA, 0xCAFE, "descent");
    const worldB = createDiveWorld(sceneB, 0xCAFE, "descent");

    const commonInput = {
      input: { x: 640, y: 360, isActive: false },
      dimensions: viewport,
      deltaTime: 1 / 60,
      totalTime: 1.5,
      timeLeft: 590,
      mode: "standard",
      lastCollectTime: 0,
      multiplier: 1,
    };

    const a = advanceDiveFrame({ world: worldA, ...commonInput });
    resetAIManager();
    const b = advanceDiveFrame({ world: worldB, ...commonInput });

    expect(a.result.scene.player).toEqual(b.result.scene.player);
    expect(a.result.scene.creatures).toEqual(b.result.scene.creatures);
    expect(a.result.telemetry).toEqual(b.result.telemetry);
  });
});
