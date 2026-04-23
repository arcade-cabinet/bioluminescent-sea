---
title: Bioluminescent Sea
updated: 2026-04-23
status: current
---

# Bioluminescent Sea

> Sink into an abyssal trench. Trace glowing routes past landmark creatures.
> Surface breathing easier than when you started.

A meditative canvas-rendered ocean-dive explorer. You pilot a small
submersible through a deep-sea column where everything you can see either
glows, or eats things that glow. Your only objective is to collect bio-
luminescence chains before oxygen runs out — and the trench communicates
what it wants via a single dynamic banner at the bottom of the screen.

Built with React 19 + Vite + Capacitor. Runs in any modern browser,
packages as a debug APK for Android, and has a portrait-friendly
touch/joystick input path.

## Quick start

```bash
pnpm install
pnpm dev        # Vite dev server — http://localhost:5173
pnpm test       # node-mode unit tests (engine + Perlin lib)
pnpm test:dom   # jsdom tests for presentational components
pnpm test:browser # real-Chromium canvas tests via @vitest/browser-playwright
pnpm test:e2e   # Playwright end-to-end
pnpm build      # production bundle → dist/
pnpm preview    # serve dist/
pnpm cap:sync   # copy dist/ into android/ and ios/
```

## Documentation

The docs tree is the source of truth for design, architecture, and
operations. Start at `docs/ARCHITECTURE.md` or `docs/DESIGN.md`.

| File                          | Domain     |
| ----------------------------- | ---------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | technical  |
| [docs/DESIGN.md](docs/DESIGN.md)             | product    |
| [docs/TESTING.md](docs/TESTING.md)           | quality    |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)     | ops        |
| [docs/STATE.md](docs/STATE.md)               | context    |
| [docs/RELEASE.md](docs/RELEASE.md)           | ops        |
| [AGENTS.md](AGENTS.md)                       | agent entry  |
| [CLAUDE.md](CLAUDE.md)                       | Claude entry |
| [STANDARDS.md](STANDARDS.md)                 | quality  |
| [CHANGELOG.md](CHANGELOG.md)                 | release-please |

## License

MIT. See [LICENSE](LICENSE).
