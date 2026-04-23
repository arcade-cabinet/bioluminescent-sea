---
title: Foundation
updated: 2026-04-23
status: current
domain: technical
---

# Foundation — stack, structure, PR sequence

## Why

The initial extraction from the arcade-cabinet POC produced a working
but structurally thin codebase:

- `src/ui/Game.tsx` at 1307 LOC owns canvas rendering, phase machine,
  HUD host, input routing, and save slot — five responsibilities.
- `src/engine/deepSeaSimulation.ts` at 893 LOC owns entity advance,
  AI, telemetry, objectives, mode tuning, and landmark routing.
- Every creature placement is a hardcoded table; the world is one
  static viewport.
- No seeded RNG. No ECS. No real AI library. No audio. No scene graph.
- Docs tree matches the mean-streets template only partially.

Every HANDOFF-PRD player-journey gate *can* be checked off inside this
architecture, but doing so piles more into `Game.tsx` instead of
dividing responsibilities. We are rebuilding the foundation so the
remaining 1.0 work lands cleanly.

## The stack (decision log)

| Layer            | Choice        | Alternatives considered             | Why                                                                                       |
| ---------------- | ------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Rendering        | PixiJS 8      | Hand-rolled canvas, Phaser, R3F     | Scene graph + batched WebGL + canvas fallback. Matches 2D-canvas-3D-world split.          |
| ECS              | Koota         | bitECS, miniplex, none              | Mean-streets proven pattern; React hooks; lightweight.                                    |
| AI               | Yuka          | Hand-rolled steering                | Composable steering (Seek, Wander, Flee, ObstacleAvoidance), state machines for free.     |
| PRNG             | seedrandom    | mulberry32 (hand-rolled)            | Mean-streets standard; `src/sim/rng` uses the mean-streets API shape verbatim.            |
| Ambient audio    | Tone.js       | pre-rendered OGG loops              | Synthesized pad modulated by depth/biome — no heavy asset + live response to state.       |
| SFX              | Howler        | Web Audio directly                  | Pool + cross-browser quirks handled; ~7 KB gz.                                            |
| UI styling       | Tailwind v4 + CSS vars | CSS vars only (previous stance) | Tailwind v4 engine is tree-shaken; mean-streets-aligned; palette re-declared via `@theme`.|
| Schema           | Zod           | io-ts, ajv                          | Mean-streets standard; best DX for authored JSON.                                         |
| Transitions      | framer-motion + GSAP | either alone                 | framer for React overlay choreography; GSAP for renderer-layer tweens (biome tints, etc). |

No `@pixi/react` — the React layer stays purely chrome; pixi is driven
imperatively from a bridge that reads Koota queries.

## Directory structure

See [docs/ARCHITECTURE.md](../../ARCHITECTURE.md). Key points:

- `src/sim/*` is pure (no React, no DOM, no pixi, no Koota). Compiled
  under its own `tsconfig.sim.json`.
- `src/ecs/*` lifts sim into Koota traits. Only layer that knows about
  both.
- `src/render/*` is pixi-only. Reads traits through queries.
- `src/audio/*` reads telemetry through queries.
- `src/ui/*` writes via `src/ecs/actions.ts`, never directly.
- `src/platform/*` owns all Capacitor imports.

## PR sequence

Each PR is independently green, reviewable, and bounded.

### PR A — Scaffolding (this PR)

- Install: pixi.js, koota, yuka, seedrandom, tone, howler, gsap, zod,
  tailwindcss@^4, @tailwindcss/vite, @testing-library/user-event,
  @types/seedrandom, @types/howler, tsx.
- Create directory skeleton with index barrels + purpose-declaring
  placeholder modules.
- Split TypeScript projects — add `tsconfig.sim.json` as a composite
  root; reference from root `tsconfig.json`.
- Land `src/sim/rng/{rng,codename}.ts` + their tests with real
  behavior — the rest of the foundation depends on these.
- Wire Tailwind v4 via `@tailwindcss/vite` and declare the palette
  via `@theme` in `src/theme/global.css`.
- Write the full docs tree: ARCHITECTURE, TESTING, DEPLOYMENT, RULES,
  LORE, RELEASE, PRODUCTION, VISUAL_REVIEW, this spec.
- No runtime behavior change — existing `src/ui/Game.tsx` still runs
  on the old engine until PR B.

### PR B — Sim split

Move `src/engine/deepSeaSimulation.ts` into:

- `src/sim/dive/state.ts`, `advance.ts`, `telemetry.ts`,
  `objectives.ts`, `completion.ts`, `mode.ts`
- `src/sim/entities/{creatures,predators,pirates,particles,player}.ts`

Each file owns one responsibility. The existing
`deepSeaSimulation.test.ts` splits to match. No API/behavior changes;
`src/ui/Game.tsx` updates imports only.

### PR C — PixiJS renderer

- `src/render/stage.ts` mounts a pixi `Application`.
- `src/render/camera.ts` projects `(x, y, z)` → screen pixels.
- `src/render/layers/{backdrop,parallax,entities,player,lighting}.ts`
  replicate every current draw function in pixi terms.
- `src/render/bridge.ts` subscribes to (initially still array-based)
  scene state and mutates sprites per frame.
- `Game.tsx` shrinks to a phase orchestrator (<200 LOC) that mounts
  `<DiveCanvas>` and the HUD.
- Visual gold masters (PR-A docs/VISUAL_REVIEW.md flow) must match
  to within 0.02 SSIM.

### PR D — Koota ECS + Yuka AI

- `src/ecs/world.ts` creates the world + registers traits.
- `src/ecs/actions.ts` exposes `advanceDiveFrame(dt)`,
  `collectBeacon(id)`, `applyThreatHit(id)`, `transitionBiome(id)`.
- `src/ecs/hooks.ts` exposes `useDiveState`, `useTelemetry`,
  `useBiome`.
- Yuka behaviors land in `src/sim/ai/predator-behavior.ts` and
  `pirate-behavior.ts` as pure factories; the ECS layer instantiates
  them per entity.

### PR E — Seed-driven spawning

- `createDive(seed, config)` — seeds everything.
- Landing shows next dive's codename preview + *"Today's Trench"*
  CTA.
- `?seed=<codename>` URL support.

### PR F — Chunked world

- `src/sim/world/chunks.ts` — `generateChunk(seed, index)` pure.
- Camera scrolls as player descends. Off-screen chunks retire;
  fresh chunks spawn below.
- Biome transitions fire a banner + tint ramp at authored depths.
- Completion condition changes from "collect all 18 beacons" to
  "reach Living Map depth ≥ 3200m."

### PR G — Audio

- `src/audio/ambient.ts` — Tone.js polyphonic pad. `setDepth(m)`
  scales a low-pass filter; `setBiome(id)` swaps chord voicing.
- `src/audio/sfx.ts` — Howler pool. Events: `collect`, `impact`,
  `biome-transition`, `oxygen-warn`, `dive-complete`.
- `src/audio/mixer.ts` — master gain + mute toggle honoring
  `prefers-reduced-motion` + Capacitor `appStateChange`.

### PR H — Content pipeline

- `config/raw/biomes/*.json`, `creatures/*.json`, `landmarks/*.json`.
- `scripts/compile-content.mjs` validates via Zod and emits
  `config/compiled/*.json`.
- `src/data/index.ts` imports compiled content; no hardcoded tables
  remain in the engine.
- Content changes no longer require TypeScript edits.

## Non-goals for the foundation sequence

- New creature archetypes (separate track).
- Per-seed leaderboards.
- Icons / hero art / OG image (separate identity track).
- Full localization.
- Accessibility settings UI (reduced-motion honored, but no in-game
  control panel).

## Execution guardrails

- CI stays green end-to-end on every PR in the sequence.
- No PR introduces `Math.random()`; the lint rule catches it.
- No PR violates the import boundaries in
  [ARCHITECTURE.md](../../ARCHITECTURE.md) § Dependency map.
- Gold-master screenshots re-captured on any renderer/palette touch.
- `docs/STATE.md` gets a dated entry on each merge.
