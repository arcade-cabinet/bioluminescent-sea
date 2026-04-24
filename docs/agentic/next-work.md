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

- **Unified Open World Generation:** Fixed 18-beacon seeded logic was deleted. The game strictly uses the `ChunkManager` to infinitely load entities as the player descends into the procedurally generated `stygian-abyss`.
- **Yuka AI Integration:** Creatures naturally flock using boids (Alignment, Cohesion, Separation). Predators stalk and dash. Pirates wander.
- **Meta-progression Loop:** Dives yield persistent `Lux` currency saved to `localStorage`, which is spent in the `DrydockScreen` to buy hull/battery/motor/lamp upgrades that alter physical simulation values.
- **Power-ups & Bosses:** Anomalies (Repel, Overdrive) dynamically spawn in chunks. `Leviathans` dynamically spawn in the deepest abyssal layers with logarithmic scaling.
- **Responsive Rendering:** Entity sizes are strictly locked to a base `640px` coordinate rather than dynamically scaling via `minDimension`, fixing visual pop-in glitches across viewports.
- **Pixi Renderer + FX:** Procedurally generated entity graphics using `pixi.js`. Particles track specific `zDepth` to create distinct background/midground/foreground parallax layers, including camera shake on impact and a glowing submersible trail.
- Multi-viewport Playwright journey harness at `e2e/journey.spec.ts` covers the full flow.

## What's NOT done

Exhaustive list. Pick the top item that fits your session size, do it, commit + PR + auto-squash-merge.

### Priority 1 — Boss Arena Mode / Room Clearing

We've laid the groundwork for configurable dive types via `DiveModeTuning` (which has slots for `completionCondition: "clear_room"`).
Currently, descent is continuous. We need to build a mode where:
- Vertical descent halts when entering a new chunk.
- The player is locked in a "room" full of bullet-hell styled swarms (Brotato style).
- Clearing all threats unlocks the descent to the next tier.

### Priority 2 — player-journey PRD gate

The items in `HANDOFF-PRD.md` under "Player journey gate" are the published bar for a shippable player experience. 
Go through `HANDOFF-PRD.md` top to bottom, verify each item against the deployed build at <https://bioluminescent-sea.pages.dev/>, and tick the boxes that pass.

### Priority 3 — extend the Playwright harness

The journey harness in `e2e/journey.spec.ts` covers landing → customization → dive start → play. It does NOT cover:

- **Drydock Purchases.** Navigating the new Drydock screen and purchasing an upgrade.
- **Game over from oxygen depletion.** Add a seed / query param that accelerates oxygen drain (e.g. `?devFastDive=1`).
- **Refresh persistence.** Refresh mid-dive and verify the seed stays, HUD restores, and the `initialSnapshot` path from `resolveDeepSeaSnapshot()` replays the run.
- **Mobile landscape (844×390).** Add a 4th project to `playwright.config.ts`.

## How to ship

1. Branch off main. Conventional Commits (`feat:`, `fix:`, `perf:`, `test:`, `docs:`, etc.).
2. `pnpm typecheck`, `pnpm lint`, `pnpm test:node` must stay green.
3. Run `pnpm test:e2e` across all three viewports before opening the PR.
4. `gh pr create` and then `gh pr merge <n> --auto --squash`.
5. After merge: `git checkout main && git pull --ff-only`.

## Key files

- `src/ui/Game.tsx` — outer state machine, landing / customization / drydock / playing / gameover wrappers.
- `src/hooks/useMetaProgression.ts` — persistent Lux currency and sub upgrades.
- `src/sim/ai/manager.ts` — Yuka simulation.
- `src/sim/chunk/` — the sole infinite world generation pipeline.
- `src/render/layers/creature-factory.ts` — procedural pixi graphics logic.

## Don'ts

- Do NOT use `Math.random()` anywhere. Use `createRng(seed)` from `@/sim/rng`. This is a CI blocker.
- Do NOT re-introduce raw `ctx.*` drawing outside of `src/render/*`.
- Do NOT let React touch pixi sprites or Koota entities directly.
