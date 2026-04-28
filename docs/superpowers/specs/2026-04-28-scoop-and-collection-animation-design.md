---
title: Scoop + collection animation
updated: 2026-04-28
status: current
domain: technical
---

# Spec 3 — Scoop + collection animation

## Why

Today, collecting a creature means colliding with it: the entire
player sub is the collection surface. That's a stale arcade pattern
that contradicts everything else the game is doing — meditative
diegetic submarine, real heading from Spec 2, audible cavitation from
Spec 2. A sub that "rams" creatures to collect them is the only beat
that breaks the world.

This spec replaces body-overlap collection with a **front-mounted
scoop**:

- The scoop is a forward arc projecting from the sub's heading.
- A creature inside the arc this frame is collected.
- A creature behind or to the side of the sub passes through harmlessly.
- A "scoop snap" animation fires when collection happens — a brief
  glyph closure on the FX layer keyed off the player's heading.

This couples directly to Spec 2: the player NEEDS the heading from
thrust controls for scoop direction to feel intentional. It also sets
up Spec 4 (torpedoes): once the front of the sub has identity (the
scoop), torpedoes launch from the same orifice.

## Vision default — gameplay-change interpretation

The scoop is a real gameplay mechanic, not a visual reskin of the
existing collection radius. Flagged so review can override:

- **(default)** Scoop = an arc only. A creature behind the sub is not
  collected. Player must aim at fish.
- *Alternative considered:* widen the collection radius and play a
  scoop animation cosmetically. Rejected because it breaks identity:
  if the visual implies aim, the mechanic must reward aim.

If gameplay-change proves too punishing on playtest, flip the default
and the spec stays viable — only the test contract narrows.

## Goals

- Front-arc scoop replaces body-overlap collection.
- Collection animation plays at the moment of capture (FX layer).
- Heading-direction-aware: scoop tracks `player.angle` from Spec 2.
- Existing chain multiplier + oxygen bonus economics unchanged. Only
  the *what* of collection changes.
- Test coverage: arc geometry (in vs out), heading tracking, animation
  event emission, regression of chain timer.

## Non-goals

- No new SFX in this spec. Existing collect SFX continues to fire.
- No new creature types. Scoop just changes how existing creatures
  are collected.
- No predator-targeting via scoop (Spec 4 — torpedoes).
- No multi-creature combo bonus for scooping a school in one arc
  (could be a follow-up; not load-bearing for launch).

## Module shape

```
src/sim/player/
  scoop.ts                # scoop arc geometry + collection test
  __tests__/
    scoop.test.ts
src/sim/engine/
  collection.ts           # MODIFIED — collectCreatures swaps to scoop test
src/render/
  layers/fx.ts            # MODIFIED — adds scoop-snap animation event
```

## Sim contract

```ts
export interface ScoopGeometry {
  /** Distance from player center to scoop tip. */
  reachPx: number;
  /** Arc half-angle in radians. Math.PI/4 = 45° each side. */
  halfAngleRad: number;
}

export const DEFAULT_SCOOP: ScoopGeometry = {
  reachPx: 60,
  halfAngleRad: Math.PI / 3,  // 60° each side, 120° total — generous
};

/**
 * True when the target is inside the player's scoop arc.
 *
 * The scoop is a circular sector with the player at the apex,
 * `player.angle` as the centerline, `halfAngleRad` to each side, and
 * `reachPx` as the radius. A target at exactly distance reachPx and
 * angle exactly halfAngleRad is considered IN (closed boundary).
 */
export function isInScoop(
  player: { x: number; y: number; angle: number },
  target: { x: number; y: number },
  geometry: ScoopGeometry,
): boolean;
```

The `collectCreatures` function in `src/sim/engine/collection.ts`
keeps its existing signature and chain/multiplier behavior. Only the
inner loop swaps body-distance test (`distance < creature.size * 0.56 + 30`)
for `isInScoop(player, creature, DEFAULT_SCOOP)`.

The scoop reach (60px) is roughly the same effective range as the
old body-collision radius for a typical creature size, so the
chain-multiplier window's expected event rate stays comparable.

## Collection animation contract

A scoop snap is a **frame event**:

```ts
export interface ScoopSnapEvent {
  /** Sim-time the event fired. */
  simT: number;
  /** Player position at capture. */
  x: number;
  y: number;
  /** Player heading at capture — drives animation orientation. */
  angle: number;
  /** Captured creature id — animation can look up sprite/glow color. */
  creatureId: string;
}
```

Emitted from `collectCreatures` and surfaced on `SceneAdvanceResult`:

```ts
interface SceneAdvanceResult {
  // ...existing...
  /** Scoop snaps that fired this frame. Renderer drains. */
  scoopSnaps: ScoopSnapEvent[];
}
```

The renderer's `fx.ts` layer subscribes and pushes a particle/glyph
burst at `(x, y)` rotated by `angle`. Animation has a fixed lifespan
(~250ms render-time) so consecutive snaps stack visually.

## Test strategy (Spec 3b — failing tests first)

### Scoop geometry (`scoop.test.ts`)

- Target directly forward at half-reach → IN.
- Target directly forward at exact reach → IN (closed boundary).
- Target directly forward at reach + 1 → OUT.
- Target at +halfAngleRad off heading at half-reach → IN.
- Target at +halfAngleRad + 0.01 → OUT.
- Target directly behind the sub → OUT regardless of distance.
- Target at zero distance → IN regardless of heading (zero-vector
  edge case).
- NaN coords → false.

### Collection integration

- A creature placed inside the scoop arc → collected; existing
  chain/multiplier/oxygen-bonus side effects fire.
- A creature placed BEHIND the sub at body-overlap distance → NOT
  collected (regression: pre-perception code would have collected it).
- Two creatures, one in arc, one behind → only the arc-creature
  collected this frame; the other persists.

### Snap-event emission

- Collection produces exactly one ScoopSnapEvent per captured creature.
- Event simT = the collection's totalTime; angle = player.angle.
- No collections this frame → empty scoopSnaps array.

### Regression — chain economy

- The existing per-mode integration test
  (`src/sim/__tests__/play-mode.test.ts` collect-beacons) still passes
  with the scoop swap, because the GOAP bot drives the player toward
  beacons, which puts the bot in beacon range with beacon ahead.

## Acceptance criteria

1. `pnpm test:node` passes including all new scoop tests + the
   existing collection regression.
2. `grep -n "creature.size \* 0.56" src/sim/engine/collection.ts`
   returns no matches — body-overlap is fully retired.
3. `pnpm dev` shows the scoop animation firing on collection (manual
   visual gate).

## Risks / open follow-ups

- **GOAP bot may struggle.** Without thrust-controls heading from
  Spec 2c's React surface, the GOAP bot's `player.angle` is set
  by `advancePlayer`'s legacy path which derives it from velocity.
  If the bot is moving toward a beacon, angle should align with the
  beacon, so scoop covers it. Worth a regression test to verify.
- **Scoop tuning is per-archetype later.** The DEFAULT_SCOOP constant
  is a starting point. Upgrade tree (`src/sim/meta/upgrades.ts`)
  could add scoop-reach upgrades; not in scope this spec.
- **Anomaly collection unaffected.** `collectAnomalies` keeps
  body-overlap (anomalies are rare floating powerups, not aim
  targets) — separate code path; flagged for future review.

## Spec-4 handoff

Spec 4 (torpedoes) places the projectile origin at the scoop's
forward midpoint. The scoop is the diegetic answer to "where do
torpedoes come out of"; this spec gives Spec 4 a clear anchor.
