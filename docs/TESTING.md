---
title: Testing
updated: 2026-04-23
status: current
domain: quality
---

# Testing

## Lanes

| Lane | When it runs | Config | Covers |
| ---- | ------------ | ------ | ------ |
| `pnpm test:node`    | dev + CI | `vitest.config.ts` | pure simulation, Perlin, sessionMode, runtimePause |
| `pnpm test:dom`     | dev + CI | `vitest.dom.config.ts` | presentational React components (no canvas, no framer) |
| `pnpm test:browser` | dev + CI | `vitest.browser.config.ts` | real-Chromium canvas + touch |
| `pnpm test:e2e`     | CI only  | `playwright.config.ts` | full user journeys, screenshot capture |

Node + dom lanes run under two seconds combined. Browser lane adds
~5–10s. E2E runs only in CI.

## What to test

- **Engine invariants**: `deepSeaSimulation` must stay deterministic.
  Any seeded run produces the same `score`/`telemetry` sequence.
  The `.test.ts` already covers `advanceScene`, `advancePlayer`,
  `advancePredator`, collection mechanics, and completion detection.
- **Palette lock**: any change to `src/theme/tokens.ts` gets a dom
  test asserting the CSS vars are still exposed with the expected
  values.
- **HUD legibility**: for each major HUD state (clean, low oxygen,
  threat alert, landmark proximity), a browser test captures a
  screenshot and asserts no console errors.
- **Player journey**: an e2e test per release that loads, clicks
  Begin Dive, waits 5 seconds, asserts score > 0 (collected at
  least one creature), asserts the bottom banner text has changed
  at least once, returns to menu.

## Coverage

Target 80% on `src/engine/` and `src/lib/`. The UI layer is covered
by browser + e2e rather than unit coverage; the numbers in `coverage/`
reflect engine/lib only.

## Screenshots

E2E screenshots land in `test-results/` (gitignored) during runs and
are uploaded as CI artifacts. Reference screenshots for the README +
README-adjacent docs live under `docs/screenshots/`.
