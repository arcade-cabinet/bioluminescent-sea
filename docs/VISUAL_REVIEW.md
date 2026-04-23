---
title: Visual Review
updated: 2026-04-23
status: current
domain: quality
---

# Visual Review

How to capture, review, and regress visual state. Complements
[TESTING.md](./TESTING.md) — visuals are a test lane in their own
right.

## Gold-master screenshots

Stored in `docs/screenshots/` and committed to git. Two viewports:

| Slot | Desktop (1280×720) | Mobile portrait (390×844) |
| ---- | ------------------ | ------------------------- |
| landing         | `landing.desktop.png`              | `landing.mobile.png`              |
| photic-gate     | `photic-gate.desktop.png`          | `photic-gate.mobile.png`          |
| twilight-shelf  | `twilight-shelf.desktop.png`       | `twilight-shelf.mobile.png`       |
| midnight-column | `midnight-column.desktop.png`      | `midnight-column.mobile.png`      |
| abyssal-trench  | `abyssal-trench.desktop.png`       | `abyssal-trench.mobile.png`       |
| game-over       | `game-over.desktop.png`            | `game-over.mobile.png`            |

All captured against the seed `drowsy-ember-anglerfish` for
reproducibility.

## Regression pipeline

`scripts/capture-visual-fixtures.mjs` runs the Playwright visual spec,
compares against gold masters, and emits a diff summary. In CI a diff
above threshold (`0.02` SSIM) fails the visual job and uploads
`diff.png`, `actual.png`, `expected.png` as artifacts.

To accept a deliberate visual change:

```bash
pnpm run visual:export
# inspect artifacts/visual-review/; move approved frames into docs/screenshots/
git add docs/screenshots/
git commit -m "chore(visuals): update <slot> gold master"
```

## Reviewer checklist

Per PR that touches renderer, palette, HUD, or biomes:

- [ ] Gold masters re-captured for every affected slot.
- [ ] Diff explained in PR description.
- [ ] Identity check — biome tint stays within the palette; no
      foreign colors (orange, purple, pure white) leak in.
- [ ] Contrast check — HUD text remains ≥ 4.5:1 on its background.
- [ ] Safe-area check on mobile — no CTA within 16px of the viewport
      edge; no HUD element clipped by the notch or nav bar.
- [ ] Motion check — biome transition ramps 800–1400ms, never
      instantaneous, never over 2s.
