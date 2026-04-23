---
title: State
updated: 2026-04-23
status: in-progress
domain: context
---

# State

## Current baseline

Initial cut extracted from `jbcom/arcade-cabinet` on 2026-04-23.
Canvas rendering is live: backdrop, ridges, coral, creatures, player
sub, sonar ping, predators, pirates, light shafts. HUD is identity-
forward: stat row, landmark chip, dynamic objective banner. Low-
oxygen pulse + threat flash wired.

- Node + dom tests: 15 passing.
- Typecheck clean, build clean at 343 KB JS + 14 KB CSS + 6 font
  files.
- Headless Chromium verified at 1280×800 and 390×844 portrait:
  landing → playing → HUD updates → zero console errors.

## Remaining before 1.0

| Area | Status | Next step |
| ---- | ------ | --------- |
| Audio | not started | Ambient abyss drone + creature chimes (Web Audio API, no Tone.js dep) |
| Icons | placeholder | Generate mint-jellyfish SVG favicon + Android icon pack |
| Landing hero | placeholder | Commission / generate hero art for the title card |
| E2E test | not started | Playwright journey spec (landing → 5s dive → menu) |
| Android APK | not verified | `pnpm cap:sync && ./gradlew assembleDebug` in CI |
| GitHub Pages | not deployed | First release-please tag will trigger it |
| Portrait lock | not locked | Optional; add to capacitor.config for mobile-first feel |
| Daily seed | not in engine | Add `?seed=<YYYYMMDD>` query-param for shared routes |

## Known bugs / quirks

None reported yet in this repo's life. If you find one, log it here
with a date.

## Decisions log

- 2026-04-23: Chose to drop Tailwind from the extraction despite
  cabinet code using it extensively. Identity is better served by
  CSS vars + inline styles; Tailwind adds 30+ KB and its generic
  utility classes were diluting the bioluminescent palette story.
  Consequence: the HUD block was rewritten from scratch (~270 LOC
  in `src/ui/hud/HUD.tsx`).
- 2026-04-23: Dropped cabinet-runtime save-slot API in favor of
  `localStorage["bioluminescent-sea:v1:save"]` + `…:best-score`.
  Simpler, no cross-game assumptions, works offline on Android.
