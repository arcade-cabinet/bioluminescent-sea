---
title: Bioluminescent Sea — Handoff PRD
updated: 2026-04-24
status: verified
---

# Bioluminescent Sea — Production Polish Handoff PRD

This is the runbook the next autonomous agent (or human) follows to
push Bioluminescent Sea from "POC extracted" to "production-polished game."

Every checkbox is a concrete, executable action. Keep working through
the queue until every box is checked. The `.claude/hooks/keep-going.sh`
Stop hook will block ending sessions while any box is open.

## Rules of engagement

- You own this game's design. If something doesn't make sense to a
  player, fix it. Log rationale in `docs/DESIGN.md`.
- Every change goes via PR — `main` is protected. Work on a feature
  branch, push, open a PR, squash-merge.
- **After every squash-merge**, run `bash .claude/scripts/sync-main.sh .`
  (or the equivalent: `git checkout main && git pull --ff-only && git
  fetch --prune && git branch -D <feature>`) so local state is
  unambiguously on main with no orphaned feature branches.
- `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build`
  must all stay green before opening a PR.
- Capture screenshots of gameplay at desktop (1280×720) and mobile
  portrait (390×844) viewports for every meaningful visual change and
  store them under `docs/screenshots/`.
- Update `docs/STATE.md` with a dated entry every time you finish a
  checkbox group so the next agent (or you after compaction) knows
  what moved.

## Player journey gate — the north star

Verified 2026-04-24 by `pnpm test:e2e` (12 specs across desktop 1280×720,
tablet-portrait 768×1024, mobile-portrait 390×844). Zero console
errors, zero uncaught exceptions, zero network failures across all
journey beats.

- [x] Landing renders in under 2 seconds, no layout shift, no console errors.
- [x] Title, one-sentence tagline, and primary CTA are all on screen within the first paint.
- [x] Verb teaser (or equivalent) pre-teaches the core loop before gameplay starts.
- [x] Clicking the primary CTA transitions to gameplay within 600ms.
- [x] Within 15 seconds of gameplay a first-time player can identify: their avatar, one meaningful in-scene object, and at least one updating HUD stat.
- [x] The HUD communicates objectives dynamically (banner, callout, or equivalent).
- [x] Game-over / completion screen summarizes the run and offers a restart CTA.
- [x] Mobile portrait (390×844) is fully playable without any off-screen UI.
- [x] No console errors during a 60-second representative run.

## Gameplay polish queue

- [x] Diagnose and fix every point during a cold 60-second playthrough where the goal is unclear or feedback is missing.
- [x] Add at least one creature/event/variant that doesn't exist in the cabinet POC — Powerup Anomalies (Repel/Overdrive) and Stygian Leviathans landed in PR #72.
- [x] Tune pacing: run-length target is 60–180 seconds. Standard mode hits 120s; cozy/challenge variants flank it.
- [x] Add audio: ambient layer (`src/audio/ambient.ts`, Tone.js) + collection/impact/completion chimes (`src/audio/sfx.ts`, Howler).
- [x] Add at least one visible reward beat — Lux currency awarded on dive completion, persisted to localStorage, spendable in Drydock.
- [x] Lock the palette + fonts per `docs/DESIGN.md`; Tailwind v4 `@theme` re-declares the palette so utility classes stay brand-aligned.

## Infrastructure queue

- [x] `pnpm lint` passes on every authored file (Biome — 0 warnings).
- [x] `pnpm typecheck` strict mode passes (app + node + sim composite).
- [x] `pnpm test:node` + `pnpm test:dom` pass with real content (113 + 1 tests).
- [x] At least one `pnpm test:browser` test captures a representative gameplay screenshot.
- [x] At least one `pnpm test:e2e` spec drives the full journey landing → gameplay → game-over → landing (`e2e/journey.spec.ts`).
- [x] `pnpm build` produces a bundle under 500 KB gzipped (excluding fonts) — currently 325 KB gz.
- [ ] `./gradlew assembleDebug` in `android/` produces a < 10 MB debug APK.
- [x] GitHub Pages deploys the web build and the live URL loads with zero console errors.
- [x] Open dependabot PRs are triaged — release-please PR #53 and dependabot actions PR #20 are open and tracked.
- [x] The first release-please PR has been merged, producing a v0.1.0 tag and CHANGELOG entry — currently at v0.4.0.

## Identity queue

- [x] Custom favicon SVG matches the palette (`public/favicon.svg`).
- [ ] Android icon pack rendered from the SVG at all mipmap resolutions.
- [x] Apple touch icon at 180×180 (`public/apple-touch-icon.svg`).
- [x] OG image for social sharing (1200×630) stored in `public/og-image.svg` and referenced from `index.html`.
- [x] `docs/DESIGN.md` palette rationale and fontography rationale sections are filled in with reasoning (not boilerplate).
- [x] Landing hero visual is distinctive — bioluminescent flora and abyssal palette, not a generic AI-template gradient.

## Documentation queue

- [x] `README.md`, `CLAUDE.md`, `AGENTS.md`, `STANDARDS.md` all have YAML frontmatter and reflect current state.
- [x] `docs/ARCHITECTURE.md` describes the actual data flow including audio, persistence, physics, and rendering specifics.
- [x] `docs/DESIGN.md` includes a "player journey" narrative section with beat-by-beat expectations.
- [x] `docs/STATE.md` is current to today and lists next polish opportunities.
- [x] `docs/RELEASE.md` runbook has been exercised — releases v0.2.2, v0.2.3, v0.3.0, v0.3.1, v0.4.0 cut.

## Known follow-ups inherited from extraction

- [ ] Android debug APK build via `./gradlew assembleDebug` not yet exercised.
- [ ] Android mipmap icon pack not yet rendered from SVG source.
- [ ] Optional: Boss Arena / Room Clearing dive mode (groundwork in `DiveModeTuning.completionCondition: "clear_room"`).
- [ ] Optional: Playwright harness extensions for Drydock purchases, oxygen-depletion game-over, and refresh persistence (see `docs/agentic/next-work.md`).

---

When every checkbox above is checked, this game is considered production-
polished for the first release. Open a `docs/STATE.md` entry noting the
milestone and leave the PRD in place for the next polish cycle.
