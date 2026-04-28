---
title: Perception layer
updated: 2026-04-28
status: current
domain: technical
---

# Spec 1 — Perception layer (`src/sim/ai/perception/`)

## Why

GOAP profiles currently read `scene.creatures` and `scene.predators`
directly. The bot is omniscient — it knows every entity on the map,
not what a player can see. That makes the test bot useless as a
launch-readiness gate: it can "solve" challenges a real player can
never solve because the bot cheats with full information.

Predator and pirate brains have their own ad-hoc detection: predators
use `fovRadians` + `detectionRadiusPx` baked into Yuka's vision
system; pirates roll their own `_isPlayerInCone()` against
`CONE_LENGTH_PX` + `CONE_HALF_ANGLE` constants. Both detection paths
ignore world geometry — a predator on the far side of a debris field
or behind a leviathan still spots the player through the obstacle.

This spec lifts perception out of each brain into a single
`Perception` module that:

1. Answers "can A perceive B?" for any pair of scene entities.
2. Honors radius, cone-from-heading, and **line-of-sight** through
   three occluder classes: anomaly debris fields, locked-room walls,
   leviathan silhouettes.
3. Wires into both the GOAP bot (player governance) AND
   PredatorBrain + PirateBrain (universal — Q1=(b)).

By the end of this spec, the GOAP bot's evaluators no longer touch
`scene.creatures` or `scene.predators` directly. They iterate a
**perceived subset** filtered by the perception module. Predator FOV
checks and pirate cone checks delegate to the same module.

## Goals

- One sensor surface, used by every brain.
- Test bot survival drops to player-realistic numbers (validated in
  Spec 1b's failing test).
- LoS occluders are real geometry tests, not heuristics. A predator
  behind a locked-room wall genuinely cannot see the player.
- Per-archetype perception tuning lives on archetype profiles
  (`fovRadians`, `detectionRadiusPx`) — no constants buried in brain
  classes.
- Performance budget: O(observers × visible) per tick, with cheap
  early-outs (radius before angle before LoS).

## Non-goals

- No hearing / acoustic perception. Sight only.
- No memory persistence beyond what the existing `MemorySystem`
  already does for predators. Perception answers "can I see now"; the
  brain decides what to do with that answer.
- No occlusion by ambient creatures or other predators. Only the
  three named occluder classes block sight.
- No fog-of-war for the renderer. Visual fog stays a render concern;
  this is sim-side perception.

## Module shape

```
src/sim/ai/perception/
  index.ts          # public barrel
  types.ts          # PerceptionContext, PerceptionResult, Occluder
  module.ts         # createPerception() + perceive() + perceives()
  occluders.ts      # collectOccluders(scene): pure scene → Occluder[]
  geometry.ts       # segmentIntersectsCircle, segmentIntersectsRect
  __tests__/
    perception.test.ts
    occluders.test.ts
    geometry.test.ts
```

### Contract

```ts
export interface PerceptionContext {
  /** All occluders for this tick, prebuilt once. */
  occluders: readonly Occluder[];
  /** Viewport — needed because the locked-room walls are framed
   *  by the viewport clamp, not by world coords. */
  dimensions: ViewportDimensions;
}

export interface PerceiverProfile {
  /** Visual radius in playfield pixels. */
  radiusPx: number;
  /** Cone half-angle in radians. Math.PI for omnidirectional. */
  coneHalfAngleRad: number;
  /** True if the perceiver tracks heading; false for radius-only
   *  observers like motionless creatures. */
  hasHeading: boolean;
}

export interface PerceiverState {
  x: number;
  y: number;
  /** Forward heading angle in radians. Ignored when hasHeading=false. */
  headingRad: number;
}

export interface Target {
  x: number;
  y: number;
  /** Optional self-id so a perceiver doesn't perceive itself. */
  id?: string;
}

export interface Perception {
  /** Boolean check — radius first, then cone, then LoS. */
  perceives(perceiver: PerceiverState, profile: PerceiverProfile, target: Target): boolean;
  /** Filter a list of targets to those visible to the perceiver. */
  perceive<T extends Target>(perceiver: PerceiverState, profile: PerceiverProfile, targets: readonly T[]): T[];
}

export function createPerception(context: PerceptionContext): Perception;
```

### Occluders

```ts
export type Occluder =
  | { kind: "debris"; x: number; y: number; radius: number }
  | { kind: "leviathan"; x: number; y: number; radius: number }
  | { kind: "wall"; x1: number; y1: number; x2: number; y2: number };
```

`collectOccluders(scene, dimensions)` produces this list per tick:

- **debris** — `scene.anomalies.filter(a => a.type === "repel")`. Repel
  anomalies have visible debris fields in the renderer; the sim treats
  them as circle occluders of `anomaly.size * 1.4`. (Other anomaly
  types are powerups, not obstacles — keep them transparent.)
- **leviathan** — every entity in `scene.predators` whose archetype
  prefix is `*-leviathan` (the existing `pinAsLeviathan` flag). Radius
  = the leviathan's collision radius.
- **wall** — only when the active chunk's `travel === "locked-room"`.
  Four wall segments framing the viewport's locked play band. The
  bridge already knows this band — perception reads it from the
  ViewportDimensions + `cameraTravel` slot the bridge already exposes.

`open` and `corridor` chunks contribute no walls.

### Algorithm (per `perceives` call)

1. **Radius cull.** `(dx² + dy²) > radiusPx²` → false.
2. **Cone cull.** If `hasHeading`, compute `dot(forward, toTarget)`;
   reject when below `cos(coneHalfAngleRad)`.
3. **LoS cull.** Walk `occluders`; reject if any occluder segment-
   intersects the perceiver→target ray AND the occluder is not the
   perceiver itself nor the target itself. (Self-id check prevents a
   leviathan from occluding its own line-of-sight to the player.)

Math precomputation: `cos(coneHalfAngleRad)` once per `perceive()`
batch call rather than per target.

## Migration plan (Q1=(b) universal)

### Phase 1 — Module + tests (this commit + 1b/1c)

`src/sim/ai/perception/` lands with full unit tests on geometry,
occluder collection, and the boolean `perceives` matrix. No brain
changes yet. Tests in `1b` are written against the public contract.

### Phase 2 — GOAP bot rewires

`GoapBrainOwner` gains a `perception: Perception` field populated by
the runtime each tick. GOAP profiles' helpers update:

```ts
function findNearestBeacon(player: Player, creatures: Creature[]): Vec2 | null
```

becomes:

```ts
function findNearestPerceivedBeacon(owner: GoapBrainOwner): Vec2 | null {
  const visible = owner.perception.perceive(
    { x: scene.player.x, y: scene.player.y, headingRad: scene.player.angle },
    PLAYER_PERCEPTION_PROFILE,
    scene.creatures,
  );
  // …existing nearest-of logic
}
```

`PLAYER_PERCEPTION_PROFILE` constants land in
`src/sim/ai/perception/profiles.ts` alongside the predator + pirate
ones. The values mirror what a real player can see on screen:

```ts
export const PLAYER_PERCEPTION_PROFILE: PerceiverProfile = {
  radiusPx: 520,             // ~viewport-diagonal radius, generous
  coneHalfAngleRad: Math.PI, // omnidirectional — player has eyes everywhere
  hasHeading: false,
};
```

Note: omnidirectional player perception is correct — the camera shows
a full 360° radius, the player isn't constrained to a forward cone.
What changes vs. today is the **radius** (no longer infinite) and the
**LoS** (debris and leviathans now genuinely block sight).

### Phase 3 — PredatorBrain rewires

`PredatorBrain.canSeePlayer()` (Yuka Vision wrapper) is replaced by:

```ts
this.perception.perceives(
  { x: this.position.x, y: this.position.y, headingRad: this.rotation.toEulerY() },
  PREDATOR_PROFILE_FROM_ARCHETYPE(this.profile),
  { x: playerRef.position.x, y: playerRef.position.y, id: "player" },
);
```

The existing `MemorySystem` is untouched — it still records the last
perceived player position. Perception just decides whether *now* counts
as a perception event. The 7 states (patrol/stalk/charge/strike/recover/
flee/ambient) make no transition-logic changes; they keep reading
`brain.canSeePlayer()` which now delegates to the perception module.

### Phase 4 — PirateBrain rewires

`PirateBrain._isPlayerInCone()` is replaced by `perception.perceives`
with `PIRATE_PERCEPTION_PROFILE` derived from the existing
`CONE_LENGTH_PX` + `CONE_HALF_ANGLE` constants. The awareness ramp
logic stays exactly as it is — only the cone test moves.

`CONE_LENGTH_PX` and `CONE_HALF_ANGLE` move out of `PirateBrain.ts`
into `perception/profiles.ts`. PirateBrain reads them via the profile
constant.

### Runtime wire-up

`AIManager.update(deltaTime)` rebuilds the perception context once at
the top of each tick:

```ts
const occluders = collectOccluders(scene, dimensions);
const perception = createPerception({ occluders, dimensions });
this.perception = perception;
// …existing brain ticks read this.perception
```

The GOAP `PlayerSubObservation` gains a `perception: Perception` field;
`useGameLoop`'s observation builder populates it from `aiManager.perception`.

## Test strategy (Spec 1b — failing tests first)

Three tiers, each test failing until 1c lands:

### Geometry (pure)

- `segmentIntersectsCircle` — happy path, tangent edge, near-miss,
  inside-circle, zero-length segment.
- `segmentIntersectsRect` — corner cases (literal corners), parallel
  edges, segment fully outside.

### Occluder collection (pure)

- Empty scene → empty occluders.
- Scene with 2 repel anomalies + 1 lure anomaly → 2 debris occluders.
- Scene with leviathan-flagged predator → 1 leviathan occluder.
- Locked-room chunk → 4 wall occluders matching viewport band.
- Open / corridor chunk → 0 wall occluders.

### Perception matrix

- Radius: target inside vs outside `radiusPx`.
- Cone: target at heading, at +half-angle, at +half-angle + 1°,
  behind perceiver. Repeat for `hasHeading: false` (always passes
  cone test).
- LoS — debris: perceiver and target on opposite sides of a debris
  occluder → false. Same side → true.
- LoS — leviathan: same.
- LoS — wall: perceiver inside locked-room, target outside → false.
  Both inside → true.
- Self-occlusion guard: leviathan-as-perceiver passes its own ray.

### Player journey gate (the launch-polish bar)

A new integration test in `src/sim/engine/__tests__/perception-bot-survival.test.ts`:

> **Given** the `createCollectBeaconsProfile` GOAP bot,
> **When** it dives a fixed seed for 60 simulated seconds,
> **Then** its survival rate drops from the current omniscient baseline
> (~95%, measured before this spec) to a player-realistic 55–75% band
> AND its score-per-minute stays within the same band the human
> playtest recorded on 2026-04-23 (TBD — captured in 1b).

This test captures the failing baseline in 1b and the green target
when 1c lands. If survival exceeds 75%, perception is too generous; if
below 55%, occluders are too aggressive. Either fails the gate.

## Acceptance criteria

A reviewer can confirm Spec 1 by:

1. `grep -r "scene.creatures\|scene.predators" src/sim/ai/goap/` returns
   only references inside helper functions that route through
   `owner.perception.perceive(…)`.
2. `grep "_isPlayerInCone\|canSeePlayer" src/sim/ai/{predator,pirate}-brain/`
   shows the methods now delegate to `perception.perceives`.
3. `pnpm test` passes including the perception-bot-survival gate.
4. `pnpm build` size delta < 4 KB gz (perception module is small).

## Risks / open follow-ups

- **Perceived occlusion through transparent anomalies.** Lure / breath
  / overdrive / lamp-flare anomalies are not occluders — confirmed by
  the renderer's transparent treatment. Only `repel` debris fields
  occlude.
- **Locked-room walls and the player.** When the player is inside a
  locked-room chunk, predators outside the chunk should NOT see in.
  The wall occluders enforce this in both directions.
- **Performance for high-creature counts.** Worst case: 30 creatures
  × 6 occluders × player perception = 180 segment checks per tick.
  Within budget; profiled in 1c. If this regresses we add a coarse
  spatial-hash early-out, but not in this spec.

## Spec-2 handoff

Spec 2 (player Vehicle + thrust controls) needs the player's heading
to compute cavitation direction. Perception's `PerceiverState.headingRad`
contract aligns: when the player gains a real heading from thrust
input, the player perception profile flips `hasHeading: true` and the
omnidirectional radius shrinks to a forward-biased cone. That's a
profile change, not an algorithm change — the perception module is
ready for it.
