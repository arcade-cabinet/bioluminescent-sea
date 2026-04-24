---
title: Next work — Bioluminescent Sea
updated: 2026-04-24
status: current
domain: context
---

# Bioluminescent Sea — Next work

This file is the authoritative handoff for the next agent (or human)
picking up this repo. Read it cold — no prior conversation context
required.

## Current state (as of 2026-04-24)

The player-journey foundation is on main and runs clean:

- Seeded Pixi renderer + Koota ECS + pure sim boundary
  (see `docs/ARCHITECTURE.md` § "3D world, 2D canvas").
- Landing → tutorial → dive → completion / defeat state machine.
- HUD: score / oxygen / chain / depth / charted + right-side chip
  stack (landmark → biome → run codename). Objective banner
  bottom-center. Biome transition banner center-screen on depth-band
  crossings.
- Dive autosave on localStorage at ~0.4 Hz; Tone ambient pad with
  mute-safe scheduling that survives mute/unmute cycles.
- Runtime chunk lifecycle — biomes actually change during a dive as
  the sub descends (creatures spawn/retire as chunks enter/leave the
  camera window).
- Multi-viewport Playwright journey harness at `e2e/journey.spec.ts`
  walks landing → mode switch → first gameplay frame → 4s of descent
  and dumps per-beat screenshots + diagnostics JSON across
  mobile / tablet / desktop viewports. Runs via `pnpm test:e2e` (set
  `PW_HEADLESS=1` for CI).
- HUD test hooks: `data-testid="hud-stat-{score,oxygen,chain,depth,charted}"`,
  `hud-biome-chip`, `hud-landmark-chip`, `hud-codename-chip`,
  `objective-banner`, `landing-screen`, `playing-screen`,
  `gameover-screen`, `complete-screen`.

## What's NOT done

Exhaustive list. Any one of these is a real task — pick the top item
that fits your session size, do it, commit + PR + auto-squash-merge.

### Priority 1 — player-journey PRD gate

The items in `HANDOFF-PRD.md` under "Player journey gate" are the
published bar for a shippable player experience. Most have been
satisfied by the merged work above but the checkboxes were not
updated. **Go through HANDOFF-PRD.md top to bottom, verify each item
against the deployed build at <https://bioluminescent-sea.pages.dev/>
or a local `pnpm build && pnpm preview`, and tick the boxes that
actually pass.** Fix the ones that don't.

Known gaps likely still open:

- "Diagnose and fix every point during a cold 60-second playthrough
  where the goal is unclear or feedback is missing." — this is open-
  ended but worth one dedicated session. The harness at
  `e2e/journey.spec.ts` generates screenshots for every beat; look
  at them with fresh eyes and flag any UI/feedback gap.
- Mobile portrait 390×844 is **known good** per harness; mobile
  landscape is NOT tested and likely needs work.
- "Completion screen summarizes the run" — verify the `complete`
  state's `GameOverScreen` shows meaningful summary copy (score,
  depth reached, chain peak, time banked). `src/ui/Game.tsx` around
  line 919.

### Priority 2 — extend the Playwright harness

The journey harness in `e2e/journey.spec.ts` covers landing → dive
start → 4s. It does NOT cover:

- **Game over from oxygen depletion.** Add a seed / query param that
  accelerates oxygen drain (e.g. `?devFastDive=1`) or uses
  `window.setTimeout` from within the test to simulate ~60s of dive.
- **Refresh persistence.** Refresh mid-dive and verify the seed
  stays, HUD restores, and the `initialSnapshot` path from
  `resolveDeepSeaSnapshot()` replays the run.
- **Mobile landscape (844×390).** Add a 4th project to
  `playwright.config.ts`.
- **Completion path.** Same drain trick with `?devInstantComplete=1`.

### Priority 3 — memory-spike audit carry-over (Medium / Low)

The 2026-04-24 memory-spike audit flagged Medium + Low items that
were not patched with the critical fixes. None are spike-class but
they're real perf debt:

- **`src/ecs/world.ts:121-129`** — `writeSceneToWorld` iterates
  `scene.predators.length` etc. but never destroys trailing entities
  if the sim ever starts mutating those arrays. Currently safe, but
  will silently leak the moment predator spawning becomes dynamic.
- **`src/render/bridge.ts:86-104`** — every frame does 4×
  `Array.map().filter()` over all entities to reassemble sim-shape
  data from traits. Not a leak, but GC pressure in long sessions.
  Cache the projections or iterate in place.
- **`src/audio/sfx.ts:19-32`** — `synth` / `pling` are module-level
  and never `disposeSfx()`d. Bounded at 2 voices; HMR / StrictMode
  may leave orphans wired to `Tone.getDestination()`. Add a
  `disposeSfx()` call site on Game unmount.

### Priority 4 — graphics

Per user mandate (the critters are still primitive triangles):

- Replace the primitive-shape creatures / predators / pirates in
  `src/render/layers/entities.ts` with either custom SVG sprites or
  Pixi `Mesh` instances with a hand-drawn atlas. Bioluminescent palette
  from `docs/DESIGN.md` must drive the color choices.
- Landing hero (`src/ui/shell/LandingHero.tsx`) has a drifting
  submersible silhouette that could use more character.

## How to ship

1. Branch off main. Conventional Commits (`feat:`, `fix:`, `perf:`,
   `test:`, `docs:`, etc.).
2. `pnpm typecheck`, `pnpm lint`, `pnpm test` must stay green.
3. Run `pnpm exec playwright test --reporter=list` (headed by
   default, `PW_HEADLESS=1` for background) across all three
   viewports before opening the PR. The harness dumps diagnostics
   for any regression.
4. `gh pr create` and then `gh pr merge <n> --auto --squash`.
5. After merge: `git checkout main && git pull --ff-only`.

## Key files

- `src/ui/Game.tsx` — outer state machine, landing / playing /
  gameover / complete wrappers, autosave.
- `src/ui/hud/HUD.tsx` — stat row, chip stack, biome banner.
- `src/ecs/actions.ts` — the ONLY mutation surface for the ECS
  world. Runtime chunk lifecycle lives here (`advanceDiveFrame`).
- `src/sim/**` — pure engine. No React, DOM, pixi, Koota, or
  audio imports. Compiles under `tsconfig.sim.json`.
- `src/render/**` — PixiJS scene graph. Bridge at
  `src/render/bridge.ts` is the sole adapter.
- `e2e/journey.spec.ts` + `e2e/helpers/diagnostics.ts` — the
  multi-viewport harness.

## Don'ts

- Do NOT use `Math.random()` anywhere. Use `createRng(seed)` from
  `@/sim/rng`. This is a CI blocker.
- Do NOT re-introduce raw `ctx.*` drawing outside of `src/render/*`.
- Do NOT let React touch pixi sprites or Koota entities directly —
  always through `src/ecs/actions.ts` / the render bridge.
- Do NOT create `package-lock.json` or `yarn.lock`. pnpm only.
