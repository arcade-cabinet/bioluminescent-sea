---
title: Design
updated: 2026-04-23
status: current
domain: product
---

# Design

## Identity

*Bioluminescent Sea* is an **open-world underwater roguelike**. The player descends into an infinite, procedurally generated abyss where almost nothing is visible, and everything they can see is alive. The game balances slow observation with high-stakes survival. 

The progression model relies on collecting "Lux" (bioluminescence score) to purchase persistent upgrades in the Drydock, enabling deeper and deeper plunges into the terrifying Stygian Abyss, populated by massive Leviathans and dynamic power-up Anomalies.

## Player journey

1. **Land.** The title card reads "Bioluminescent Sea" in Cormorant Garamond mint-on-navy. Subtitle: *"Sink into an abyssal trench. Collect the light of a living map before your oxygen runs out."*
2. **Chart Route.** The player selects "New Dive" and enters the Customization modal. Here, they can dictate the procedural seed of the run by typing an Adjective-Adjective-Noun codename, or roll a Daily dive.
3. **Upgrade.** The "Drydock" screen allows the player to spend their accumulated Lux to upgrade Hull Plating, Battery Capacity, Engine Thrusters, and their Halogen Lamp.
4. **Descend.** The submersible is centered. The world dynamically chunks and spawns entities infinitely downwards. The `photic-gate` descends into the `twilight-shelf`, then the `midnight-column`, the `abyssal-trench`, and eventually the infinite `stygian-abyss`.
5. **Collect.** Approaching glowing creatures collects them for Lux. Approaching glowing Anomalies grants Overdrive or Repel buffs.
6. **Avoid.** Yuka-driven Predators stalk and dash. Pirates wander. Deep below, Leviathans command massive chunks of the screen. Collisions deduct oxygen.
7. **Surface.** When oxygen reaches zero, the sub surfaces to a "Dive Logged" screen showing the final score, which is deposited as Lux.

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

- Room-clearing "Bullet Hell" Challenge Mode.
- Three additional creature archetypes (chain siphonophore, anglerfish lure, kelp-hugger) to expand the mid-run surprise palette.
- Global leaderboards for Max Depth Reached by Seed.
