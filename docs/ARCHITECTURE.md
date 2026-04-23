---
title: Architecture
updated: 2026-04-23
status: current
domain: technical
---

# Architecture

## Stack

| Layer | Choice |
| ----- | ------ |
| Rendering | 2D Canvas via `<canvas>` in React, draw fns in `src/ui/Game.tsx` |
| UI framework | React 19 |
| State | React hooks + `useRef` for per-frame mutation |
| Animation (chrome) | framer-motion |
| Build | Vite 8 |
| Test | Vitest 4 (node / jsdom / browser) + Playwright |
| Lint/format | Biome 2.4 |
| Mobile wrap | Capacitor 8 |

No Tailwind, no shadcn, no CSS-in-JS runtime. Style via CSS custom
properties in `src/theme/global.css` and inline style objects.

## Data flow

```
user input (keyboard / touch)
        ↓
  useTouchInput / key listeners
        ↓
  Game.tsx per-frame gameLoop(dt, totalTime)
        ↓
  advanceScene(...) + resolveDiveThreatImpact(...)
        ↓
  mutates refs (playerRef, creaturesRef, ...)
        ↓
  renderScene(ctx, width, height, ...)  ← draws canvas
        ↓
  next frame scheduled by useGameLoop → RAF
```

React state is only used for **phase** (landing/playing/gameover/complete),
**HUD-visible numbers** (score, timeLeft, multiplier, telemetry), and
**pulses** (oxygen gain, impact). The inner game state lives on refs
and mutates per frame for performance.

## Files you'll edit most

- `src/engine/deepSeaSimulation.ts` — pure simulation, deterministic,
  testable in node.
- `src/ui/Game.tsx` — the orchestrator + canvas renderer. Top section
  is the draw helpers, middle is `DeepSeaGame` component, bottom is
  the phase router.
- `src/ui/hud/HUD.tsx` — stat row + landmark chip + objective banner.
- `src/ui/shell/*` — title / game-over / viewport / button.
- `src/theme/*` — palette + global CSS.

## Responsibilities

| Responsibility | Owner |
| -------------- | ----- |
| Deterministic game state advance | `src/engine/` |
| Player input capture | `src/hooks/useTouchInput.ts` |
| Frame-loop timing | `src/hooks/useGameLoop.ts` |
| Canvas drawing | `src/ui/Game.tsx` draw helpers |
| HUD overlay | `src/ui/hud/HUD.tsx` |
| Phase transitions | `src/ui/Game.tsx` top-level component |
| Save slot / best score | `localStorage` keyed by
  `bioluminescent-sea:v1:save` / `…:best-score` |

## Performance contract

- Target 60 FPS on mid-tier mobile (iPhone 12, Pixel 6).
- Draw calls per frame: backdrop (~10 ops), ridges (~3 x 12 ops),
  particles (count driven by engine, typically 30-80), creatures
  (8-24), predators (0-3), pirates (0-2), player.
- If a frame drops below 50 FPS on mobile, bucketize particles and/or
  cull off-screen creatures before the renderer runs.
