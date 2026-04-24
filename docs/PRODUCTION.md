---
title: Production
updated: 2026-04-24
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
- [x] **PR F.2 — World-space coords (groundwork).**
      `SceneState.depthTravelMeters` is the sim's real world-Y state,
      advancing at 6 m/s via `advanceScene` (clamped at the 3200m
      trench floor). Replaces the POC-era
      `computeDepthMeters(collectionRatio, oxygenRatio)` formula which
      reported 2200–3400m regardless of actual descent. Telemetry +
      summary now read `scene.depthTravelMeters`; biome chip shows
      Photic Gate at cold-start instead of jumping straight to
      Midnight. Landed in PR #23.
- [x] **PR F.3 — Entity world-Y + chunking (sim side).** Three PRs
      landed (#39, #43, #44):
      * `src/sim/chunk/` — `chunkAt`, `chunksInWindow`,
        `chunkIndexAtDepth` with 15 determinism tests; 200m chunk
        height decomposes the 3200m trench into 16 chunks across the
        four biomes.
      * `src/sim/entities/chunked-spawn.ts` —
        `spawnCreaturesForChunk(chunk, viewport)` driven by biome
        `creatureDensity` (photic 2, twilight 3, midnight 4,
        abyssal 2). Creature ids prefixed by chunk index
        (`beacon-c3-2`) so cross-chunk collisions are impossible.
      * `src/sim/dive/chunked-scene.ts` — `createChunkedScene(seed,
        viewport, initialDepth)` flat-maps creatures across the
        camera window. Production-shape target for replacing the
        legacy 18-fixed-creatures spawner.
      Not yet wired into Game.tsx — the renderer-side camera-scroll
      is the follow-up. Chunks-retire logic (off-screen pruning)
      also deferred. The sim side of F.3 is fully landed; see **PR
      F.4** for the renderer cut-over.
- [ ] **PR F.4 — Renderer camera-scroll + chunk lifecycle.**
      Game.tsx swaps from `createSeededScene` to
      `createChunkedScene`. Renderer projects entity positions
      through a scrolling camera reading `scene.depthTravelMeters`.
      Chunks below the bottom edge retire; chunks above the top
      edge spawn in. Completes the "18 fixed creatures" → chunked
      trench migration.
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

- [x] Favicon SVG (mint jellyfish silhouette over abyss navy) —
      `public/favicon.svg`, wired via `<link rel="icon" ...>`.
- [x] Android icon pack rendered from the SVG at all mipmap resolutions.
      Source SVGs live in `android/icon-source/` (legacy, round,
      adaptive-foreground); PNGs rasterized into each of the five mipmap
      densities. Adaptive background color flipped from `#FFFFFF` to the
      brand `#0A1A2E`.
- [x] Apple touch icon — `public/apple-touch-icon.svg` (180×180
      viewBox, iOS masks to its own radius).
- [x] OG image 1200×630 — `public/og-image.svg`, referenced via
      Open Graph + Twitter Card meta tags in `index.html`.
- [x] Landing hero visual replaces the typographic-only card. The new
      `LandingHero` canvas paints the abyss with drifting kelp ribbons,
      pulsing creature sparks, and a submersible silhouette with a
      headlight cone parallaxing at center. Honors
      `prefers-reduced-motion`.

## Quality gates

- [x] `pnpm lint` passes on every authored file (biome, 84 files clean).
- [x] `pnpm typecheck` strict mode passes on all three composite
      projects (`tsconfig.app`, `tsconfig.node`, `tsconfig.sim`).
- [x] `pnpm test:node` + `pnpm test:dom` pass with real assertions
      (62 node + 1 DOM, 63 total).
- [x] `pnpm test:browser` captures a representative frame per biome.
- [x] `pnpm test:e2e` covers the full journey landing → dive →
      completion → restart. Golden-path specs live in `e2e/` and run on
      desktop + mobile Chromium.
- [x] `pnpm build` produces a bundle under 600 KB gzipped (excluding
      fonts) — currently 295 KB gz.
- [x] `./gradlew assembleDebug` produces a < 12 MB debug APK — currently
      6.8 MB.
- [x] GitHub Pages URL loads with zero console errors. Verified on
      2026-04-23 at https://arcade-cabinet.github.io/bioluminescent-sea/
      — desktop 1280×720, only the expected Tone.js banner log + the
      AudioContext autoplay-gate warning (pre-user-gesture, not an
      error). Screenshot in `docs/screenshots/pages-live.png`.

## CI / CD

- [x] `ci.yml` — lint + typecheck + test:node + test:dom + build +
      Android APK.
- [x] `ci.yml` augmented with `test:browser` + `test:e2e`. The browser
      canvas job ran since PR C; the Playwright e2e job lands with the
      golden-path specs.
- [x] `release.yml` — release-please action opens/merges a release PR;
      on tag creation, builds the Android release AAB (signed when the
      keystore secrets are present, debug AAB otherwise) and uploads it
      as a release artifact.
- [x] `cd.yml` — on push:main: builds the web bundle, adds `.nojekyll`,
      publishes the Pages artifact, and deploys via the official
      `actions/deploy-pages`.
- [x] `analysis-nightly.yml` — deterministic-seed regression sweep
      (100 seeds × 180 frames, asserts finite telemetry + bounded
      ratios + per-frame budget; opens `sim-regression` issue on
      failure). Driver: `scripts/sim-sweep.ts`, also runnable as
      `pnpm run sim:sweep` locally.
- [x] `automerge.yml` — automerge green dependabot PRs for
      semver-patch + semver-minor updates. Major bumps still require
      human review.

## Triage queue (open now)

- [x] Merge or close dependabot PRs #3–#7 — all five major bumps
      landed: #3 jsdom 27→29, #4 @types/node 22→25, #5
      @vitejs/plugin-react 5→6, #6 typescript 5.9→6.0 (required
      baseUrl removal + crypto global fix + WebWorker lib in
      tsconfig.sim), #7 framer-motion 11→12. PR #2 (actions group)
      still blocked by missing `workflow` OAuth scope; user must run
      `gh auth refresh -s workflow`.
- [x] Merge release-please 0.2.0 (PR #1) after foundation PRs land.
- [x] Seed the `.release-please-manifest.json` if 1.0 cut requires
      manual bump. **Decision (2026-04-24):** not required. Current
      config is `release-type: node` with `bump-minor-pre-major:
      true`, and release-please has been correctly bumping through
      0.2.0 → 0.2.1 → 0.2.2 → 0.2.3 → 0.3.0 in response to
      conventional-commit prefixes. When the cross-repo polish work
      completes and the player experience is judged 1.0-ready, the
      cut can be triggered by either (a) a manual manifest bump to
      `"1.0.0"` or (b) a `BREAKING CHANGE:` footer on any commit.
      Either path lands automatically via the existing workflow; no
      prep work needed today.

## Decisions that need lore/design follow-through

- [x] Landing preview copy for each codename (procedural blurb) —
      `trenchBlurbForSeed` stitches opener + body + closer templates
      picked by different bit ranges of the 18-bit codename seed.
      Deterministic and keyed to the same seed the player shares via
      URL. Rendered in italic under the codename on landing.
- [x] Running-out-of-oxygen warning progression — three-stage now:
      comfortable → warn (< 25%, red stat tone + "Oxygen — Low" label)
      → critical (< 10%, "Hold your breath — surface now." banner in
      Cormorant Garamond pulsing above the stat row). Pure visual; sim
      behavior unchanged.
- [x] Sound identity — Tone.js ambient pad with per-biome chord
      voicings + five synthesized SFX. Landed with PR G.

## Production polish — player journey audit

Run once foundation PRs (A → H) merge. Do not ship 1.0 without these:

- [x] Every POC-era string, placeholder blurb, filler headline, or
      "lorem/ipsum"-energy copy replaced with voice-aligned content.
      Swept 2026-04-23 — zero TODO / FIXME / placeholder / lorem /
      ipsum in `src/`. Landing hero + codename blurb + objective
      banner + game-over summary all use cartographer's-log voice.
- [x] Every POC visual (typographic-only cards, generic gradient
      backdrops, untextured silhouettes) replaced with production art
      unique to Bioluminescent Sea — no generic-AI aesthetic leakage.
      Landing hero is an animated canvas (drifting kelp ribbons +
      pulsing creature sparks + submersible silhouette w/ headlight
      cone). Entity layer: authored PixiJS silhouettes for jellyfish
      (bell + bezier tentacles), plankton (5-dot radial cluster), and
      glowfish (ellipse + tail fins + eye). Biome-tinted gradient
      backdrop shifts with depth. Favicon / apple-touch / OG image
      all carry the brand jellyfish.
- [x] Cold 60-second playthrough passes for a first-time player: avatar
      identifiable, first meaningful object identifiable, goal
      communicated, loop makes sense, feedback on every action.
      Audited on 2026-04-23 via Chrome DevTools MCP at 1280×720; caught
      a first-second HULL SHOCK bug (lastImpactTimeRef was init to
      -Infinity, defeating the grace window). Fix shipped in PR #21.
      Screenshots archived to `docs/screenshots/`.
- [x] Deployed to GitHub Pages. Zero console errors on the live URL
      across desktop (1280×720) and mobile portrait (390×844).
      cd.yml runs on every push to main; first verified deploy at
      https://arcade-cabinet.github.io/bioluminescent-sea/ on
      2026-04-23. Desktop clean; mobile golden-path covered by the
      Playwright e2e mobile-chromium project.
- [x] All review feedback on every PR in the foundation sequence
      addressed. CodeRabbit surfaced minor nitpicks on PR #10 (sim
      split) — the actionable ones (e.g. `normalizedHash` guard
      against non-positive modulo) shipped in the same PR. No
      unresolved change-request reviews on any merged foundation PR.

## Next games (autopilot continuation)

After Bioluminescent Sea is production-polished and deployed, the same
foundation + player-journey + identity + content pass applies, in
order, to the sibling POC extractions:

- [ ] `../cosmic-gardener` — foundation in progress (2026-04-24):
      PRODUCTION.md + seeded-RNG scaffold + animated landing hero
      all merged (PR #9 + #10 + #11). Starfield + drifting cosmic
      dust + pulsing orb with a constellation ring. POC-leakage copy
      purged — verb chips now "Launch the orb / Awaken the pattern /
      Rest when it hums" and the title uses Fraunces instead of the
      stale bs-display class. Remaining A → H work (audio, content
      pipeline, identity icons, production deploy) tracked in that
      repo.
- [ ] `../enchanted-forest` — foundation in progress (2026-04-24):
      PRODUCTION.md + seeded-RNG scaffold merged (PR #8 + #9);
      animated grove hero in flight (PR #10). Forest canopy +
      sacred tree silhouette + 32 fireflies + 18 rising cinders +
      drifting rune glyphs. Remaining A → H work tracked in that
      repo.

Each repo gets its own `docs/PRODUCTION.md` with a tailored sequence.
The **rendering/physics layer is per-game** — bioluminescent-sea uses
PixiJS + Koota + Yuka; cosmic-gardener uses a DOM-particle stack;
enchanted-forest uses a mix of DOM SVG + Tone.js-driven rune UI.
The **shared foundation tooling** (seedrandom, Tone.js, Zod, Biome,
Vitest, Playwright, Capacitor, release-please) is the common template;
per-game choices diverge at the rendering architecture and the
design/content layer.
