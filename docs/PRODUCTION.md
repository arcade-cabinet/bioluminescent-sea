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
- [x] **PR B — Sim split.** `src/engine/deepSeaSimulation.ts`
      decomposed into `src/sim/dive/*` and `src/sim/entities/*`; the
      old module path is deleted outright. All 49 node tests still
      pass; no compat shims.
- [x] **PR C — PixiJS renderer.** Hand-rolled canvas renderer
      replaced with a PixiJS `Application` + layered scene graph
      (far / mid / near / fx / overlay). `Game.tsx` dropped from
      1307 → 787 LOC. Verified on desktop (1280×720) and mobile
      portrait (390×844) in a production build: zero console errors,
      creatures / predators / pirates / player / sonar / HUD all
      render, gameplay responsive. `pixi.js/unsafe-eval` imported at
      bootstrap so Capacitor's strict CSP doesn't break WebGL.
- [x] **PR D — Koota ECS integration.** Entity state lifted from
      parallel arrays into Koota traits (`PlayerAvatar`,
      `CreatureEntity`, `PredatorEntity`, `PirateEntity`,
      `ParticleEntity`, `DiveRoot`). The sim stays pure; actions
      (`advanceDiveFrame`, `recordThreatFlash`, `decayThreatFlash`)
      are the only writers. The renderer reads via queries. Yuka-
      composed AI behaviors land in a follow-up PR on top of this
      boundary.
- [x] **PR E — Seed-driven spawning + codename UI.** Every creature,
      predator, pirate, and particle placement derives from
      `createRng(seed)` via `createSeededScene`. Landing shows the
      codename preview ("Your Next Trench") in Cormorant Garamond;
      Today's Trench secondary CTA swaps to the daily shared seed.
      Dive start pushes `?seed=<codename>` to the URL so the active
      trench is shareable; URL seeds load the same codename back.
      HUD carries a codename chip.
- [x] **PR F.1 — Biome surface.** `DiveTelemetry` now carries
      `biomeId`, `biomeLabel`, `biomeTintHex` derived from
      `biomeAtDepth(depthMeters)`. HUD gains a biome chip (color-
      matched to the current biome tint) below the codename chip.
      Renderer backdrop paints a 10% overlay in the biome tint so
      depth changes are visually legible. Objective banner speaks
      biome-specific copy when no urgent state fires. Biome palette
      rewritten from the base-color clones to evocative shifts
      (photic = kelp green, twilight = cool teal, midnight =
      indigo bruise, abyssal = ember warn) so transitions read.
- [ ] **PR F.2 — World-space coords + chunking.** Entities carry
      `Vec3 {x, y: depthMeters, z: parallax}` in meters. Camera
      scrolls as player descends; chunks spawn below and retire
      above. Supersedes the "18 fixed creatures" scene model.
- [x] **PR G — Audio.** Tone.js ambient pad with per-biome chord
      voicings (lydian open fifth → sus4 → minor 9th → dissonant
      minor 2nd). Low-pass filter cutoff tracks depth so the column
      goes muddier as the player descends. Tone-synthesized SFX for
      collect (mint chime), impact (thud + dissonant partial), biome
      transition (open fifth), oxygen-warn (minor 2nd pulse),
      dive-complete (rising arpeggio). Master mute toggle in HUD
      (bottom-left), persists to localStorage, honors
      `prefers-reduced-motion`. Howler was skipped — Tone.js owns all
      synthesis so the bundle doesn't carry two audio libraries.
- [x] **PR H — Content pipeline.** Biomes, creature species, and
      landmarks authored in `config/raw/*.json` and compiled via
      `scripts/compile-content.mjs` (Zod-validated). Runs as
      `predev` / `prebuild` / `pretypecheck` / `pretest:*` so content
      edits are live without touching TypeScript. Output goes to
      `config/compiled/content.ts` (gitignored); biomes table reads
      from there. Landmarks now carry per-landmark flavor text keyed
      to depth and biome.

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

## Production polish — player journey audit

Run once foundation PRs (A → H) merge. Do not ship 1.0 without these:

- [ ] Every POC-era string, placeholder blurb, filler headline, or
      "lorem/ipsum"-energy copy replaced with voice-aligned content.
- [ ] Every POC visual (typographic-only cards, generic gradient
      backdrops, untextured silhouettes) replaced with production art
      unique to Bioluminescent Sea — no generic-AI aesthetic leakage.
- [ ] Cold 60-second playthrough passes for a first-time player: avatar
      identifiable, first meaningful object identifiable, goal
      communicated, loop makes sense, feedback on every action.
- [ ] Deployed to GitHub Pages. Zero console errors on the live URL
      across desktop (1280×720) and mobile portrait (390×844).
- [ ] All review feedback on every PR in the foundation sequence
      addressed; no open comments when 1.0 is tagged.

## Next games (autopilot continuation)

After Bioluminescent Sea is production-polished and deployed, the same
foundation + player-journey + identity + content pass applies, in
order, to the sibling POC extractions:

- [ ] `../cosmic-gardener` — same A → H style foundation, tight
      game-loop audit, production copy + visuals, GitHub Pages deploy.
- [ ] `../enchanted-forest` — same treatment.

Each repo gets its own `docs/PRODUCTION.md` with a tailored sequence.
The foundation stack (PixiJS / Koota / Yuka / seedrandom / Tone.js /
Howler / Tailwind v4 / Zod) is the common template; per-game choices
diverge at the design/content layer.
