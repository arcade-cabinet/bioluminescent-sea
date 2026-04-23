---
title: Standards
updated: 2026-04-23
status: current
domain: quality
---

# Bioluminescent Sea — Standards

Non-negotiable constraints. Testing strategy lives in
[docs/TESTING.md](./docs/TESTING.md); architecture conventions live in
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Code quality

### File length

**Contextual — there is no universal LOC cap.** Decompose by
responsibility: a file should do one thing and a reader should be able
to hold it in their head. A 400-line pure data table or a
single-responsibility renderer is fine; a 250-line file that secretly
owns three subsystems is not. The `src/sim/` split boundary
(rng / world / entities / dive / ai) is a responsibility boundary, not
a line-count boundary — it holds even if one submodule is compact.

Hooks and CI may warn on large files but must never block.

### TypeScript

- Strict mode across `tsconfig.app.json`, `tsconfig.sim.json`,
  `tsconfig.node.json`.
- `verbatimModuleSyntax: true` — use `import type` for type-only
  imports.
- No `any`. No untyped function parameters. Explicit return types on
  exported functions.
- Discriminated unions preferred over `T | null` where the distinction
  carries semantic weight.
- `src/sim/*` compiles and tests under `tsconfig.sim.json` without React,
  DOM, pixi, Koota, or audio imports. The simulation is portable.

### Linting and formatting

- **Biome** only. `pnpm lint` runs Biome. No ESLint / Prettier /
  stylelint configs — they will conflict.

### Randomness

**Any direct `Math.random()` call in `src/` is blocked by CI.** Use
`createRng(seed)` from `@/sim/rng`. Seeds flow from `randomSeed()` on
new runs, `dailySeed()` for the shared daily trench, or
`seedFromCodename()` for replay/shared URLs.

### Dependencies

- pnpm only. `package-lock.json` and `yarn.lock` are deleted on sight.
- Pin runtime deps to the caret range that matches `package.json`
  today; dependabot weekly, minor+patch grouped.
- Capacitor is pinned by major; don't auto-bump.
- react / react-dom share version; bump together.
- `@fontsource/*` minor bumps are safe.

## Runtime stack

| Layer          | Library                                    |
| -------------- | ------------------------------------------ |
| UI             | React 19                                   |
| Rendering      | PixiJS 8 (WebGL with canvas fallback)      |
| ECS            | Koota                                      |
| AI             | Yuka (steering + state machines)           |
| PRNG           | seedrandom via `@/sim/rng`                 |
| Audio — ambient| Tone.js (synthesized, depth/biome-driven)  |
| Audio — SFX    | Howler                                     |
| Animation (UI) | framer-motion (overlays), GSAP (transitions)|
| Styling        | Tailwind v4 + CSS custom properties        |
| Validation     | Zod (authored JSON content)                |
| Mobile         | Capacitor 8                                |
| Test           | Vitest (node + jsdom + chromium), Playwright|
| Lint           | Biome                                      |

No substitutions without a documented decision in
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Git conventions

### Commit messages

Conventional Commits — always:

```
feat:      new user-facing feature
fix:       bug fix
refactor:  internal restructure (no behavior change)
test:      test additions or changes
chore:     tooling, config, housekeeping
docs:      documentation only
perf:      performance improvement
ci:        CI/CD workflow changes
build:     build system changes
```

Scope is optional but encouraged: `feat(sim):`, `fix(render):`,
`test(e2e):`.

### Branch policy

- Feature branches off `main`. PR to `main`. Squash merge.
- Branch prefix: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`.
- No direct pushes to `main`.
- After every squash-merge, run `bash .claude/scripts/sync-main.sh .`
  to clean up local main + orphaned feature branch.

## Player-journey gate

A PR may not merge if any of the below fails on desktop (1280×720) OR
mobile-portrait (390×844):

1. Cold load: DOM ready and first-render frame paints under 2s from
   navigation start.
2. Start screen shows title, one-sentence tagline, primary CTA, and
   the run codename preview. All text readable; no layout shift.
3. Clicking *Begin Dive* transitions to gameplay within 600ms, no
   console errors.
4. Within 15 seconds of gameplay a cold player can identify: their
   submersible, at least one glowing creature, and one HUD readout
   that updates in real time.
5. The objective banner updates as gameplay state changes.
6. No console errors throughout the run.
7. Game-over / completion screen shows title + summary + restart CTA,
   and clicking CTA returns to the start screen within 600ms.

## Brand

- Title: **Bioluminescent Sea**
- Tagline: *"Sink into an abyssal trench. Trace glowing routes past
  landmark creatures. Surface breathing easier than when you started."*
- Palette and fonts: see `src/theme/global.css` (`@theme` block) and
  [docs/DESIGN.md](./docs/DESIGN.md).
- The run codename (adjective-adjective-noun) is a first-class brand
  surface; it appears on the landing, in the HUD, on the game-over
  screen, and in the share URL.
