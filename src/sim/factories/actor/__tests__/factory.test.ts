import { describe, expect, test } from "vitest";
import { createRng } from "@/sim/rng";
import {
  archetypesOfKind,
  createActor,
  createActorById,
  getArchetype,
  pickWeightedArchetype,
  spawnFlock,
  spawnLeviathanEscort,
} from "../";

describe("actor factory", () => {
  test("every archetype dispatches to the correct entity kind", () => {
    const ids = [
      "fish-shoal",
      "jellyfish-bloom",
      "plankton-mote",
      "abyssal-predator",
      "pirate-lantern",
      "stygian-leviathan",
      "marauder-sub",
      "repel-anomaly",
      "overdrive-anomaly",
      "ranger-sub",
    ] as const;

    for (const id of ids) {
      const rng = createRng(123);
      const spawned = createActorById(id, { idPrefix: "t", x: 100, y: 100, rng });
      expect(spawned.archetype.id).toBe(id);
      expect(spawned.kind).toBe(spawned.archetype.kind);
    }
  });

  test("creature spawn populates the legacy Creature shape end-to-end", () => {
    const rng = createRng(7);
    const spawned = createActorById("fish-shoal", {
      idPrefix: "chunk-1",
      x: 50,
      y: 60,
      worldYMeters: 1234,
      rng,
    });
    expect(spawned.kind).toBe("creature");
    if (spawned.kind !== "creature") return;
    const c = spawned.entity;
    expect(c.type).toBe("fish");
    expect(c.x).toBe(50);
    expect(c.y).toBe(60);
    expect(c.worldYMeters).toBe(1234);
    expect(c.color).toMatch(/^#/);
    expect(c.glowColor).toMatch(/^#/);
    expect(c.size).toBeGreaterThan(0);
    expect(c.id).toContain("chunk-1");
    expect(c.id).toContain("fish-shoal");
  });

  test("predator and enemy-sub share the Predator entity shape but carry different archetypes", () => {
    const rngA = createRng(11);
    const rngB = createRng(11);
    const predator = createActorById("abyssal-predator", {
      idPrefix: "x",
      x: 0,
      y: 0,
      rng: rngA,
    });
    const enemySub = createActorById("marauder-sub", {
      idPrefix: "x",
      x: 0,
      y: 0,
      rng: rngB,
    });

    expect(predator.kind).toBe("predator");
    expect(enemySub.kind).toBe("enemy-sub");

    if (predator.kind === "predator" && enemySub.kind === "enemy-sub") {
      // Both materialise as Predator-shaped entities — the archetype carries
      // the divergent AI hookup and detection radius.
      expect(typeof predator.entity.angle).toBe("number");
      expect(typeof enemySub.entity.angle).toBe("number");
      expect(enemySub.archetype.detectionRadius).toBeGreaterThan(0);
      expect(enemySub.archetype.attackCooldownSeconds).toBeGreaterThan(0);
    }
  });

  test("anomaly spawn carries effect duration from archetype", () => {
    const rng = createRng(99);
    const repel = createActorById("repel-anomaly", {
      idPrefix: "p",
      x: 0,
      y: 0,
      rng,
    });
    expect(repel.kind).toBe("anomaly");
    if (repel.kind !== "anomaly") return;
    expect(repel.archetype.effectSeconds).toBe(15);
    expect(repel.entity.type).toBe("repel");
  });

  test("player archetype spawns a Player record at the supplied anchor", () => {
    const rng = createRng(0);
    const player = createActorById("ranger-sub", {
      idPrefix: "p",
      x: 320,
      y: 480,
      rng,
    });
    expect(player.kind).toBe("player");
    if (player.kind !== "player") return;
    expect(player.entity.x).toBe(320);
    expect(player.entity.y).toBe(480);
    expect(player.entity.targetX).toBe(320);
    expect(player.entity.activeBuffs.repelUntil).toBe(0);
  });

  test("createActor is deterministic for a given seed", () => {
    const a = createActorById("fish-shoal", {
      idPrefix: "d",
      x: 0,
      y: 0,
      rng: createRng(42),
    });
    const b = createActorById("fish-shoal", {
      idPrefix: "d",
      x: 0,
      y: 0,
      rng: createRng(42),
    });
    expect(a.entity).toEqual(b.entity);
  });

  test("archetypesOfKind returns every archetype matching a kind", () => {
    const creatures = archetypesOfKind("creature");
    expect(creatures.map((a) => a.id).sort()).toEqual([
      "fish-shoal",
      "jellyfish-bloom",
      "plankton-mote",
    ]);
    expect(archetypesOfKind("leviathan").map((a) => a.id)).toEqual([
      "stygian-leviathan",
    ]);
  });

  test("pickWeightedArchetype is deterministic and respects weights", () => {
    const creatures = archetypesOfKind("creature");
    // 1000 picks against a fixed seed — the hottest weight (fish-shoal at 0.5)
    // must dominate the long-tail of plankton-mote (0.2).
    const counts = { "fish-shoal": 0, "jellyfish-bloom": 0, "plankton-mote": 0 };
    const rng = createRng(5);
    for (let i = 0; i < 1000; i++) {
      const picked = pickWeightedArchetype(creatures, rng);
      counts[picked.id as keyof typeof counts] += 1;
    }
    expect(counts["fish-shoal"]).toBeGreaterThan(counts["plankton-mote"]);
    // Determinism: a second seeded run produces the exact same totals.
    const rng2 = createRng(5);
    const counts2 = { "fish-shoal": 0, "jellyfish-bloom": 0, "plankton-mote": 0 };
    for (let i = 0; i < 1000; i++) {
      const picked = pickWeightedArchetype(creatures, rng2);
      counts2[picked.id as keyof typeof counts2] += 1;
    }
    expect(counts2).toEqual(counts);
  });

  test("higher-order: spawnFlock produces N members all sharing the archetype", () => {
    const flock = spawnFlock("jellyfish-bloom", 7, {
      idPrefix: "f",
      seed: 1234,
      centerX: 200,
      centerY: 200,
      radius: 60,
    });
    expect(flock.length).toBe(7);
    for (const member of flock) {
      expect(member.kind).toBe("creature");
      if (member.kind !== "creature") continue;
      expect(member.entity.type).toBe("jellyfish");
      // Every member lands inside the spawn radius (with a small margin
      // for the spawn jitter).
      const dx = member.entity.x - 200;
      const dy = member.entity.y - 200;
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(60 + 1);
    }
  });

  test("higher-order: spawnLeviathanEscort packs a leviathan + two outriders", () => {
    const group = spawnLeviathanEscort({
      idPrefix: "esc",
      seed: 2024,
      centerX: 400,
      centerY: 400,
      radius: 120,
    });
    expect(group.length).toBe(3);
    expect(group[0].kind).toBe("leviathan");
    expect(group[1].kind).toBe("predator");
    expect(group[2].kind).toBe("predator");
  });

  test("higher-order spawns are deterministic per seed", () => {
    const a = spawnFlock("fish-shoal", 5, {
      idPrefix: "f",
      seed: 9999,
      centerX: 100,
      centerY: 100,
      radius: 40,
    }).map((m) => ({ x: m.entity.x, y: m.entity.y }));
    const b = spawnFlock("fish-shoal", 5, {
      idPrefix: "f",
      seed: 9999,
      centerX: 100,
      centerY: 100,
      radius: 40,
    }).map((m) => ({ x: m.entity.x, y: m.entity.y }));
    expect(a).toEqual(b);
  });

  test("getArchetype is the exact catalogue record", () => {
    const arch = getArchetype("stygian-leviathan");
    expect(arch.kind).toBe("leviathan");
    expect(arch.behaviour).toBe("leviathan-roam");
    expect(arch.spawnChance).toBe(0.5);
  });

  test("createActor accepts an archetype object directly (composite path)", () => {
    const archetype = getArchetype("plankton-mote");
    const rng = createRng(0);
    const spawned = createActor(archetype, {
      idPrefix: "z",
      x: 1,
      y: 2,
      rng,
    });
    expect(spawned.kind).toBe("creature");
  });
});
