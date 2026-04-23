---
title: Claude Code Instructions
updated: 2026-04-23
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

Oxygen is the timer. Reaching the Living Map at ~3200m completes the
dive; running out of oxygen before then surfaces the sub with a
partial chart.

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

- `src/sim/` — pure engine (rng, world, entities, dive, ai). No DOM.
- `src/ecs/` — Koota traits, actions, hooks.
- `src/render/` — PixiJS scene graph.
- `src/audio/` — Tone.js ambient + Howler SFX.
- `src/ui/` — React (shell + HUD + dive app). No canvas or sim code.
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
[docs/PRODUCTION.md](./docs/PRODUCTION.md). PR A landed the docs tree,
libraries, directory skeleton, and seeded RNG. PR B split the sim
into responsibility-scoped modules under `src/sim/`. PRs C–H swap in
the real implementation of the remaining layers in order.

**No compat shims.** When a module moves, every caller moves with it
in the same PR. `@/engine/*` is gone; use `@/sim` or `@/sim/*`.
