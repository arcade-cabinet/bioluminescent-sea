---
title: Iteration-2 Screenshots
updated: 2026-04-28
status: current
domain: quality
---

# Iteration-2 Screenshots

Capture set produced by `e2e/capture-iteration-2.spec.ts`. Eyes-on
assessment lives in `ASSESSMENT.md` once the next loop iteration
writes it.

## What's captured

| File | Scene |
|---|---|
| `01-landing-{project}.png` | Landing on first paint. |
| `02-carousel-exploration-{project}.png` | Carousel with the Exploration card centred. |
| `03-carousel-descent-{project}.png` | Carousel after one **Next** — Descent card centred. |
| `04-seedpicker-today-{project}.png` | Seed picker with **Today's Chart** active (filled check + ring). |
| `05-seedpicker-rerolled-{project}.png` | Seed picker after **Reroll** — Today's-Chart now inactive. |
| `06-drydock-{project}.png` | Drydock screen, full page. |

`{project}` is `desktop` (1280×720) or `mobile-portrait` (390×844).

## Refresh

```bash
pnpm build  # capture runs against the vite preview
pnpm exec playwright test e2e/capture-iteration-2.spec.ts \
  --project desktop --project mobile-portrait
```

The spec contains no assertions — it's pure capture. A failure in
this file never blocks CI.

## What's not yet captured

The original iteration-2 ask included per-zone in-dive captures
and a drydock with mixed upgrade levels. Those need fixture state
plumbing (depth seeding + upgrade-state injection) and were
deferred to a follow-up iteration so this spec stays small and
shippable.
