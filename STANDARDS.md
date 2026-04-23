---
title: Standards
updated: 2026-04-23
status: current
domain: quality
---

# Bioluminescent Sea — Standards

## Code quality

### File length

Soft limit 300 LOC per file. Hard exceptions:

- `src/ui/Game.tsx` — orchestrator. Currently ~1200 LOC because it
  carries the canvas-rendering library inline. Acceptable while the
  draw functions remain pure helpers, but if this file grows past
  1500 LOC the draw helpers should move to `src/render/*.ts` as pure
  `(ctx, ...) => void` functions with their own tests.
- `src/engine/deepSeaSimulation.ts` — the deterministic simulation.
  Acceptable to stay at ~900 LOC; split by system (creature, predator,
  pirate, player) if it grows past 1200.

### TypeScript

- Strict mode via `tsconfig.app.json`.
- `verbatimModuleSyntax: true` — use `import type` for type-only
  imports.
- No `any`. Prefer discriminated unions.
- Explicit return types on exported functions.

### Linting and formatting

- Biome 2.4. `pnpm lint` = `biome lint .`.
- No ESLint, no Prettier, no stylelint.
- Do NOT introduce Tailwind — identity lives in CSS vars + inline styles.

### Dependencies

- Weekly dependabot, minor + patch grouped.
- Capacitor is pinned by major; don't auto-bump.
- react / react-dom share version, bump together.
- `@fontsource/*` versioned separately; safe to bump minor.

## Player-journey gate (non-negotiable)

A PR may not merge if any of the below fail on desktop (1280×720) OR
mobile-portrait (390×844) viewports.

1. Cold load: DOM ready and first-render canvas frame paints in under
   2 seconds from navigation start.
2. Start screen shows title, one-sentence subtitle tagline, primary
   CTA, and the mode selector. All text readable; no layout shift.
3. Clicking "Begin Dive" transitions to gameplay within 600ms, no
   console errors.
4. Within 15 seconds of gameplay a cold player can identify: their
   sub (center of scene with headlamp cone + sonar pulse), at least
   one glowing creature, and one status readout that updates in real
   time (Score, Oxygen, Chain, Depth, or Charted%).
5. The bottom objective banner updates as gameplay state changes.
6. No console errors throughout the run.
7. Game-over screen shows title + summary + "Dive Again" CTA, and
   clicking CTA returns to the start screen within 600ms.

## Brand

- Title: "Bioluminescent Sea"
- Tagline: "Sink into an abyssal trench. Trace glowing routes past landmark creatures. Surface breathing easier than when you started."
- Palette and fonts: see [`CLAUDE.md`](./CLAUDE.md) palette block.
- Icon: a single glowing jellyfish silhouette over abyssal navy. TODO
  (tracked in `docs/STATE.md`).
