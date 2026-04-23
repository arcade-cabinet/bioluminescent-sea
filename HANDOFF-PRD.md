---
title: Bioluminescent Sea — Handoff PRD
updated: 2026-04-23
status: active
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

A cold player must satisfy all of this on the deployed web build:

- [ ] Landing renders in under 2 seconds, no layout shift, no console errors.
- [ ] Title, one-sentence tagline, and primary CTA are all on screen within the first paint.
- [ ] Verb teaser (or equivalent) pre-teaches the core loop before gameplay starts.
- [ ] Clicking the primary CTA transitions to gameplay within 600ms.
- [ ] Within 15 seconds of gameplay a first-time player can identify: their avatar, one meaningful in-scene object, and at least one updating HUD stat.
- [ ] The HUD communicates objectives dynamically (banner, callout, or equivalent).
- [ ] Game-over / completion screen summarizes the run and offers a restart CTA.
- [ ] Mobile portrait (390×844) is fully playable without any off-screen UI.
- [ ] No console errors during a 60-second representative run.

## Gameplay polish queue

- [ ] Diagnose and fix every point during a cold 60-second playthrough where the goal is unclear or feedback is missing.
- [ ] Add at least one creature/event/variant that doesn't exist in the cabinet POC — the extraction is an opportunity to finish the game, not just port it.
- [ ] Tune pacing: run-length target is 60–180 seconds; if it's longer or shorter, adjust.
- [ ] Add audio: ambient layer + at least one event chime (collection, impact, completion). Web Audio API, no heavy dep.
- [ ] Add at least one visible reward beat so finishing a run feels like something.
- [ ] Lock the palette + fonts per `docs/DESIGN.md`; replace any generic defaults (Tailwind, shadcn, unthemed framer) with palette-aware versions.

## Infrastructure queue

- [ ] `pnpm lint` passes on every authored file.
- [ ] `pnpm typecheck` strict mode passes.
- [ ] `pnpm test:node` + `pnpm test:dom` pass with real content (not just passWithNoTests).
- [ ] At least one `pnpm test:browser` test captures a representative gameplay screenshot.
- [ ] At least one `pnpm test:e2e` spec drives the full journey landing → gameplay → game-over → landing.
- [ ] `pnpm build` produces a bundle under 500 KB gzipped (excluding fonts).
- [ ] `./gradlew assembleDebug` in `android/` produces a < 10 MB debug APK.
- [ ] GitHub Pages deploys the web build and the live URL loads with zero console errors.
- [ ] Open dependabot PRs are triaged — merged if compatible, closed with reason if incompatible.
- [ ] The first release-please PR has been merged, producing a v0.1.0 tag and CHANGELOG entry.

## Identity queue

- [ ] Custom favicon SVG matches the palette.
- [ ] Android icon pack rendered from the SVG at all mipmap resolutions.
- [ ] Apple touch icon at 180×180.
- [ ] OG image for social sharing (1200×630) stored in `public/` and referenced from `index.html`.
- [ ] `docs/DESIGN.md` palette rationale and fontography rationale sections are filled in with reasoning (not boilerplate).
- [ ] Landing hero visual is distinctive — not a generic AI-template gradient.

## Documentation queue

- [ ] `README.md`, `CLAUDE.md`, `AGENTS.md`, `STANDARDS.md` all have YAML frontmatter and reflect current state.
- [ ] `docs/ARCHITECTURE.md` describes the actual data flow including any audio, persistence, physics, or rendering specifics that emerged during polish.
- [ ] `docs/DESIGN.md` includes a "player journey" narrative section with beat-by-beat expectations.
- [ ] `docs/STATE.md` is current to today and lists next polish opportunities.
- [ ] `docs/RELEASE.md` runbook has been exercised at least once (i.e., a real release has been cut).

## Known follow-ups inherited from extraction

(Fill this section as you go when you discover something that's not
covered above.)

- [ ] _placeholder — replace with real items as discovered_

---

When every checkbox above is checked, this game is considered production-
polished for the first release. Open a `docs/STATE.md` entry noting the
milestone and leave the PRD in place for the next polish cycle.
