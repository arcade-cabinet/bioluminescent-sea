---
title: Rules
updated: 2026-04-23
status: current
domain: product
---

# Rules

This document owns gameplay mechanics. Identity / feel lives in
[DESIGN.md](./DESIGN.md); technical implementation is in
[ARCHITECTURE.md](./ARCHITECTURE.md).

## The loop

One run is a single dive. The player pilots a submersible downward
through the trench, collecting bioluminescent creatures while avoiding
predators and pirate lantern cones, until one of:

- **Success.** The sub reaches the target depth (default 3200m).
- **Ascent.** Oxygen hits zero before the target depth; the sub
  surfaces with a partial chart.
- **Failure (challenge mode only).** A predator collides with the sub.

Target run length: 60–180 seconds.

## Oxygen

Oxygen is the timer. It starts at the mode's `durationSeconds` value
and ticks down in real time. Collecting a creature adds seconds back;
impacts subtract seconds.

| Mode      | Start | Impact penalty | Impact grace | Collision ends |
| --------- | ----- | -------------- | ------------ | -------------- |
| cozy      | 780s  | 25s            | 5s           | no             |
| standard  | 600s  | 45s            | 4s           | no             |
| challenge | 480s  | 0              | 0            | yes            |

## Collection

Each creature type gives a fixed score + oxygen bonus:

| Type       | Score | Oxygen bonus |
| ---------- | ----- | ------------ |
| plankton   | 10    | 4s           |
| jellyfish  | 30    | 8s           |
| fish       | 50    | 6s           |

A 2-second streak window turns consecutive collects into a chain
multiplier, capped at 5×. Missing the window resets to 1×.

## Threats

| Threat         | Behavior                                 | Hit effect                     |
| -------------- | ---------------------------------------- | ------------------------------ |
| angler         | Slow seek when within 150m of player     | Oxygen penalty (mode-specific) |
| eel            | Fast seek; shorter engagement radius     | Oxygen penalty                 |
| pirate lantern | Patrols a route; cone-of-sight detection | Oxygen penalty                 |

Pirates are biome-gated: they only spawn in the twilight shelf and
below. Anglers spawn from the twilight shelf onward; eels appear in the
midnight column and below.

## Depth and biomes

Depth is a spatial fact. The dive starts at `y = 0` (surface) and the
target is `y = 3200` (inside the abyssal trench). Four biomes:

| Biome            | Depth (m)       | Character                             |
| ---------------- | --------------- | ------------------------------------- |
| Photic Gate      | 0 – 400         | Plankton drift; intro; no threats     |
| Twilight Shelf   | 400 – 1200      | First anglers; first pirate lanterns  |
| Midnight Column  | 1200 – 2400     | Peak density; anglers + eels          |
| Abyssal Trench   | 2400 – 3600+    | Sparse, pirate-heavy, target zone     |

Biome transitions fire a banner update and a brief full-viewport tint
ramp (~1.2s). The biome tint is 10% toward the biome color over the
base palette — strong enough to read, weak enough to keep identity.

## Landmarks

Landmarks are authored depth-keyed anchors (see `config/raw/landmarks/`)
that feed the HUD's route chip:

| Landmark             | Biome             | Depth |
| -------------------- | ----------------- | ----- |
| Kelp Gate            | Photic Gate       | 200m  |
| Lantern Shelf        | Twilight Shelf    | 700m  |
| Whale-Fall Windows   | Twilight Shelf    | 1100m |
| Trench Choir         | Midnight Column   | 1600m |
| Abyss Orchard        | Midnight Column   | 2200m |
| Living Map           | Abyssal Trench    | 3200m |

Reaching Living Map (3200m) completes the dive.

## Seeded determinism

Every run is defined by a 32-bit seed. The low 18 bits map to a
shareable adjective-adjective-noun codename via `src/sim/rng/codename.ts`.
Codename → seed is a deterministic bijection for the low 18 bits;
higher bits add entropy to placement jitter without changing the
headline codename.

Sources of a seed on `Begin Dive`:
1. `?seed=<codename>` URL override.
2. *"Today's Trench"* CTA — `dailySeed()` keyed to local date.
3. Default — `randomSeed()`.

## Scoring and run summary

- **Score.** Sum of creature-scores × chain multipliers.
- **Charted %.** `collectedInRun / totalAvailableInRun` × 100.
- **Rating.** Computed from `(completionPercent, oxygenLeftRatio)`:
  - ≥ 100% + ≥ 34% oxygen = "Radiant Route"
  - ≥ 100% + ≥ 18% oxygen = "Clean Living Map"
  - ≥ 100% otherwise = "Narrow Ascent"
  - < 100% = "Partial Chart"

Best score is kept in `localStorage['bioluminescent-sea:v1:best-score']`,
keyed globally (not per seed). Per-seed leaderboards are out of scope
for 1.0.
