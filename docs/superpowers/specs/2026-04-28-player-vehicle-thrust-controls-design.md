---
title: Player Vehicle + thrust controls
updated: 2026-04-28
status: current
domain: technical
---

# Spec 2 — Player Vehicle + thrust controls

## Why

Today the player moves by tap-to-move: a target point is set on the
player record and `advancePlayer` interpolates toward it. No inertia,
no heading, no feel. For a meditative submarine explorer that lands on
mobile + desktop, the input model is the single biggest distance
between "demo" and "shipped game."

This spec replaces tap-to-move with a thrust-based Vehicle:

- The player sub is a Yuka `Vehicle` (mass, maxForce, drag, heading).
- Mobile: a virtual twin-stick — left thumb thrusts, right thumb aims.
- Desktop: WASD or arrows thrust, mouse aims.
- Sprint pushes the sub past comfortable cruise into cavitation, which
  predators perceive (couples Spec 1's perception layer to a real
  player-cost mechanic).

## Vision defaults — pending user review

Five vision-impacting choices the loop made by default, marked
explicitly so the next session can flip any of them without rewriting
the architecture:

1. **Movement model: real Yuka Vehicle with inertia.** Mass + drag
   means letting go of input doesn't stop the sub instantly. Aligns
   with the meditative submarine identity. *Alternative considered:*
   velocity-direct (snappy, arcade-y) — rejected because it
   contradicts the "meditative" pillar in `docs/DESIGN.md`.
2. **Mobile: twin-stick.** Left half thrust, right half aim. Sets up
   Spec 4 (torpedoes) without re-tutorialising. *Alternative:* fixed
   bottom-left stick + tap-to-aim.
3. **Desktop: WASD or arrows + mouse aim.** Both keyboard layouts
   bound; cursor position drives the sub's facing. *Alternative:* WASD
   only or keyboard-only no mouse.
4. **Cavitation as tension.** Cavitation FX activate only at sprint;
   predators perceive cavitation events from outside their cone (a
   new "audio cue" channel through perception). The visual sells the
   mechanic without a tutorial. *Alternative:* purely cosmetic
   particle stream above 70% speed.
5. **Sprint = cavitation.** Holding sprint (mobile button / desktop
   shift) pushes the sub past cruise speed; this is what triggers
   cavitation + predator perception. Released early, it acts like
   normal cruise. *Alternative:* sprint as a 2s cooldown burst.

If a vision default proves wrong on playtest, flip the bullet, change
the test contract, and re-run. The architecture below survives any of
the five flips.

## Goals

- Sub has heading. `Player.angle` becomes load-bearing — Spec 1's
  perception already reads it; Spec 2 makes it real.
- Mobile joystick that doesn't fight the camera.
- Desktop input that handles WASD and arrows, with optional mouse aim.
- Sprint + cavitation as paired mechanics — visual + gameplay
  feedback, not decoration.
- Test coverage that asserts the controls contract end-to-end:
  joystick magnitude → thrust force, drag decay shape, sprint window,
  cavitation activation threshold.

## Non-goals

- No haptics this spec (mobile platform-bridge story for a follow-up).
- No tutorial overlay. The HUD already has hooks for control hints —
  the existing tutorial pillar lives in `src/ui/screens` and is its
  own polish task.
- No player-killable predators in this spec (Spec 4).
- No automated bot port to thrust controls — the GOAP `DiveInput`
  contract stays target-based; the thrust translation layer wraps it.

## Module shape

```
src/sim/
  player/
    vehicle.ts          # PlayerVehicle (extends GameVehicle)
    thrust.ts           # applyThrust + drag step + sprint window
    cavitation.ts       # cavitation event emitter — threshold + cooldown
    __tests__/
      thrust.test.ts
      cavitation.test.ts
src/ui/
  hud/
    Joystick.tsx        # virtual twin-stick component
    SprintButton.tsx    # mobile sprint button
  hooks/
    useTouchInput.ts    # rewritten — joystick → DiveInput
    useKeyboardInput.ts # WASD/arrows → DiveInput
    useMouseAim.ts      # cursor → heading angle
src/render/
  layers/
    fx.ts               # cavitation particle stream — ADDS to existing fx layer
```

Files in `src/ui/` and `src/render/` are React/Pixi surface; sim layer
holds the contract. Sim never imports from those.

## Sim contract

`PlayerVehicle` extends the existing `GameVehicle` from `src/sim/ai/steering.ts`:

```ts
class PlayerVehicle extends GameVehicle {
  // Inherited from Vehicle: position, velocity, maxSpeed, maxForce
  /** Cruise max speed (px/sec) — typical movement speed. */
  cruiseMaxSpeed: number;
  /** Sprint multiplier on cruise. Hold sprint → maxSpeed jumps to cruise × this. */
  sprintMultiplier: number;
  /** Drag coefficient (per second). Higher = stops faster on input release. */
  drag: number;
}
```

`DiveInput` gains a couple of fields, all optional so existing GOAP
callers continue working:

```ts
interface DiveInput {
  x: number;        // existing — target x (legacy) or thrust vector x
  y: number;        // existing — target y (legacy) or thrust vector y
  isActive: boolean;// existing — input present this frame
  /** New. When set, x/y are interpreted as a normalized thrust vector
   *  (magnitude 0..1) rather than a target point. The sim picks the
   *  interpretation by checking this field. */
  thrust?: boolean;
  /** New. Heading angle in radians the sub should face. Optional —
   *  when absent, the sub keeps its current heading or aligns with
   *  velocity direction. */
  aim?: number;
  /** New. Sprint hold flag. Active → maxSpeed = cruiseMax × sprintMultiplier. */
  sprint?: boolean;
}
```

`advancePlayer` branches on `input.thrust`:

- `thrust !== true` → legacy target-based path. GOAP bot, tap-to-move
  (where it survives), all back-compat.
- `thrust === true` → new path:
  1. Apply thrust as a force on the Vehicle (`vehicle.applyForce(...)`).
  2. Drag: `velocity *= 1 - drag * deltaTime`.
  3. Speed clamp: `if sprint, maxSpeed = cruise × sprintMultiplier; else cruise`.
  4. Heading: if `input.aim` is set, slew `angle` toward `aim` at a
     rate of `headingSlewRate * deltaTime` (no instant snap).

## Cavitation contract

Cavitation is an **event stream**, not a continuous flag:

```ts
interface CavitationEvent {
  x: number;
  y: number;
  /** Wall-clock time the event fired. */
  t: number;
  /** Magnitude (0..1) — drives particle density + audio gain. */
  intensity: number;
}
```

`cavitation.ts` exports:

```ts
class CavitationEmitter {
  /** Call once per frame with the player's velocity vector + sprint flag. */
  step(vx: number, vy: number, sprinting: boolean, dt: number, t: number): CavitationEvent | null;
}
```

Implementation:

- Track `framesAboveThreshold` while `sprinting && speed > cruiseMaxSpeed × 0.95`.
- Once `framesAboveThreshold >= MIN_FRAMES_TO_EMIT` (≈0.3s), emit a
  `CavitationEvent` with `intensity = (speed - cruise) / (sprintMax - cruise)`.
- After emit, cool down for `EMIT_COOLDOWN_SECONDS` so the renderer
  doesn't get a per-frame stream of events; particle persistence on
  the FX layer extends the visual.

The renderer subscribes to events and pushes a particle burst.

The **perception layer** also subscribes: when an event fires, every
predator within a configurable radius (`CAVITATION_AUDIBLE_RADIUS_PX`)
gets a memory bump on the player — same shape as the existing
`MemorySystem.timeLastSensed` write, just sourced from cavitation
instead of LoS perception. This is the gameplay coupling: sprint =
visual cue + you're now audible to nearby predators even out of cone.

The audible-radius write does NOT require LoS — sound travels around
debris. This is the correct cross of cavitation × Spec 1's perception
contract.

## Test strategy (Spec 2b — failing tests first)

### Pure thrust math (`thrust.test.ts`)

- Idle input → velocity decays at the drag rate.
- Constant input at magnitude 1.0 → speed converges to `cruiseMaxSpeed`.
- Sprint hold → speed converges to `cruiseMaxSpeed × sprintMultiplier`.
- Input release at speed → velocity decays exponentially back to zero
  with a half-life matching the drag coefficient.
- Heading slew: aim 90° off → angle reaches the target over multiple
  frames at `headingSlewRate`, never instantly.
- Joystick magnitude < deadzone → no force applied.

### Cavitation emitter (`cavitation.test.ts`)

- Below threshold for any duration → no event.
- Above threshold for < `MIN_FRAMES_TO_EMIT` → no event yet.
- Above threshold for ≥ `MIN_FRAMES_TO_EMIT` → exactly one event.
- After event, no further events for `EMIT_COOLDOWN_SECONDS`.
- Drop below threshold mid-window → counter resets, no event.

### Player-perception coupling

- Cavitation event → every predator within `CAVITATION_AUDIBLE_RADIUS_PX`
  has its memory of the player updated; predators outside, untouched.
- Predators behind LoS occluders STILL get the memory bump (sound
  ignores walls).

### Bot integration (regression check)

- The existing `play-mode.test.ts` "collect-beacons profile" test
  still passes — the new thrust path is opt-in via `input.thrust`,
  GOAP bots stay on the legacy target path.

## Acceptance criteria

1. `pnpm test:node` passes including all new thrust + cavitation tests.
2. `pnpm dev` — load `?seed=…&controls=thrust` (or new default), drive
   with WASD + mouse on desktop AND virtual joystick on a mobile
   viewport. Sub moves with weight, heading slews smoothly, sprint
   visibly fires particles, predators within audible radius react.
3. Existing GOAP-driven `play-mode.test.ts` still green — back-compat.
4. Capacitor build runs on Android emulator with joystick + sprint
   button visible and responsive.

## Risks / open follow-ups

- **GOAP rewrite resistance.** Bots stay on tap-target until / unless
  we want to test thrust governance. That's a Spec 1+ concern.
- **Sprint button + lamp button collision.** The HUD already has a
  lamp interaction; sprint button must not occlude it. HudShell
  layout is the contract author.
- **Mouse-aim vs touch-aim parity.** Mouse aim updates per pixel;
  touch aim only when the right thumb is down. Frame-to-frame
  consistency on the thrust path must not depend on aim being set
  every frame.
- **Cavitation event flood under devFastDive.** `useDevFastDive`
  scales sim time; cavitation cooldown is in wall-clock seconds.
  Cooldown moves to sim-time so dev mode doesn't trigger event
  storms.

## Spec-3 handoff

Spec 3 (scoop + collection animation) reads the player's heading to
determine the scoop's forward arc. After this spec, `Player.angle`
reflects real player intent; Spec 3's geometry has a stable input.
