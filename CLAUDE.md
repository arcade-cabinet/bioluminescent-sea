---
title: Claude Code Instructions
updated: 2026-04-23
status: current
---

# Bioluminescent Sea — Agent Instructions

## What This Is

A meditative canvas-rendered ocean-dive explorer. The player pilots a
small submersible through a deep-sea column. Every beat is one of:

- move toward a labeled landmark (see the top-right chip),
- collect a bioluminescent creature (score + chain multiplier),
- avoid a predator silhouette or a pirate sub's lantern cone (hull shock
  penalty reduces oxygen),
- read the bottom objective banner, which is dynamic and tells the
  player what the trench wants them to do right now.

Oxygen is the timer. Running out ends the dive.

## Critical Rules

1. **Canvas is the source of truth.** All creatures, backdrop elements,
   player sub, sonar pings, predator shadows, route beacon are drawn
   to `<canvas>` in `src/ui/Game.tsx` via pure 2d context functions.
   React only owns phase (landing / playing / gameover / complete) and
   HUD overlays. Do not invent WebGL or R3F here.
2. **The engine is deterministic.** `src/engine/deepSeaSimulation.ts`
   is pure TypeScript and must stay testable without the DOM. Perlin
   noise is seeded; state advances via `advanceScene(state, dt)`.
3. **No Tailwind, no CSS-in-JS runtime, no shadcn.** CSS custom
   properties in `src/theme/global.css` + inline styles in components.
   This is a deliberate design choice to keep the identity forward and
   avoid generic-AI default aesthetics.
4. **Biome, not ESLint.** `pnpm lint` runs Biome.
5. **pnpm only.** Do not create `package-lock.json` or `yarn.lock`.
6. **Player journey is the deliverable.** A cold player must understand
   the goal within 15 seconds of landing. If that breaks, fix it before
   anything else.

## Commands

```bash
pnpm dev                 # Vite dev server
pnpm build               # tsc + vite build
pnpm typecheck           # tsc -b --pretty false
pnpm lint                # Biome
pnpm test                # test:node + test:dom
pnpm test:browser        # real Chromium via @vitest/browser-playwright
pnpm test:e2e            # Playwright end-to-end
pnpm cap:sync            # build + cap sync (android + ios)
pnpm cap:open:android    # open android studio
pnpm cap:run:android     # pnpm cap:sync && cap run android
```

## Project Structure

- `src/engine/` — pure TypeScript simulation (`deepSeaSimulation.ts`,
  `.test.ts`). No DOM, no React.
- `src/lib/` — Perlin noise, session-mode tuning, runtime-pause
  coordinator, small utilities.
- `src/hooks/` — React hooks that bridge engine state to rAF
  (`useGameLoop.ts`) and touch input (`useTouchInput.ts`).
- `src/theme/` — palette tokens (`tokens.ts`) and global CSS
  (`global.css`) with font imports.
- `src/ui/Game.tsx` — the orchestrator; owns phase, canvas rendering,
  HUD composition, save-slot persistence.
- `src/ui/shell/` — identity-forward chrome: `GameViewport`,
  `StartScreen`, `GameOverScreen`, `OverlayButton`.
- `src/ui/hud/HUD.tsx` — in-game stat row + landmark chip + objective
  banner + threat flashes.

## Design palette (locked-in)

See `docs/DESIGN.md` for rationale.

```
--color-bg:        #050a14   near-black navy (background, safe area)
--color-abyss:     #0a1a2e   abyssal navy (card surfaces)
--color-deep:      #0e4f55   deep teal (mid-water, UI strokes)
--color-glow:      #6be6c1   bioluminescent mint (creatures, CTA, labels)
--color-fg:        #d9f2ec   pale sea-mist (body text)
--color-fg-muted:  #8aa7a2   muted mist (secondary labels)
--color-warn:      #ff6b6b   warn red (low oxygen, threats)
```

Display font: Cormorant Garamond (serif, liquid terminals, titles only).
Body font: Inter (sans-serif, high x-height, HUD + body).
