---
title: Design
updated: 2026-04-24
status: current
domain: product
---

# Design

## Identity

*Bioluminescent Sea* is an **open-world underwater roguelike**. The player descends into an infinite, procedurally generated abyss where almost nothing is visible, and everything they can see is alive. The game balances slow observation with high-stakes survival.

The progression model relies on collecting "Lux" (bioluminescence score) to purchase persistent upgrades in the Drydock, enabling deeper and deeper plunges into the terrifying Stygian Abyss, populated by massive Leviathans and dynamic power-up Anomalies.

## Dive modes

Three modes — **Exploration**, **Descent**, **Arena** — compose from the same slot system in `src/sim/dive/modeSlots.ts`. Each reads as a distinct *way* to be in the trench, not just a difficulty dial.

| Mode        | Vertical   | Collision rule   | Completion     | Feel                                                                              |
| ----------- | ---------- | ---------------- | -------------- | --------------------------------------------------------------------------------- |
| Exploration | free       | oxygen penalty   | infinite       | Drift the photic shelf. No deadlines, soft threats, oxygen to burn.               |
| Descent     | forced     | oxygen penalty   | infinite       | The classic dive. Gravity pulls you down, beacons mark the route, oxygen ticks.   |
| Arena       | free       | **ends the dive**| clear-room     | Bullet-hell at a fixed depth. Clear the chunk or die; advance, repeat, intensify. |

Adding a fourth mode is one record in `MODE_SLOTS` plus one `SessionModeMetadata` entry in `sessionMode.ts`. No renderer, sim, or HUD branches move.

## Player journey

1. **Land.** The title card reads "Bioluminescent Sea" in Cormorant Garamond mint-on-navy, subtitle *"Sink into an abyssal trench. Trace glowing routes past landmark creatures. Surface breathing easier than when you started."* Three mode cards (Exploration / Descent / Arena) are the primary surface; a Drydock chip in the corner shows the current Lux balance.
2. **Pick a mode, chart a route.** Tapping a mode card opens a centered Radix dialog over the still-visible landing — the trench is behind the paper. The dialog defaults to the day's Daily seed; the player can reroll or type a three-word codename.
3. **Descend.** The submersible is centered. The world dynamically chunks and spawns entities through the actor factory; the `photic-gate` descends into the `twilight-shelf`, the `midnight-column`, the `abyssal-trench`, and eventually the infinite `stygian-abyss`. God rays attenuate, caustics fade, and atmospheric desaturation deepens as the sub drops — the water gets literally heavier.
4. **Collect.** Approaching glowing creatures collects them for Lux. Approaching glowing Anomalies grants Overdrive or Repel buffs.
5. **Avoid.** Yuka-driven Predators stalk and dash. Pirates wander. Enemy subs hunt. Deep below, Leviathans command massive chunks of the screen. Collision behaviour depends on the mode's slot.
6. **Surface.** When oxygen reaches zero (or the dive fails via collision in Arena), the sub surfaces to a "Dive Logged" screen showing Score / Best / Depth / Lux earned. Lux is deposited immediately; the landing's Drydock chip updates.
7. **Upgrade.** The Drydock screen lets the player spend Lux on Hull Plating, Battery Capacity, Engine Thrusters, and Halogen Lamp. Each upgrade feeds directly into the mode tuning next dive.

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

## Fluidic space rationale

Early builds of the scene read as "shapes on navy" — the backdrop was flat, the marine-snow alone couldn't carry the water. The fluidic layer (`src/render/layers/water.ts`) stacks three cues that together sell the water as *water*:

1. **God rays** via `GodrayFilter` (pixi-filters). Volumetric-looking shafts that fade out past the twilight shelf — surface light doesn't reach the abyss. Stronger at 0m, invisible by 600m.
2. **Procedural caustics**. A coarse grid of thresholded noise peaks, tinted to the current biome's glow, additively blended. Cheap, cheap, cheap — no shader compile — but gives the characteristic filamentous brightness that marine snow alone can't. Fades between 300m and 900m so it reads as "surface light hitting the column" and dies with depth.
3. **Atmospheric desaturation** via `AdjustmentFilter`. Saturation and gamma ride down as depth grows. Models how colour fades underwater — by the Stygian Abyss, everything neutralises toward the mint glow.

These sit on top of the backdrop gradient and under the marine-snow parallax. The snow itself drifts on a curl-noise-feel field (orthogonal sinusoids + seed offset) so neighbours flow in related-but-not-identical paths — the subtle "fluid" read, not straight-down dust.

Reference: [Evan Wallace — Realtime Caustics in WebGL](https://medium.com/@evanwallace/rendering-realtime-caustics-in-webgl-2a99a29a0b2c), [Bridson — Curl Noise for Procedural Fluid Flow (SIGGRAPH 2007)](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf), [Volumetric Light Scattering as a Post-Process (GPU Gems 3)](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process).

## Future work

- Three additional creature archetypes (chain siphonophore, anglerfish lure, kelp-hugger) to expand the mid-run surprise palette.
- Global leaderboards for Max Depth Reached by Seed.
- Per-mode `@vitest/browser` tests that mount `<Game>` and drive a GOAP bot through real PixiJS frames.
