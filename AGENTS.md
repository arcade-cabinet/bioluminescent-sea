---
title: Agent Operating Protocols
updated: 2026-04-23
status: current
---

# Bioluminescent Sea — Agent Protocols

See [`CLAUDE.md`](./CLAUDE.md) for the Claude-specific version.

## Contract

Every change must:

1. Keep `pnpm typecheck` green.
2. Keep `pnpm test` green (15+ engine + lib tests).
3. Keep `pnpm build` green (bundle < 500 KB JS gzipped at least until
   we add audio).
4. Preserve zero console errors on desktop + mobile-portrait playthrough.
5. Preserve the player-journey gate (§12 of the cabinet's
   `docs/unconsolidation/PARITY_CHECKLIST.md`, excerpted into
   [`STANDARDS.md`](./STANDARDS.md)).

## Testing lanes

| Lane | Config | What it proves |
| ---- | ------ | -------------- |
| `pnpm test:node`    | `vitest.config.ts`    | engine, lib, pure TS logic |
| `pnpm test:dom`     | `vitest.dom.config.ts`| jsdom-level component tests |
| `pnpm test:browser` | `vitest.browser.config.ts` | real-Chromium canvas tests |
| `pnpm test:e2e`     | `playwright.config.ts` | full user journeys |

Any new feature that changes canvas output should add at least one
`*.browser.test.tsx` that captures a before/after screenshot.

## Commit conventions

Conventional Commits. Types: `feat`, `fix`, `chore`, `docs`, `refactor`,
`perf`, `test`, `ci`, `build`. release-please reads these to build the
changelog.

## Dependencies

Weekly dependabot, minor+patch grouped. Do NOT upgrade major versions
without a manual compat pass (framer-motion, three peers, capacitor are
the sensitive ones).
