---
title: Design
updated: 2026-04-24
status: current
domain: product
---

# Design

## Identity

*Bioluminescent Sea* is an **open-world underwater roguelike**. The player pilots a submarine down through the ocean's real depth zones — sunlight, twilight, midnight, abyss, and hadal — collecting bioluminescent creatures and dodging predators. Almost everything visible is alive; almost everything alive glows.

The progression model collects "Lux" (a bioluminescence-based score) to purchase persistent upgrades in the Drydock, extending each dive deeper. The deepest zone, the Hadal, contains the rarest creatures — and the largest predators.

## Depth zones

Five real oceanographic depth zones, surface to seafloor. Each carries distinct creature and predator archetypes, ambient palette, and water character. The deepest zone (hadopelagic) extends to ~11000 m — the floor of every known ocean. Authored in `config/raw/biomes/*.json`.

| Zone | ID | Range | Light | Defining ecology |
|------|------|------|------|------|
| Sunlight Zone | epipelagic | 0–500 m | sunlit | kelp, sardines, jellyfish, barracuda |
| Twilight Zone | mesopelagic | 500–1500 m | fading blue | lanternfish, hatchetfish, marine snow, swordfish |
| Midnight Zone | bathypelagic | 1500–3000 m | bioluminescence only | anglerfish, gulpers, viperfish, giant squid |
| The Abyss | abyssopelagic | 3000–5000 m | rare bioluminescence | dumbo octopus, deep jellyfish, chimaera, isopods |
| The Hadal | hadopelagic | 5000–11000+ m | vent glow | hadal snailfish, supergiant amphipods, alien-deep predators |

Each zone's `ecology` block authored in JSON drives actor archetype selection at chunk-spawn time. Adding a new collectible/predator means adding an actor archetype tagged for the relevant zone(s) — no engine branches.

### Seafloor symmetry

The seafloor mirrors the surface. At the deepest authored zone the depth counter pins at `OCEAN_FLOOR_METERS` (11000 m) and lateral movement continues — the player keeps drifting, dodging, collecting, scoring. The world doesn't end at the bottom, it just stops descending. This is governed by the `seafloorBehavior` slot on each mode:

- **`free-roam`** (Exploration, Arena): clamp depth at the floor; the bottom is a place to be, not an end. Score keeps climbing from creature pickups.
- **`win`** (Descent): reaching the floor counts as completing the dive. Today Descent ends on its own seed-derived `targetDepthMeters` first, so the win-on-floor branch is the contract for any future "all the way to Challenger Deep" mode.

## Dive modes

Three modes — **Exploration**, **Descent**, **Arena** — compose from the same slot system in `src/sim/factories/dive/slots.ts`. Each reads as a distinct *way* to be in the trench, not just a difficulty dial.

| Mode        | Lateral | Vertical | Collision rule   | Completion   | Feel                                                                        |
| ----------- | ------- | -------- | ---------------- | ------------ | --------------------------------------------------------------------------- |
| Exploration | free    | free     | oxygen penalty   | infinite     | Take your time. Drift past glowing creatures, dodge predators, go as deep as you want. |
| Descent     | locked  | free     | oxygen penalty   | depth-goal   | The sub falls automatically — you only steer left or right. See how deep you can go. |
| Arena       | free    | free     | **ends the dive**| infinite     | Locked into one room at a time. Clear out the predators to advance. One hit and you're out. |

Arena's clear-to-advance behaviour lives on the **chunk archetype** (`travel: "locked-room"` in `src/sim/factories/chunk/slots.ts`), not the dive slot. The dive is infinite — the only way out is a collision.

Adding a fourth mode is one record in `MODE_SLOTS` plus one `SessionModeMetadata` entry in `sessionMode.ts`. No renderer, sim, or HUD branches move.

## Player journey

1. **Land.** The title card reads "Bioluminescent Sea" in Cormorant Garamond mint-on-navy, subtitle *"Pilot a submarine into the deep ocean. Collect glowing creatures, dodge predators, and see how far down you can go."* Three mode cards (Exploration / Descent / Arena) are the primary surface; a Drydock chip in the corner shows the current Lux balance.
2. **Pick a mode, choose a dive.** Tapping a mode card opens a centered Radix dialog over the still-visible landing — the ocean is behind the paper. The dialog defaults to the day's Daily codename; the player can reroll or type a three-word codename of their own.
3. **Descend.** The submersible is centered. The world dynamically chunks and spawns entities through the actor factory; the `epipelagic` (Sunlight Zone) descends into the `mesopelagic` (Twilight), the `bathypelagic` (Midnight), the `abyssopelagic` (Abyss), and finally the open-ended `hadopelagic` (Hadal). God rays attenuate, caustics fade, and atmospheric desaturation deepens as the sub drops — the water gets literally heavier.
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

1. **God rays** via `GodrayFilter` (pixi-filters). Volumetric-looking shafts that fade out past the twilight zone — surface light doesn't reach the abyss. Stronger at 0m, invisible by 600m.
2. **Procedural caustics**. A coarse grid of thresholded noise peaks, tinted to the current biome's glow, additively blended. Cheap, cheap, cheap — no shader compile — but gives the characteristic filamentous brightness that marine snow alone can't. Fades between 300m and 900m so it reads as "surface light hitting the column" and dies with depth.
3. **Atmospheric desaturation** via `AdjustmentFilter`. Saturation and gamma ride down as depth grows. Models how colour fades underwater — by the Hadal Zone, everything neutralises toward the mint glow.

These sit on top of the backdrop gradient and under the marine-snow parallax. The snow itself drifts on a curl-noise-feel field (orthogonal sinusoids + seed offset) so neighbours flow in related-but-not-identical paths — the subtle "fluid" read, not straight-down dust.

Reference: [Evan Wallace — Realtime Caustics in WebGL](https://medium.com/@evanwallace/rendering-realtime-caustics-in-webgl-2a99a29a0b2c), [Bridson — Curl Noise for Procedural Fluid Flow (SIGGRAPH 2007)](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf), [Volumetric Light Scattering as a Post-Process (GPU Gems 3)](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process).

## Future work

- Three additional creature archetypes (chain siphonophore, anglerfish lure, kelp-hugger) to expand the mid-run surprise palette.
- Global leaderboards for Max Depth Reached by Seed.
- Per-mode `@vitest/browser` tests that mount `<Game>` and drive a GOAP bot through real PixiJS frames.
