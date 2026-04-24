---
title: Architecture
updated: 2026-04-23
status: current
domain: technical
---

# Architecture

This document owns the technical stack, directory layout, and runtime
data flow. Gameplay mechanics are in [RULES.md](./RULES.md). Testing
is in [TESTING.md](./TESTING.md). Deployment is in
[DEPLOYMENT.md](./DEPLOYMENT.md).

## 3D world, 2D canvas

Bioluminescent Sea is a 3D world rendered to a 2D canvas. The engine
reasons in world-meters with three coordinates:

- `x` — horizontal, world-meters around 0. The player drifts inside
  `[-widthMeters/2, +widthMeters/2]`.
- `y` — vertical depth, world-meters; `+y` points down into the trench.
  `y = 0` is surface; `y ≈ 3600` is the target trench floor.
- `z` — parallax-layer depth, unitless, roughly `[0, 1]`. `z = 0` is
  the nearest plane; `z = 1` is the far abyss. The renderer uses `z`
  to pick a layer and a scale, not perspective math.

A camera owns `scrollMeters` (the depth the viewport is centered on)
and `pxPerMeter` (zoom). The renderer projects:

```
screenX = viewCenterX + x * pxPerMeter * lerp(1, 0.35, z)
screenY = viewCenterY + (y - scrollMeters) * pxPerMeter * lerp(1, 0.45, z)
```

Parallax is the only thing `z` does visually. The simulation treats
`z` as a placement hint — entities at higher `z` are further away and
are not collidable with the player.

## System overview

```
┌───────────────────────────────────────────────────┐
│                     React UI                       │
│  Start / HUD / GameOver screens, phase machine     │
├───────────────────────────────────────────────────┤
│                     Koota ECS                      │
│  Traits (Position, Velocity, Glow, Threat, …),     │
│  queries, actions, React hooks                     │
├───────────────────────────────────────────────────┤
│                   PixiJS renderer                  │
│  Layered scene graph: far → mid → near → fx → UI   │
├───────────────────────────────────────────────────┤
│                 Simulation engine                  │
│  src/sim/rng, src/sim/world, src/sim/chunk,        │
│  src/sim/dive, src/sim/meta, src/sim/ai (Yuka)     │
├───────────────────────────────────────────────────┤
│                    Audio stack                     │
│  Tone.js ambient, Howler SFX, depth-keyed mixer    │
├───────────────────────────────────────────────────┤
│             Authored JSON (config/raw/)            │
│  Biomes, creature species, landmarks — Zod-validated│
└───────────────────────────────────────────────────┘
```

## Directory structure

```
config/
  raw/
    biomes/biome-*.json         # authored biome tuning
    creatures/creature-*.json   # authored species definitions
    landmarks/landmark-*.json   # depth-keyed route anchors
  compiled/                     # gitignored; produced by scripts/compile-content.mjs

scripts/
  compile-content.mjs           # raw → compiled, Zod-validated
  sync-main.sh                  # post-merge local cleanup

src/
  sim/                          # Pure engine — no React, no DOM, no pixi
    rng/
      rng.ts                    # createRng(seed), randomSeed, hashSeed
      codename.ts               # adjective-adjective-noun codec
      __tests__/
    world/
      types.ts                  # Vec2, Vec3, Biome, Chunk, WorldBounds
      biomes.ts                 # biomeAtDepth, BIOMES table, nextBiome
      chunks.ts                 # generateChunk(seed, index)  [PR F]
      __tests__/
    entities/                   # creature / predator / pirate factories
    dive/                       # createDive, advanceDive, telemetry, objectives
    ai/                         # Yuka behaviors for threats
    index.ts                    # barrel

  ecs/
    traits.ts                   # Position, Velocity, Glow, Collider, Beacon,
                                # Threat, ChunkMember, Player
    world.ts                    # createDiveWorld(seed), systems tick order  [PR D]
    actions.ts                  # advanceDiveFrame, collectBeacon, …        [PR D]
    hooks.ts                    # useDiveState, useTelemetry                [PR D]

  render/                       # PixiJS; no React
    stage.ts                    # Application lifecycle + layers
    camera.ts                   # world → screen projection
    layers/
      backdrop.ts               # abyss gradient, depth fog, biome tint
      parallax.ts               # multi-plane drift
      entities.ts               # creature / predator / pirate sprites
      player.ts                 # sub + headlamp cone + sonar ping
      lighting.ts               # depth-based vignette + tint
    bridge.ts                   # Koota query → sprite sync

  audio/
    ambient.ts                  # Tone.js pad, depth/biome-modulated
    sfx.ts                      # Howler pool
    mixer.ts                    # master gain, mute, reduced-motion

  ui/
    App.tsx                     # mount point
    dive/
      DiveApp.tsx               # ECS world + pixi stage lifecycle, phase machine
      DiveCanvas.tsx            # pixi host; forwards input
    shell/
      StartScreen.tsx, GameOverScreen.tsx, GameViewport.tsx, OverlayButton.tsx
    hud/
      Hud.tsx, StatRow.tsx, ObjectiveBanner.tsx, BiomeChip.tsx,
      CodenameChip.tsx
    hooks/
      useGameLoop.ts, useTouchInput.ts, useSearchParamSeed.ts
    theme/
      global.css                # @theme + CSS vars
      tokens.ts                 # typed re-export of color tokens

  platform/
    orientation.ts, safeArea.ts, persistence.ts

  data/
    schemas.ts                  # Zod schemas for content
    index.ts                    # compiled-content importers
```

## Boundary rules

1. **`src/sim/*` is pure.** It imports only from other `src/sim/*`
   modules and pure deps (seedrandom, yuka). No React, no DOM, no
   pixi, no Koota, no audio. Enforced by `tsconfig.sim.json`.
2. **`src/ecs/*` imports `src/sim/*`.** It lifts sim state into traits.
   The sim does not know Koota exists.
3. **`src/render/*` reads traits through queries.** It never writes
   traits. It does not import React.
4. **`src/ui/*` reads traits through hooks.** It never writes traits
   directly — writes go through `src/ecs/actions.ts`.
5. **`src/audio/*` reads traits through queries.** Audio events are
   a subscription to telemetry changes; no audio code in the sim.
6. **`src/platform/*` is the only place Capacitor is imported.**

These boundaries are what make the game testable. Violations are a
refactor, not a "just this once."

## Data flow (one frame)

```
requestAnimationFrame(t)
  ├─ ecs.run(advanceDiveFrame, dt)
  │    ├─ reads Position/Velocity traits
  │    ├─ delegates physics + AI to src/sim/dive + src/sim/ai
  │    │    └─ pure, testable, no side effects
  │    └─ writes updated traits
  ├─ render.sync()
  │    └─ reads updated traits, mutates pixi sprites
  ├─ audio.sync()
  │    └─ reads telemetry, updates Tone.js parameters
  └─ react.useSyncExternalStore
       └─ HUD re-renders when subscribed traits change
```

## Seeded determinism

Every run is reproducible from its seed. The seed drives creature,
predator, and pirate placement; chunk generation (one pure function
per chunk index); landmark ordering; and the run codename.

Replays, bug reports, daily shared trenches, and share URLs all use
the same `seed <-> codename` bijection. Running a build with
`?seed=kelpish-vellum-benthos` yields identical frames to anyone
else who loaded that URL at the same commit.

## Dependency map

| From          | Allowed imports                                           |
| ------------- | --------------------------------------------------------- |
| src/sim/*     | src/sim/*, seedrandom, yuka, (pure stdlib)                |
| src/ecs/*     | src/ecs/*, src/sim/*, koota                               |
| src/render/*  | src/render/*, src/ecs/*, src/sim/* (types only), pixi.js  |
| src/audio/*   | src/audio/*, src/ecs/*, src/sim/* (types), tone, howler   |
| src/platform/*| src/platform/*, @capacitor/*                              |
| src/data/*    | src/data/*, src/sim/* (types), zod                        |
| src/ui/*      | any of the above; no cross-ui-component coupling          |

## Performance contract

- Target 60 FPS on mid-tier mobile (iPhone 12, Pixel 6).
- PixiJS ticker drives renderer; entity count budget per chunk is
  tracked in `src/sim/world/chunks.ts` constants (PR F).
- If a frame drops below 50 FPS on mobile, cull entities outside the
  current chunk window before the renderer runs.
- Tone.js ambient synth uses a single low-pass polyphonic pad; CPU
  budget < 3% on a Pixel 6.
