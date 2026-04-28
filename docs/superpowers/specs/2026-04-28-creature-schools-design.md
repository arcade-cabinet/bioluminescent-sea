---
title: Creature schools as Yuka flocks + skittish flee
updated: 2026-04-28
status: current
domain: technical
---

# Spec 5 — Creature schools as Yuka flocks + skittish flee

## Why

Surprise discovery during the assessment: `AIManager.syncCreatures`
already wires `AlignmentBehavior + CohesionBehavior + SeparationBehavior`
per-species (fish, jellyfish), with seed-derived weights so each dive's
flocks feel different. The "schools as flocks" pillar is mostly
**already shipped**. What's missing is **skittish flee on player
approach** — a creature should dart away when the sub gets too close,
selling the "you're disturbing the ecosystem" beat.

This spec adds:

- A `FleeFromPlayerBehavior` Yuka steering behavior that pushes the
  creature away when the player is within `skittishRadiusPx`.
- The behavior weight is seed-derived per-species (some fish are
  fearless, some are skittish — that variance reads as ecology).
- Plankton stay non-flockers (already excluded from `flockers`).

It's a small surface area on purpose — the existing flock wiring is
the load-bearing part; this spec just adds the player-aware flee
piece that's missing.

## Vision default

Keep the meditative tone: skittish creatures **flee within radius**
but **return to ambient flocking** as soon as the player exits. No
permanent fear, no creature health, no death-from-fright. The player
disturbing a school is a sensory beat, not a punishment — the school
re-forms.

## Goals

- Per-species skittish radius and flee weight, both seed-derived.
- Behavior is a real Yuka SteeringBehavior class (matches the
  existing `WrapPlayBandBehavior` pattern in `src/sim/ai/steering.ts`).
- Flee force scales 1.0 at zero distance to 0.0 at edge of radius —
  smooth, not on/off, so the school's reaction reads as graceful.
- No new entity types, no archetype changes — just steering plumbing.
- Tests assert: creature outside radius receives no force; inside
  radius receives a force pointing away from the player; force
  magnitude scales with proximity.

## Non-goals

- No new species. Use existing fish + jellyfish + plankton.
- No predator-aware flee (predators already cause fish to die when
  collided). The skittish behavior is player-aware only.
- No "memory" of having been startled — re-disturbing instantly
  re-startles.
- No flee from torpedoes (Spec 4) — torpedoes are too brief to
  meaningfully scare a fish, and torpedo-aware flee complicates the
  "single-pass meditative" feel.
- No bot-driven schools tests — the existing GOAP integration tests
  pass through the same `syncCreatures` path; the flee behavior is
  additive and doesn't regress them.

## Module shape

```
src/sim/ai/
  steering.ts                # MODIFIED — adds FleeFromPlayerBehavior class
  manager.ts                 # MODIFIED — registers behavior per-species,
                             #   reads player ref into the behavior each tick
  __tests__/
    flee-from-player.test.ts # NEW
```

## Sim contract

```ts
export class FleeFromPlayerBehavior extends SteeringBehavior {
  /** Max radius at which the player still influences this creature. */
  radius: number;
  /** Reference to the player vehicle (set by AIManager). */
  playerRef: Vehicle | null;

  constructor(radiusPx: number);

  calculate(vehicle: Vehicle, force: Vector3, _delta: number): Vector3;
}
```

The behavior:

1. If `playerRef` is null OR distance to player > `radius` → no force.
2. Else compute `awayDir = (vehicle - player).normalize()`.
3. Force magnitude = `(1 - distance/radius)` — smooth falloff.
4. Apply: `force += awayDir * magnitude * vehicle.maxForce`.

Per-species seed-derived parameters via existing `resolveNumeric`:

```ts
const skittishRadius = resolveNumeric(
  [80, 220], this.diveSeed, `flock:${type}:skittishRadius`,
);
const skittishWeight = resolveNumeric(
  [0.0, 1.2], this.diveSeed, `flock:${type}:skittishWeight`,
);
```

The 0.0 lower bound on weight is intentional: some dives produce
fearless fish (radius is irrelevant), others produce a school that
parts like the Red Sea. Variance reads as ecology.

## Test strategy (Spec 5b — failing tests first)

### Unit (`flee-from-player.test.ts`)

- Player ref null → force unchanged.
- Player outside radius → force unchanged.
- Player at vehicle position → force is in some direction with full
  magnitude (the zero-vector edge case picks a stable direction; tests
  assert force is non-zero, accept any direction).
- Player on +X side of vehicle → force points -X.
- Force magnitude scales: at half-radius → ~0.5 of max; at quarter
  radius → ~0.75.
- Edge of radius → force magnitude approaches 0.

### Manager integration

- `syncCreatures` registers a `FleeFromPlayerBehavior` per species
  with seed-derived weights.
- After `updatePlayer(player)`, every creature behavior's `playerRef`
  is updated.
- Two dives with different seeds produce different `skittishRadius`
  and `skittishWeight` for the same species (existing pattern; this
  test mirrors the alignment/cohesion seed-variance test).

## Acceptance criteria

1. `pnpm test:node` passes including new flee-from-player tests.
2. The existing per-mode integration test (`play-mode.test.ts`)
   continues to pass — flocking is purely additive.
3. `grep "FleeFromPlayerBehavior" src/sim/ai/manager.ts` shows the
   behavior wired into `syncCreatures` alongside the existing flock
   trio.

## Risks / open follow-ups

- **Performance:** N creatures × O(1) distance check per frame is
  negligible. The existing `flockingBehaviors` Map already amortizes
  steering construction. No spatial-hash needed.
- **Visual regression:** if `skittishWeight` rolls high on a dive
  AND the player gets close to a tight-cohesion school, the school
  may scatter so far it loops the WrapPlayBand. That's actually
  fine behaviorally (school re-forms via cohesion as player leaves)
  — just noting.

## Spec close

This is the last spec in the launch-polish work-unit. After 5c
lands, the final-pass items in the directive trigger: cumulative
review on the full branch diff, lint/typecheck/test:node/test:dom/
test:browser/test:e2e all green locally, push, open the single PR.
