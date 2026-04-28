---
title: State
updated: 2026-04-27
status: current
domain: context
---

# State

Current snapshot of where the game is, what just shipped, and what
the autopilot loop should pick up next. Companion to
[CLAUDE.md](../CLAUDE.md), [docs/DESIGN.md](DESIGN.md), and
[.autopilot/QUEUE.md](../.autopilot/QUEUE.md).

## What the game is, today

Bioluminescent Sea is a meditative submarine-dive explorer. The
player picks one of three modes — Exploration, Descent, Arena —
descends through five real oceanographic depth zones (sunlight,
twilight, midnight, abyss, hadal), collects glowing creatures, and
dodges predators. The world has a real seafloor at 11000 m. In
free-roam modes the depth counter pins at the floor and the player
keeps moving laterally; in Descent, reaching a seed-derived target
depth completes the dive.

## Architecture, today

The factory pyramid is fully in place: dive → region → chunk →
actor archetypes, every gameplay knob a slot, no `if mode === "X"`
branches outside slot files. Recent stack:

- React 19 + PixiJS 8 + Koota ECS + Yuka steering + GOAP player
  controller + Tone.js + Howler + Tailwind v4 + Vitest +
  Playwright + Biome.
- Pure sim under `tsconfig.sim.json` — no DOM, no pixi, no React.
- 5-zone biome taxonomy (epipelagic / mesopelagic / bathypelagic
  / abyssopelagic / hadopelagic) with full ecology atlas authored
  in `config/raw/biomes/*.json`.
- 12 named landmarks authored in `config/raw/landmarks/*.json`,
  surfaced to the HUD as the *next-upcoming* landmark below the
  sub with metres-to-go.
- Seafloor symmetry — `seafloorBehavior` slot drives free-roam vs
  win-on-floor per mode.
- Plain-English copy across landing, mode cards, seed picker, dive
  banners, completion screen.

## Recently merged (post-taxonomy era)

Counting from the date of the proper-depth-zone-taxonomy ship:

- **PR #226** — proper oceanographic depth zone taxonomy (5
  pelagic zones, ecology atlas, plain-English copy across all
  surfaces).
- **PR #227** — seafloor symmetry: `seafloorBehavior` slot, free-
  roam clamp at `OCEAN_FLOOR_METERS = 11000m`.
- **PR #228** — post-taxonomy comment sweep + GOAP-bot integration
  test for the seafloor clamp through the runtime path.
- **PR #229** — drive HUD landmarks from authored content.
- **PR #230** — landmark catalogue 6 → 12 (sargassum drift,
  continental shelf, vertical migration, bone field, cold seep,
  hadal trench).
- **PR #231** — trench blurbs reference the new landmarks (12 →
  18 variants).
- **PR #232** — plain-English dive-completion copy.
- **PR #233** — seed autopilot queue.
- **PR #234** — finish stale-biome comment sweep across
  fx/water/chunk/region/entities/advance/DrydockScreen/VISUAL_REVIEW.
- **PR #235** — visual assessment of iteration-0 + iteration-1
  screenshots (six findings recorded).
- **PR #236** — autopilot loop-runner spec.

## Metrics

- Tests: **332 passing** across 29 files.
- Typecheck: clean across app + node + sim composite projects.
- Lint: clean (Biome).
- Build: TBD — verify on next iteration.
- Open PRs: track via `gh pr list`.

## Open work

The actionable queue lives in
[.autopilot/QUEUE.md](../.autopilot/QUEUE.md). The runner spec
that an automated loop reads is
[.autopilot/RUNNER.md](../.autopilot/RUNNER.md).

Highlights of what's open:

- Findings from the iteration-1 visual assessment, each with a
  spec in `docs/screenshots/iteration-1/ASSESSMENT.md`.
- Wire authored creature JSON into actor archetype spawn (the
  largest unresolved content-pipeline gap).
- Per-zone creature JSON authoring matching each biome's ecology
  block.

## Decisions log

For material decisions and reasons, see
[docs/agentic/decisions-log.md](agentic/decisions-log.md). For the
next agent's pickup list, see
[.autopilot/QUEUE.md](../.autopilot/QUEUE.md).
