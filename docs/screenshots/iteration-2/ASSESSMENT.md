---
title: Iteration-2 Visual Assessment
updated: 2026-04-28
status: current
domain: quality
---

# Iteration-2 Visual Assessment

Eyes-on review of the 12 captures produced by
`e2e/capture-iteration-2.spec.ts`. Findings are severity-ordered;
each one becomes a follow-up queue item.

## Methodology

Looked at every PNG against the design north star:

> A cold player must understand the goal within 15 seconds of
> landing. Mobile and desktop both ship the same product — neither
> gets a downgraded version of any screen.

Surface area covered: landing (incl. carousel state), seed picker
(today + reroll), drydock empty state. In-dive zone captures and
mixed-upgrade drydock are still deferred (need fixture-state
plumbing per the README).

## Findings

### CRITICAL — mobile carousel clips mode-card body copy

**File**: `02-carousel-exploration-mobile-portrait.png`,
`03-carousel-descent-mobile-portrait.png`.

The mode-card tagline gets visibly truncated at the right edge on
mobile. The Exploration card shows
*"Take your time. Collect glowing creatures, avo… predators, go
deep."* — the word "avoid" is sliced after `avo`. The Descent card
is worse: *"k straight down. Steer left and right. See h…"* —
both ends are clipped because the carousel chevrons overlap the
card body, not just the gutters.

Two distinct problems:

1. The card itself is wider than its viewport allotment so the
   tagline overflows the right edge.
2. The pagination chevrons (`carousel-prev` / `carousel-next`)
   are rendered *over* the card on narrow screens, eating ~40px
   on each side.

This is a comprehension breaker — a cold player can't read what
each mode does. **CRITICAL.**

Likely fix lives in `src/ui/screens/LandingScreen.tsx` (carousel
gutters / max-width) and `src/ui/primitives/Carousel.tsx` (chevron
positioning at `<sm` breakpoint — push them outside the card or
swap to dot-only nav under 480px).

### HIGH — DRYDOCK chip overlaps title on mobile portrait

**File**: `01-landing-mobile-portrait.png`,
`02-carousel-exploration-mobile-portrait.png`.

The "DRYDOCK 0 LUX" chip in the top-right corner sits flush
against the wrapped title:

```
BIOLUMINESCENT  DRYDOCK 0 LUX  ← chip clipping into "CENT"
        SEA
```

PR #247 added safe-area padding to the chip but didn't add room
on the *title's* side — when the title wraps to two lines under
~430px, the first line's right edge collides with the chip.

Fix is straightforward: give the title `padding-right` ≥ chip
width on `<sm` breakpoint, or move the chip to a separate row
below the safe-area inset.

### MEDIUM — mode-card on phone: title block dominates the fold

**File**: `01-landing-mobile-portrait.png`.

On mobile-portrait the "BIOLUMINESCENT SEA" title + tagline
consume the top 35 % of the viewport before the carousel even
starts; the active mode card ends up pinned to the bottom edge
with its CTA partially below the fold of cards. A cold player
sees a pretty title and one mode card whose tagline is clipped
(see CRITICAL above). The triptych — the whole reason the
carousel exists — is invisible until they swipe.

Considered: shrink the title block on `<sm` (smaller `Cormorant
Garamond` size, drop tagline below the carousel rather than above,
or move tagline into the card itself).

### MEDIUM — drydock upgrade-cost chips read as warnings

**File**: `06-drydock-mobile-portrait.png`,
`06-drydock-desktop.png`.

Every "500 Lux" cost chip on level-0 upgrades renders in
`--color-warn` red, regardless of whether the player can afford
it. In a palette where red specifically signals threat / low
oxygen, a row of red chips on a benign workshop screen is a
false alarm — the player's first read is "something's wrong"
when the actual meaning is "this costs Lux."

Fix: cost chips should default to mint (`--color-glow`) and only
flip to warn when `playerLux < cost`.

### MEDIUM — pagination dots invisible against parallax canvas

**File**: `02-carousel-exploration-mobile-portrait.png` (bottom
edge — three dots are barely visible against the LandingHero
canvas).

PR #243 fixed the *chevron* contrast but the pagination dots are
still `bg-fg/55` against a busy canvas. On the mobile capture the
dots almost disappear — a cold player has no signal that there
are three modes available.

Fix: bump dot ring opacity, or add a subtle backdrop pill behind
the dot row (the chevrons got this treatment).

### LOW — desktop carousel: only the centred card is dimensional

**File**: `02-carousel-exploration-desktop.png`,
`03-carousel-descent-desktop.png`.

On desktop the carousel only shows one card at a time — the
Cormorant title is gorgeous, but you have no peripheral cue that
two more cards exist. Considered: render the adjacent cards as
ghost previews at the gutters (15-20 % opacity, scaled 0.85),
similar to a coverflow. Not blocking — the chevrons + dots
already communicate it — but a peek at the next card is more
tactile than a glyph.

### LOW — seedpicker desktop wastes ~50 % of vertical space

**File**: `04-seedpicker-today-desktop.png`,
`05-seedpicker-rerolled-desktop.png`.

The seed picker overlay on desktop floats in a centred card but
the card is sized for mobile copy; on desktop there's a huge
empty band of dimmed page above and below. The codename and
blurb both have room to breathe more — could use the space for a
thumbnail of the seed's biome banner, or a depth-vs-time
preview, or just expand typography.

Out of scope for a *fix* — call this a "nice-to-have" once the
critical/high items land.

### NOTE — Today's-Chart vs Reroll affordance reads correctly post-#245

**File**: `04-seedpicker-today-{desktop,mobile-portrait}.png`,
`05-seedpicker-rerolled-{desktop,mobile-portrait}.png`.

Sanity-check: the active-state distinction PR #245 added is
visible in the captures — Today's-Chart on the today screen has
the filled Check + ring, and on the rerolled screen it switches
to the Sparkles glyph + neutral border. The fix landed; no
follow-up needed.

### NOTE — landing tagline + 5-zone copy is current

**File**: `01-landing-{desktop,mobile-portrait}.png`,
`04-seedpicker-today-desktop.png`.

PR #265's copy fix shipped: "Pilot a submarine into the deep
ocean" appears under the title; the seed-picker blurb references
"chart" / "halocline" terminology rather than legacy
"trench/abyssal" jargon. No follow-up needed.

## Suggested queue order

1. **CRITICAL** — mobile carousel card-body clipping +
   chevron overlap.
2. **HIGH** — DRYDOCK chip vs wrapped title collision.
3. **MEDIUM** — drydock cost chips defaulting to warn-red.
4. **MEDIUM** — pagination-dot contrast on busy canvas.
5. **MEDIUM** — mobile title-block fold cost.
6. **LOW** — desktop carousel peek of adjacent cards.
7. **LOW** — desktop seedpicker vertical space.

The first two are comprehension blockers on the most-trafficked
viewport. Everything below MEDIUM is polish that improves but
does not break the journey.

## Deferred from this iteration

The original iteration-2 ask included per-zone in-dive captures
and a drydock with mixed upgrade levels. Those still need fixture
state plumbing (depth seeding + upgrade-state injection) and are
parked for a follow-up iteration so this assessment focuses on
the surface area we *can* see today.
