---
title: Production
updated: 2026-04-23
status: current
domain: context
---

# Production

The pre-1.0 readiness queue. When everything here is done, we cut 1.0.
Replaces the earlier HANDOFF-PRD; HANDOFF-PRD stays in the repo as a
frozen artifact of the extraction handoff but is no longer the
working queue.

## Foundation (PR sequence A → H)

Each is its own PR so reviewers can follow the chain end-to-end.

- [x] **PR A — Foundation scaffolding.** Libraries installed, docs
      tree, directory skeleton, tsconfig split, Tailwind v4 wired,
      seeded RNG + codename module with tests. No behavior change in
      the running app.
- [ ] **PR B — Sim split.** Move `src/engine/deepSeaSimulation.ts`
      into `src/sim/dive/*`, `src/sim/entities/*`. Pure refactor; all
      existing tests migrate with their code; no new features.
- [ ] **PR C — PixiJS renderer.** Replace the hand-rolled canvas
      renderer in `Game.tsx` with a PixiJS `Application` + layered
      scene graph. Identical visual output; `Game.tsx` shrinks to a
      phase orchestrator.
- [ ] **PR D — Koota ECS + Yuka AI.** Parallel arrays become traits;
      predator/pirate AI composited from Yuka steering behaviors.
- [ ] **PR E — Seed-driven spawning.** Every creature / predator /
      pirate placement derives from `createRng(seed)`. Landing shows
      the codename preview; `?seed=<codename>` URL support.
- [ ] **PR F — Chunked world + biomes.** Vertical scroll advances
      through the authored biomes; content spawns in chunks below the
      viewport and retires above. `depthMeters` becomes spatial.
- [ ] **PR G — Audio.** Tone.js ambient pad + Howler SFX. Depth- and
      biome-modulated filter. Master mute + reduced-motion respect.
- [ ] **PR H — Content pipeline.** Biomes, creature species, and
      landmarks moved to `config/raw/*.json` with `scripts/compile-content.mjs`
      + Zod validation. Authoring no longer requires code edits.

## Identity

- [ ] Favicon SVG (mint jellyfish silhouette over abyss navy).
- [ ] Android icon pack rendered from the SVG at all mipmap resolutions.
- [ ] Apple touch icon 180×180.
- [ ] OG image 1200×630 stored in `public/` and referenced from
      `index.html`.
- [ ] Landing hero visual replaces the typographic-only card.

## Quality gates

- [ ] `pnpm lint` passes on every authored file.
- [ ] `pnpm typecheck` strict mode passes on all three composite
      projects.
- [ ] `pnpm test:node` + `pnpm test:dom` pass with real assertions.
- [ ] `pnpm test:browser` captures a representative frame per biome.
- [ ] `pnpm test:e2e` covers the full journey landing → dive →
      completion → restart.
- [ ] `pnpm build` produces a bundle under 600 KB gzipped (excluding
      fonts).
- [ ] `./gradlew assembleDebug` produces a < 12 MB debug APK.
- [ ] GitHub Pages URL loads with zero console errors.

## CI / CD

- [x] `ci.yml` — lint + typecheck + test:node + test:dom + build +
      Android APK.
- [ ] `ci.yml` augmented with `test:browser` + `test:e2e`.
- [ ] `release.yml` — on release-please tag: build bundle, publish
      Pages artifact, build signed Android release APK.
- [ ] `cd.yml` — on push:main: deploy Pages artifact.
- [ ] `analysis-nightly.yml` — deterministic-seed regression sweep.
- [ ] `automerge.yml` — automerge green dependabot patches.

## Triage queue (open now)

- [ ] Merge or close dependabot PRs #2–#7 once rebased.
- [ ] Merge release-please 0.2.0 (PR #1) after foundation PRs land.
- [ ] Seed the `.release-please-manifest.json` if 1.0 cut requires
      manual bump.

## Decisions that need lore/design follow-through

- [ ] Landing preview copy for each codename (procedural blurb) —
      needs a small pool of sentence templates tied to biome density
      of the generated trench.
- [ ] Running-out-of-oxygen warning progression — currently a red
      pulse; DESIGN.md wants a "surface breathing easier" finale that
      requires one more UI beat between warn and ascent.
- [ ] Sound identity — DESIGN.md has no audio block. Add one before
      PR G.
