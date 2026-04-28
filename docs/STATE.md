---
title: State
updated: 2026-04-28
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

## Recently merged (iteration-1 polish era)

Counting from the date of the proper-depth-zone-taxonomy ship:

Foundation → iteration-0 (post-taxonomy):
- **PR #226** — proper oceanographic depth zone taxonomy.
- **PR #227** — seafloor symmetry: `OCEAN_FLOOR_METERS = 11000m`.
- **PR #228** — post-taxonomy sweep + GOAP seafloor balance test.
- **PR #229** — HUD landmarks driven by authored content.
- **PR #230** — landmark catalogue 6 → 12.
- **PR #231** — trench blurbs reference new landmarks.
- **PR #232** — plain-English dive-completion copy.
- **PR #233/234/235/236** — autopilot queue + runner + stale-biome
  sweep + iteration-1 visual assessment.

Iteration-1 polish loop (autopilot, all 14 findings cleared):
- **PR #237** — refresh STATE.md to post-taxonomy era.
- **PR #238** — wire authored creature JSON into entity profile
  tables (`config/raw/creatures/*.json` now drives gameplay).
- **PR #240** — author 13 named species JSONs matching every
  biome's `ecology.collectibles` (sardine-shoal, lanternfish,
  anglerfish-lure, gulper-eel, dumbo-octopus, hadal-snailfish, …).
- **PR #242** — demote unreproducible shallow-water washout
  finding (trust-but-verify).
- **PR #243** — mode-card carousel arrows + pagination dots gain
  readable contrast (pill bg + ring + larger glyphs).
- **PR #245** — seed-picker Today's Chart vs Reroll affordance:
  Today's gains an active state (filled check + ring) so the
  toggle-vs-action split reads at a glance.
- **PR #247** — landing Drydock chip respects
  `env(safe-area-inset-{left,right})` so phones with notches
  don't clip.
- **PR #249** — Drydock level-0 upgrade icons ghost to 60 %
  opacity so unpurchased upgrades read at a glance.
- **PR #251** — integration test: \`recordDive\` preserves both
  score and depth (guards against the "BEST 0 / DEEPEST 0m"
  regression vector).
- **PR #253** — Subduction Mud Volcano landmark at 8000 m
  closes the gap between Cold Seep and Hadal Trench. 12 → 13.
- **PR #255** — HUD landmark chip renders a ↓ glyph next to
  metres-to-go so the spatial relationship is unambiguous.
- **PR #257** — chunk-spawn `SPECIES_VARIANTS` colours and
  comments aligned with authored ecology + structural contract
  test ("every \`ecology.collectibles\` entry has a creature JSON").
- **PR #259** — Stop hook now also gates on
  `.autopilot/QUEUE.md`, not just `docs/PRODUCTION.md`.
- **PR #260** — Complete Chart achievement (pass every authored
  landmark in a single dive). \`landmarksPassed\` joins
  `DiveRunStats`; \`advanceRunStats\` accumulates via
  \`lastPassedLandmark\`.
- **PR #262** — ambient render layer paints distinct content for
  all 5 zones (abyssopelagic gets whale-fall + dumbo-octopus +
  deep-jelly trails; hadopelagic keeps vents + outcrops + wreck).

## Metrics

- Tests: **336 passing** across 30 files.
- Typecheck: clean across app + node + sim composite projects.
- Lint: clean (Biome).
- Authored content: 5 biomes, 18 creatures, 13 landmarks.
- Build: TBD — verify on next iteration.
- Open PRs: track via `gh pr list`.

## Open work

The actionable queue lives in
[.autopilot/QUEUE.md](../.autopilot/QUEUE.md). The runner spec
that an automated loop reads is
[.autopilot/RUNNER.md](../.autopilot/RUNNER.md).

The iteration-1 polish loop completed — every finding from
`docs/screenshots/iteration-1/ASSESSMENT.md` has shipped or been
demoted with explanation. The next iteration should be a fresh
visual-assessment pass (iteration-2) to surface the *next* batch
of polish work, since the surface area has materially changed
since iteration-1 (carousel contrast, seed-picker affordance,
HUD landmark direction glyph, abyssal ambient split).

## Decisions log

For material decisions and reasons, see
[docs/agentic/decisions-log.md](agentic/decisions-log.md). For the
next agent's pickup list, see
[.autopilot/QUEUE.md](../.autopilot/QUEUE.md).
