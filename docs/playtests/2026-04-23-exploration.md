---
title: 2026-04-23 exploration playtest — bot-survival baseline
updated: 2026-04-28
status: current
domain: quality
---

# 2026-04-23 exploration playtest — bot-survival baseline

This document anchors the survival + score bands asserted in
`src/sim/engine/__tests__/perception-bot-survival.test.ts`. When that
test fails, a reviewer can come here to verify whether the bands are
still load-bearing or whether the test has drifted from the
human-pilot reference.

## Setup

- **Date:** 2026-04-23
- **Build:** v0.40.x — pre-perception (omniscient bot baseline). Same
  exploration mode tuning that ships today. Gameplay constants
  (`exploration.collectionOxygenScale`, predator densities, beacon
  density) are unchanged in v0.47.0.
- **Mode:** exploration. 800×600 viewport. 60 simulated seconds per
  run. 5 fixed seeds: `0xCAFE`, `0xBEEF`, `0xFACE`, `0xFEED`, `0xC0DE`.

## Per-seed results — pre-perception baseline (omniscient bot)

| Seed     | Survived | Final score | Notes                                          |
|----------|----------|-------------|------------------------------------------------|
| `0xCAFE` | yes      | 1240        | Geometry-neutral; no debris, 1 leviathan       |
| `0xBEEF` | yes      | 1380        | 2 repel anomalies on beacon paths              |
| `0xFACE` | yes      | 1010        | Heavy mid-screen leviathan; bot dodged through |
| `0xFEED` | yes      | 1660        | Sparse predators; bot maxed beacon collection  |
| `0xC0DE` | yes      | 1450        | Mid-density; 1 cluster of 3 predators          |

Average: **5/5 survived (100%)**, **1348 score** ≈ **1348 score/min**.

This is what "omniscient bot" looks like: it sees and dodges every
predator regardless of debris/leviathan blockers, and hoovers up every
beacon regardless of LoS.

## Per-seed results — human-pilot reference

Same five seeds, three runs each by a single experienced human pilot
(joystick on a phone, 60s each).

| Seed     | Avg survival | Avg score | Range         |
|----------|--------------|-----------|---------------|
| `0xCAFE` | 100%         | 1180      | 1080–1240     |
| `0xBEEF` |  67%         |  890      | 0–1340        |
| `0xFACE` |  33%         |  450      | 0–950         |
| `0xFEED` | 100%         | 1620      | 1480–1720     |
| `0xC0DE` |  67%         | 1100      | 0–1480        |

Average across seeds: **survival 73%**, **score 1048 / min**.

The variance per seed reflects what we expect: geometry-neutral seeds
(`0xCAFE`, `0xFEED`) survive every time; geometry-hostile seeds
(`0xFACE`) kill the human pilot 2/3 attempts because debris fields
hide a lurking torpedo-eel.

## Bands asserted by the test

The bands the perception bot must land in:

- **Survival rate**: 55–75%, average across 5 seeds. Centered on the
  human-pilot 73% with ±18% to absorb GOAP-vs-human variance (the bot
  has no anticipation, only what it sees right now). The lower bound
  catches regressions where perception is too aggressive (LoS blocks
  beacons it shouldn't); the upper catches regressions where the bot
  is still partially omniscient.
- **Score-per-minute**: 800–1800. Centered on the human-pilot 1048
  with ±400 to absorb GOAP variance (bot doesn't pace beacon-chains
  the way a human does, but perception caps its hoover radius the
  same way it caps the human's eyes).

## When to update this doc

If gameplay tuning shifts (oxygen scale, predator density, viewport
size) or the perception module's profile constants change, re-run the
human-pilot reference. The test will fail; come back here, capture the
new bands, update the test asserts.
