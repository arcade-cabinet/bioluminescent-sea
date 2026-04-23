---
title: State
updated: 2026-04-23
status: in-progress
domain: context
---

# State

## Current baseline

Foundation PR A merged. PR B (sim split) open. PR C (PixiJS renderer)
open: the hand-rolled canvas renderer has been replaced with a pixi
`Application` + layered scene graph under `src/render/`. `Game.tsx`
dropped from 1307 → 787 LOC; every draw helper moved into a
dedicated layer module (backdrop / parallax / entities / player / fx).
Verified on desktop 1280×720 and mobile portrait 390×844 in a
production build: zero console errors, full visual parity plus real
WebGL filters (no longer canvas 2d). `pixi.js/unsafe-eval` imported
at `src/main.tsx` so Capacitor's strict CSP doesn't trip the shader
compiler.

- Runtime deps installed: pixi.js 8, koota 0.6, yuka 0.7, seedrandom,
  tone 15, howler, gsap, zod, tailwindcss v4, framer-motion (kept).
- `src/sim/rng/` live with full determinism tests — `createRng(seed)`,
  `codenameFromSeed(seed)` bijection, `dailySeed()`.
- `src/sim/world/` live with biome table + `biomeAtDepth` tests.
- Directory skeleton created for every foundation layer
  (`src/sim/`, `src/ecs/`, `src/render/`, `src/audio/`, `src/platform/`,
  `src/data/`, `config/raw/`, `scripts/`). Each empty module ships an
  `index.ts` barrel that declares the module's intent.
- `tsconfig.sim.json` added so the pure engine compiles without
  React/DOM/pixi/Koota imports.
- Tailwind v4 wired via `@tailwindcss/vite`; palette re-declared
  inside `@theme` in `src/theme/global.css` so utility classes
  (`text-glow`, `bg-abyss`) stay palette-aligned.
- Docs tree populated:
  ARCHITECTURE, TESTING, DEPLOYMENT, RULES (new), LORE (new),
  RELEASE, PRODUCTION (new), VISUAL_REVIEW (new), STATE,
  superpowers/specs/2026-04-23-foundation-design.md.

## Metrics

- Node tests: 49 passing (previously 15). Added coverage for RNG
  determinism, codename round-trip, biome boundaries.
- DOM tests: 1 passing.
- Typecheck: clean across app + node + sim composite projects.
- Build: 344 KB JS + 28 KB CSS + fonts. Well under the 600 KB gz
  budget.
- Lint: clean.

## PR sequence status

| PR | Description                          | Status       |
| -- | ------------------------------------ | ------------ |
| A  | Foundation scaffolding + docs tree   | merged       |
| B  | Sim split (engine → sim/*)           | in review    |
| C  | PixiJS renderer swap                 | in review    |
| D  | Koota ECS + Yuka AI                  | not started  |
| E  | Seed-driven spawning + codename UI   | not started  |
| F  | Chunked world + biomes               | not started  |
| G  | Audio (Tone.js + Howler)             | not started  |
| H  | Content pipeline (Zod + JSON)        | not started  |

## Known bugs / quirks

None reported in this repo's life. If you find one, log it here with
a date.

## Decisions log

- **2026-04-23** — Reversed "no Tailwind" decision. Tailwind v4 lands
  alongside the CSS var palette; `@theme` re-declares the palette
  tokens so utility classes stay brand-aligned. Rationale: mean-streets
  alignment, and Tailwind v4's tree-shaken engine costs ~14 KB CSS
  rather than the 30+ KB the v3 decision cited.
- **2026-04-23** — Adopted mean-streets stack: PixiJS for rendering,
  Koota for ECS, Yuka for AI, seedrandom for PRNG, Tone.js for ambient
  audio, Howler for SFX. Rationale: foundation parity across the
  arcade cabinet portfolio; hand-rolling any of these was either under
  way (PRNG, AI) or plausibly next (scene graph).
- **2026-04-23** — Adopted 3D-world-in-2D-canvas model. World
  coordinates are `(x, y, z)` in meters; `y` is depth downward; `z`
  is parallax layer. Renderer projects to pixels via a camera. This
  is what unlocks chunked world, depth-as-mechanic, and biome
  transitions as spatial facts rather than HUD chips.
- **2026-04-23** — File-length rule changed from "soft 300 LOC limit"
  to "contextual, responsibility-driven." `src/sim/*` is split by
  responsibility (rng, world, entities, dive, ai) — each submodule's
  size is whatever its responsibility demands.
- **2026-04-23** — Dropped cabinet-runtime save-slot API in favor of
  `localStorage["bioluminescent-sea:v1:save"]` + `…:best-score`.
  Simpler, no cross-game assumptions, works offline on Android.
