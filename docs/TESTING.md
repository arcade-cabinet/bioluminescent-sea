---
title: Testing
updated: 2026-04-23
status: current
domain: quality
---

# Testing

This document owns test strategy, suites, and coverage goals. Quality
rules live in [../STANDARDS.md](../STANDARDS.md). Architecture context
lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Suites

### Type check

```bash
pnpm run typecheck
```

Runs the three composite TypeScript projects (`app`, `node`, `sim`) in
build mode so CI catches drift in the split configs. `sim` compiles
without React, DOM, pixi, or Koota imports — an accidental leak from
UI into the pure engine fails here first.

### Node tests — pure sim logic

```bash
pnpm run test:node
```

Environment: Node (no browser, no DOM). Tests live in
`src/**/__tests__/*.test.ts`.

Covers: `src/sim/rng`, `src/sim/world`, `src/sim/entities`,
`src/sim/dive`, `src/sim/ai` behaviors where they don't need a DOM
raycast (most of them). The sim must run without React — any test that
imports a UI component is in the wrong file.

Invariants asserted here:
- `createRng(seed)` is deterministic across invocations.
- `codenameFromSeed(s)` round-trips through `seedFromCodename`.
- `biomeAtDepth(depth)` boundaries match the authored table.
- `advanceDive(state, input, dt)` is pure — calling it twice with the
  same inputs produces identical output.

### DOM tests — presentational components

```bash
pnpm run test:dom
```

Environment: jsdom (`vitest.dom.config.ts`). Tests in
`src/**/*.dom.test.tsx`.

Covers: HUD components, landing screen layout, overlay buttons — the
React layer where the only side effects are DOM reads and writes.

Do NOT import in DOM tests: Capacitor plugins, pixi.js, Tone.js, Koota
action dispatchers that require a real ticker. Move those to
`*.browser.test.tsx`.

### Browser tests — real Chromium

```bash
pnpm run test:browser
```

Environment: `@vitest/browser` + `@vitest/browser-playwright`, headless
Chromium. Covers pixi rendering, audio context resumption, and any test
that touches the real canvas pipeline. Slower; runs after node+dom in CI.

### E2E — player journey

```bash
pnpm run test:e2e
```

Playwright specs in `e2e/*.spec.ts`. At minimum:

- `app-flow.spec.ts` — landing → Begin Dive → 10s of gameplay →
  game-over → restart → landing. Asserts zero console errors, score
  moved off zero, at least one biome-transition banner fired.
- `seed-share.spec.ts` — `?seed=<codename>` deep-link produces the
  advertised codename in the HUD.
- `mobile-portrait.spec.ts` — 390×844 viewport; asserts no off-screen
  UI, landing CTA tappable, HUD fully visible mid-dive.

## Coverage targets

| Module          | Line coverage target |
| --------------- | -------------------- |
| `src/sim/*`     | ≥ 90%                |
| `src/ecs/*`     | ≥ 80%                |
| `src/data/*`    | 100% (schemas)       |
| `src/render/*`  | browser tests only   |
| `src/audio/*`   | browser tests only   |
| `src/ui/*`      | DOM + E2E, not unit  |

Coverage is reported from `test:node` + `test:dom` only; UI coverage
comes from Playwright visual regressions, not line counts.

## Visual regressions

- `docs/screenshots/` holds the gold-master set at 1280×720 and
  390×844 for: landing, mid-dive per biome (×4), game-over summary.
- `scripts/capture-visual-fixtures.mjs` refreshes them on demand.
- Playwright compares pixel-for-pixel with a small threshold; a diff
  fails CI and uploads the before/after as artifacts.

## Simulation regression

The deterministic engine enables a nightly regression:
`analysis-nightly.yml` runs 100 seeded dives to `y = 3600m` and asserts:

- No NaN in any telemetry field.
- Collection ratio bounded in `[0, 1]`.
- Per-frame step cost stays under 1.5ms on the GitHub runner.
- No unexpected dive-failed outcomes in the "standard" mode sample.

A failing nightly opens an issue labeled `sim-regression`.
