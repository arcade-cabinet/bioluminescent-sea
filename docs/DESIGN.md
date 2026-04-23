---
title: Design
updated: 2026-04-23
status: current
domain: product
---

# Design

## Identity

*Bioluminescent Sea* is not an action game. It is a **deliberate
meditation on scale**. The player spends 60–180 seconds sinking into a
trench where almost nothing is visible, and everything they can see is
alive. The game rewards slow observation, not twitch. It fails the
player if they stop paying attention to oxygen, but even the failure
mode is gentle — the sub surfaces with a "Dive Logged" screen rather
than a crash or explosion.

## Player journey

1. **Land.** The title card reads "Bioluminescent Sea" in Cormorant
   Garamond mint-on-navy. Subtitle: *"Sink into an abyssal trench.
   Trace glowing routes past landmark creatures. Surface breathing
   easier than when you started."* Three mode chips (cozy / standard /
   challenge). One primary CTA: "Begin Dive."
2. **Descend.** The player sees their submersible centered in the
   scene. A headlamp cone and sonar pulse reach outward. Glowing
   jellyfish bloom in the foreground. A route-landmark chip in the
   top-right names the nearest labeled feature (Kelp Gate, Anemone
   Ring, Thermal Vent…). The bottom banner tells them what to do
   right now.
3. **Collect.** Approaching a glowing creature collects it — +score,
   +chain multiplier. The banner updates with fresh intent.
4. **Avoid.** Predator silhouettes and pirate lantern cones apply
   hull shock (oxygen penalty). The banner warns before the impact.
5. **Surface.** When oxygen reaches zero, the sub surfaces to a
   "Dive Logged" screen showing the final score, best score, and a
   "Dive Again" CTA.

## Palette rationale

- `#050a14` near-black navy — the void outside the sub. Sets the
  tone of solitude and scale.
- `#0a1a2e` abyssal navy — one step up; used for HUD surfaces so
  the chrome feels like it's carved out of the same water.
- `#0e4f55` deep teal — mid-water glow, UI strokes. This is the
  color your eyes adjust to after the opening seconds.
- `#6be6c1` bioluminescent mint — the only color that "glows." Used
  exclusively for the things the player cares about: creatures, the
  primary CTA, stat labels, and highlight effects. Anywhere this
  color appears, the player should be drawn to look.
- `#d9f2ec` pale sea-mist — body text and numeric readouts.
  Deliberately not pure white; the world should not feel backlit by
  surface daylight.
- `#ff6b6b` warn red — used sparingly: low-oxygen pulse, threat flash.
  Red is the only color in the game that breaks the blue-green tonal
  palette, so it reads as an intrusion.

## Fontography rationale

**Cormorant Garamond** (display): a late-19th-century serif revival
with liquid, almost-dripping terminals and swashy italics. Sits
perfectly on top of an abyssal scene — the letterforms have the same
slow, underwater sway as the jellyfish bells. Used for title, game-
over heading.

**Inter** (body + HUD): high x-height, tabular-figures numerals,
legible at 12px against the deep teal-navy gradient. The game's HUD
needs to be instantly readable even when the player is focused on
the scene; Inter does that without calling attention to itself.

Both fallbacks are to system fonts to avoid FOIT on slow networks —
the landing gracefully degrades to Palatino / system-UI rather than
showing nothing.

## Future work

- Audio layer (ambient abyss drones, creature chimes on collection,
  impact thud). Tone.js or pure Web Audio API; stay under 200 KB.
- Daily route seed so players can compare runs on the same trench.
- Three additional creature archetypes (chain siphonophore, anglerfish
  lure, kelp-hugger) to expand the mid-run surprise palette.
- Portrait-locked mobile option in capacitor config for better thumb
  ergonomics (currently landscape-friendly by default).
