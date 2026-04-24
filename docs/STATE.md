---
title: State
updated: 2026-04-24
status: in-progress
domain: context
---

# State

## 2026-04-24 update

Since the 2026-04-23 baseline the renderer, ECS, and player journey
have caught up with the foundation plan and a memory-spike audit
landed four perf patches.

Merged since 2026-04-23:

- **PR #55 (F.4e)** — entities layer projects `worldYMeters` through
  camera
- **PR #56 (F.4f)** — `chunkLifecycleDelta` spawn/retire helper
- **PR #59** — tap-lag fix (RAF rebind decoupled from pointer events)
- **PR #60** — biome transition banner
- **PR #61** — multi-viewport Playwright journey harness +
  HUD testids
- **PR #62** — right-side HUD chip stack (landmark + biome +
  codename) as one flex-column group
- **PR #63** — stabilized autosave effect; mute-safe ambient pad
- **PR #58** — runtime chunk lifecycle (biomes change during play)

Net effect: a cold player on mobile portrait 390×844 lands, sees
title + tagline + verb teaser, taps Begin Dive, transitions to a
live sub with a full HUD inside 600ms, and the dive's biome visibly
shifts as they descend. The journey harness proves this across
three viewports in under 25s.

For material decisions and reasons, see
[docs/agentic/decisions-log.md](agentic/decisions-log.md). For the
next agent's pickup list, see
[docs/agentic/next-work.md](agentic/next-work.md).

## Current baseline

Foundation PR A merged. PR B (sim split) open. PR C (PixiJS renderer)
open. PR D (Koota ECS integration) open: entity state now lives in
Koota traits — `PlayerAvatar`, `CreatureEntity`, `PredatorEntity`,
`PirateEntity`, `ParticleEntity`, `DiveRoot`. The sim in `src/sim/*`
stays pure; it consumes and produces plain `SceneState` objects,
and `src/ecs/actions.ts` is the thin adapter between sim and ECS.
The renderer reads entities via Koota queries — the ECS is the
canonical source of truth for runtime state. Yuka-composed AI
behaviors land in a follow-up PR on top of this boundary.

`Game.tsx` now:
- Creates the DiveWorld lazily once per mount via `useRef` + null
  sentinel (React Strict Mode + HMR previously exhausted Koota's
  16-world ceiling).
- Destroys the world on cleanup via `world.destroy()` which releases
  the worldId back to the pool.

Verified end-to-end in a production build on desktop 1280×720 and
mobile portrait 390×844: zero console errors, full visual parity,
restart path stress-tested (10 dive starts in a row — no
world-ceiling errors).

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
| D  | Koota ECS integration                | in review    |
| E  | Seed-driven spawning + codename UI   | in review    |
| F.1| Biome surface (HUD chip + tint)      | in review    |
| F.2| World coords + chunking              | not started  |
| G  | Audio (Tone.js synthesized)          | in review    |
| H  | Content pipeline (Zod + JSON)        | in review    |

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
- **2026-04-23** — Removed the meta-CSP from `index.html` on PR D.
  Koota's trait codegen and PixiJS's shader compiler both rely on
  dynamic Function construction for performance; fighting that is
  fighting the framework's entire execution model. Matches
  `../mean-streets` (which also ships without a meta-CSP). Capacitor
  owns the strict CSP on the mobile build; web relies on the normal
  browser sandbox. Acceptable given the app loads no third-party
  content and accepts no user input outside its own DOM.
