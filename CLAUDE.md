---
title: Claude Code Instructions
updated: 2026-04-24
status: current
---

# Bioluminescent Sea — Agent Instructions

## What this is

A meditative ocean-dive explorer. The player pilots a submersible
downward through a trench broken into four named biomes; every beat is
one of:

- move toward a labeled landmark (shown in the top-right chip),
- collect a bioluminescent creature (score + chain multiplier +
  oxygen bonus),
- avoid a predator or a pirate's lantern cone (hull shock reduces
  oxygen),
- read the bottom objective banner, which is dynamic and tells the
  player what the trench wants them to do right now.

The three dive modes — **exploration**, **descent**, **arena** — are
compositions of a single **slot system** (`src/sim/dive/modeSlots.ts`).
Every gameplay knob (vertical movement lock, completion condition,
respawn pressure, collision-ends-dive, difficulty curve) is a named
slot a mode chooses values for. Add a mode by adding a `ModeSlots`
entry, not by adding a branch.

Oxygen is the timer. The trench loops infinitely past the Living Map;
running out of oxygen surfaces the sub with a partial chart.

## Critical rules

1. **3D world, 2D canvas.** The engine reasons in world-meters with
   `(x, y, z)` coordinates (`y` depth downward, `z` parallax layer).
   The renderer projects to 2D canvas via a camera. See
   [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) § "3D world, 2D
   canvas."
2. **PixiJS is the renderer.** Never re-introduce raw `ctx.*` drawing
   outside of `src/render/*`. The React layer never touches pixi
   sprites.
3. **Koota owns entity state.** Traits live in `src/ecs/traits.ts`.
   The sim produces plain data; the ECS lifts it into traits; the
   renderer and audio read traits through queries; the UI writes via
   `src/ecs/actions.ts`. No layer bypasses the others.
4. **The sim is pure.** `src/sim/*` compiles under `tsconfig.sim.json`
   without React, DOM, pixi, Koota, or audio imports. If you need
   something from one of those, you're in the wrong file.
5. **Seeded determinism always.** Any randomness comes from
   `createRng(seed)` in `@/sim/rng`. Direct `Math.random()` calls are
   a CI blocker.
6. **Biome, not ESLint.** `pnpm lint` runs Biome.
7. **pnpm only.** Do not create `package-lock.json` or `yarn.lock`.
8. **Player journey is the deliverable.** A cold player must
   understand the goal within 15 seconds of landing. If that breaks,
   fix it before anything else. See
   [STANDARDS.md](./STANDARDS.md) § Player-journey gate.
9. **One factory, one slot record.** Every spawnable actor (fish,
   predators, pirates, enemy subs, leviathans, anomalies, player)
   comes from `src/sim/entities/factory`. Every gameplay rule that
   varies by mode lives in `src/sim/dive/modeSlots.ts`. If you're
   about to write `if (mode === "arena")` outside that file, stop
   and add a slot.
10. **GOAP governs the player sub the same way it governs enemy subs.**
    `src/sim/ai/goap` is a TS port of Yuka's `Goal/CompositeGoal/
    Think/GoalEvaluator`. `PlayerSubController` accepts a
    `PlayerInputProvider`; production passes `useTouchInput`, tests
    pass a GOAP profile. The sim never imports Yuka — steering
    belongs to `AIManager`.

## Stack

See [STANDARDS.md](./STANDARDS.md) § Runtime stack for the full table.
Short version: React 19 + PixiJS 8 + Koota + Yuka + seedrandom +
Tone.js + Howler + Tailwind v4 + Zod + Capacitor 8 + Vitest +
Playwright + Biome.

## Commands

```bash
pnpm dev                 # Vite dev server
pnpm build               # tsc + vite build
pnpm typecheck           # tsc -b --pretty false (app + node + sim)
pnpm lint                # Biome
pnpm test                # test:node + test:dom
pnpm test:browser        # real Chromium via @vitest/browser-playwright
pnpm test:e2e            # Playwright end-to-end
pnpm cap:sync            # build + cap sync (android + ios)
pnpm cap:open:android    # open android studio
pnpm cap:run:android     # pnpm cap:sync && cap run android
```

## Project structure

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full tree.
Short version:

- `src/sim/` — pure engine. No DOM.
  - `_shared/sessionMode.ts` — SessionMode enum + MODE_METADATA.
  - `rng/` — seeded PRNG, codenames, blurbs.
  - `world/` — biome table, depth→biome mapping.
  - `chunk/` — infinite world chunking.
  - `entities/` — entity types + advance functions.
    - `entities/factory/` — JSON-style archetype catalogue +
      `createActor(archetype, ctx)` dispatch + higher-order composites.
  - `dive/` — scene advance, telemetry, collection, impact, mode
    composition. `modeSlots.ts` is the single source of truth.
  - `ai/` — AIManager (Yuka steering) + `goap/` (Goal/CompositeGoal/
    Think/GoalEvaluator) + `PlayerSubController` (input provider).
  - `meta/` — persistent Lux + upgrade costs.
- `src/ecs/` — Koota traits, actions, world, hooks.
- `src/render/` — PixiJS scene graph. Six layers back-to-front:
  far → water → mid → near → fx → overlay. The `water` layer
  carries the fluidic cues (god rays, caustics, depth tint) via
  pixi-filters `GodrayFilter` + `AdjustmentFilter`.
- `src/audio/` — Tone.js ambient + Howler SFX.
- `src/ui/` — React. No canvas or sim code.
  - `primitives/` — Button, Card, Dialog, Input, StatTile (radix +
    cva + tailwind-merge).
  - `screens/` — Game (state machine), LandingScreen (mode triptych),
    DiveScreen (runtime host), SeedPickerOverlay (Radix Dialog),
    CompletionBackdrop.
  - `shell/` — LandingHero, GameViewport, GameOverScreen, DrydockScreen.
  - `hud/` — HUD component, biome + landmark chips, mute button.
  - `hooks/` — useGameLoop, useSearchParamSeed, useTouchInput,
    useMetaProgression.
- `src/platform/` — Capacitor bridges.
- `src/data/` — Zod schemas + compiled content importers.
- `config/raw/` — authored JSON (biomes, creatures, landmarks).
- `docs/` — ARCHITECTURE, DESIGN, TESTING, DEPLOYMENT, RULES, LORE,
  RELEASE, PRODUCTION, VISUAL_REVIEW, STATE, superpowers/, plans/,
  screenshots/.

## Design palette (locked)

See [docs/DESIGN.md](./docs/DESIGN.md) for rationale.

```
--color-bg:        #050a14   near-black navy (background, safe area)
--color-abyss:     #0a1a2e   abyssal navy (card surfaces)
--color-deep:      #0e4f55   deep teal (mid-water, UI strokes)
--color-glow:      #6be6c1   bioluminescent mint (creatures, CTA, labels)
--color-fg:        #d9f2ec   pale sea-mist (body text)
--color-fg-muted:  #8aa7a2   muted mist (secondary labels)
--color-warn:      #ff6b6b   warn red (low oxygen, threats)
```

Display font: Cormorant Garamond (titles and summary only).
Body font: Inter (HUD + body).

## Foundation status

The foundation PR sequence (A → H) is tracked in
[docs/PRODUCTION.md](./docs/PRODUCTION.md) — all merged. The current
architecture has:

- **Slot-based modes** with the three-mode landing triptych driving
  the seed picker overlay.
- **Actor factory** with archetype-driven construction; higher-order
  composites for schools and leviathan escorts.
- **GOAP + PlayerSubController** shared governance for human input
  and bot playtesting.
- **Fluidic rendering layer** (god rays + caustics + depth tint).
- **Per-mode sim integration tests** that prove slot contracts by
  running a GOAP bot through `advanceScene`.

**No compat shims.** When a module moves, every caller moves with it
in the same PR. `@/engine/*` is gone; use `@/sim` or `@/sim/*`.
