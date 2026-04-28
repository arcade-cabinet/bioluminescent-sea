---
title: Visual Assessment — Iteration 1
updated: 2026-04-27
status: current
domain: quality
---

# Visual Assessment — Iteration 1 (post-taxonomy)

Real, eyes-on-image review of the screenshots in this folder.
Earlier passes captured but did not assess. Findings below are
ordered by severity.

## Findings

### CRITICAL — Shallow-water dive render is washed out

**File**: `03-dive-epipelagic.png`

At depth 52 m (deep inside epipelagic / Sunlight Zone) the entire
center of the viewport reads as a near-white pink wash. No water
tint, no sub, no creatures, no ambient scenery. The HUD is fully
populated and correct (depth, biome, codename, objective banner,
oxygen counter), but the canvas underneath is overexposed.

Suspected cause: `src/render/layers/water.ts` — at near-surface
depths the GodrayFilter gain is at peak (`0.22 * depthFade`) AND
the surfaceRect alpha contribution AND the AdjustmentFilter at
full saturation/brightness compound. The center is brighter than
the edges (which carry the red-O₂ vignette tint), which is
inverted from what the depth-tint logic should produce.

Expected: at 52 m the scene should read as a deep teal-navy with
bright god rays slanting through kelp ribbons and sardines. The
god rays are the *light source*, not the *whole scene*.

**Action**: clamp the cumulative shallow-water filter brightness
or attenuate the surfaceRect alpha further at very shallow depth.
Easiest first cut: cap the GodrayFilter gain at 0.18 and lower the
surfaceRect alpha multiplier from 0.055 → 0.03.

### MEDIUM — Mode card carousel arrows are low-contrast

**File**: `01-landing-postsymmetry.png`

The right-arrow `>` to advance the carousel is barely visible
against the ocean backdrop. New players will not realize there
are three modes. The pagination dots at the bottom (`▽` row) are
also too dim — only one visible in the screenshot.

**Action**: bump the arrow + pagination dots to higher contrast
(white/glow tone instead of muted-fg) and add a subtle hint that
there's a next card (e.g., a faint silhouette of the next card's
edge bleeding in from the right).

### MEDIUM — TODAY'S CHART vs REROLL have ambiguous affordance

**File**: `07-seedpicker-newcopy.png`

Both options render with the same visual weight (kicker label
with a small dot/x glyph) but they're functionally different —
TODAY'S CHART is a *toggle to use the daily seed*, REROLL is an
*action button that spins a new random codename*. Identical
visual treatment makes the affordance unclear.

**Action**: make TODAY'S CHART a checkbox-style toggle (on/off
state) and REROLL a clearly-tappable action button. Or just pick
unambiguous icons (⊙ filled-when-active for toggle; ↻ for
reroll).

### LOW — Mobile DRYDOCK chip too close to safe-area edge

**File**: `02-landing-mobile.png`

The "DRYDOCK 0 LUX" label sits at the very top-right pixel of
the viewport. On phones with rounded corners or notches it'll
clip.

**Action**: pad the landing-screen header by 12 px on mobile
breakpoints.

### LOW — Drydock "Engine thrusters LVL 0/5" looks like an active row

**File**: `03-drydock-desktop-full.png`

Engine thrusters at level 0 has the same icon brightness as the
purchased Hull plating (LVL 2/5). A level-0 row should feel
slightly ghosted so the player can tell at a glance which
upgrades they've already invested in.

**Action**: drop icon opacity to ~60% when level === 0, leave
100% otherwise.

### NOTE — Best Score = 0 with 23 dives logged

**File**: `03-drydock-desktop-full.png`

The lifetime band shows `DIVES 23 LIFETIME LUX 47200 BEST SCORE 0
DEEPEST 0m`. If 23 dives have happened, best score and deepest
should both be > 0.

This is likely a fixture/test state, but worth confirming the
PersonalBests writer is actually persisting score + depth on dive
end, not just lifetime Lux.

**Action**: add an integration test that asserts `bests.score >
0` and `bests.depthMeters > 0` after a single completed dive that
collected at least one creature.

## Copy progression — verified resolved

The iteration-0 → iteration-1 progression on landing-screen copy
is clean:

- iteration-0/01: `"Sink into an abyssal trench. Trace glowing
  routes past landmark creatures. Surface breathing easier than
  when you started."` — lore-jargon.
- iteration-0/05: `"Pilot a submarine deep into a glowing ocean
  trench. Collect creatures, dodge predators, and chart the
  route back up."` — partial fix, still says "trench".
- iteration-1/01: `"Pilot a submarine into the deep ocean.
  Collect glowing creatures, dodge predators, and see how far
  down you can go."` — final, plain English.

Mode card subtitle progression:

- iteration-0: `"Glide the photic shelf in your sub. Chart the
  reef at your own pace."` — lore-jargon.
- iteration-1: `"Take your time. Collect glowing creatures,
  avoid predators, go deep."` — plain English.

The seed-picker description in iteration-0/07 is already in the
plain-English voice. No copy regressions across the iterations.
