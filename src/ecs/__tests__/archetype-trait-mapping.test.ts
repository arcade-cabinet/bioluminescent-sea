import { describe, expect, test } from "vitest";
import {
  ARCHETYPE_CATALOGUE,
  type ActorKind,
  archetypesOfKind,
} from "@/sim/entities";

/**
 * Audit: every archetype produced by the factory must map cleanly to one
 * of the Koota traits in `src/ecs/traits.ts`. This guard catches the
 * "added an archetype but forgot to give it a runtime home" failure mode.
 *
 * The mapping itself is documented in `traits.ts`; this test enforces
 * that documented contract by name. Adding a new archetype kind without
 * also updating this test means the contract drifted and someone needs
 * to look at `src/ecs/world.ts` to see how the new kind makes it onto a
 * trait.
 */
const KIND_TO_TRAIT: Record<ActorKind, string> = {
  creature: "CreatureEntity",
  predator: "PredatorEntity",
  pirate: "PirateEntity",
  leviathan: "PredatorEntity",
  "enemy-sub": "PredatorEntity",
  anomaly: "AnomalyEntity",
  player: "PlayerAvatar",
};

describe("archetype → Koota trait mapping audit", () => {
  test("every archetype kind has a documented trait", () => {
    const allKinds = new Set<ActorKind>();
    for (const archetype of Object.values(ARCHETYPE_CATALOGUE)) {
      allKinds.add(archetype.kind);
    }
    for (const kind of allKinds) {
      expect(
        KIND_TO_TRAIT[kind],
        `kind "${kind}" has no trait mapping — update src/ecs/traits.ts header and KIND_TO_TRAIT`,
      ).toBeDefined();
    }
  });

  test("every documented kind has at least one archetype in the catalogue", () => {
    for (const kind of Object.keys(KIND_TO_TRAIT) as ActorKind[]) {
      expect(
        archetypesOfKind(kind).length,
        `kind "${kind}" is documented but has no archetype — KIND_TO_TRAIT is stale`,
      ).toBeGreaterThan(0);
    }
  });

  test("leviathan and enemy-sub both ride the PredatorEntity trait", () => {
    expect(KIND_TO_TRAIT.leviathan).toBe("PredatorEntity");
    expect(KIND_TO_TRAIT["enemy-sub"]).toBe("PredatorEntity");
  });
});
