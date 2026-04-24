---
title: Decisions log — Bioluminescent Sea
updated: 2026-04-24
status: current
domain: context
---

# Bioluminescent Sea — Decisions log

Rolling log of material architectural / design decisions in this
repo. Append new entries at the top. Format: date, one-line summary,
then the reason + constraint.

---

## 2026-04-24 — Removed legacy unchunked spawning logic

**Reason:** Maintaining two parallel spawning pipelines (`seeded-spawn.ts` for fixed 18-beacon testing, and `chunked-spawn.ts` for production depth-scaling) caused responsive rendering glitches and bloated `advanceScene`.

**Constraint:** The game exclusively utilizes `ChunkManager` for entity generation across the board. The initial scene payload now spawns empty entity arrays, and chunks load them in on the first frame.

---

## 2026-04-24 — Meta-progression and Drydock UI added

**Reason:** The core loop was too ephemeral. To give players a reason to keep diving, score is now converted into a persistent `Lux` currency saved to `localStorage`.

**Constraint:** The `DrydockScreen` allows players to purchase submersible upgrades (Hull, Battery, Motor, Lamp) that alter simulation parameters like speed, penalty reduction, and render cone radius.

---

## 2026-04-24 — Yuka integrated for AI steering and flocking

**Reason:** Simple Perlin drift paths resulted in an "interactive screensaver" feel. We needed true emergent agency to escalate threat curves.

**Constraint:** The `yuka` library handles vehicle simulation inside an `AIManager`. Creatures use flocking (Alignment, Cohesion, Separation). Predators use `StalkAndDashBehavior`. Pirates use `WanderBehavior`. Yuka vehicles wrap and sync with existing simulation properties.

---

## 2026-04-24 — Infinite Open-World "Stygian Abyss" loop replaces fixed trench floor

**Reason:** The hardcoded `TRENCH_FLOOR_METERS` (6400m) artificially capped the roguelike potential of the game.

**Constraint:** Depth generation is now infinite. The final `abyssal-trench` gracefully degrades into endless iterations of the `stygian-abyss` biome, where background light drops to pure `#000000` and enemy density logarithmically scales, spawning massive procedurally-generated `Leviathans`.

---

## 2026-04-24 — Autosave effect depends on stable `writeSnapshot` (refs for telemetry + timeLeft)

**Reason:** The autosave `useEffect` previously depended on
`writeSnapshot`, which closed over `telemetry` and `timeLeft`. Since
`timeLeft` ticks once per second, the effect tore down and rebuilt
its `setInterval(2500)` every second, and the cleanup path called
`writeSnapshot()` on every teardown. Net: `localStorage.setItem` ran
at ~1 Hz instead of the intended 0.4 Hz, and the 2.5s interval
almost never fired.

**Constraint:** `writeSnapshot` must be referentially stable. Use
`useRef` for telemetry + timeLeft; the effect depends only on
`isGameOver`. PR #63.

---

## 2026-04-24 — Ambient pad keeps rescheduling through mute

**Reason:** `scheduleChord` used to early-return when `isMuted()`
which broke the Tone.Transport recursion chain. Muting during a
dive permanently killed the pad; un-muting later did nothing.

**Constraint:** Always re-schedule; gate the
`triggerAttackRelease` call, not the recursion. `stop()` still
cancels the Transport so this can't spin after unmount. PR #63.

---

## 2026-04-24 — Right-side HUD chips are one flex-column group

**Reason:** Landmark / biome / codename chips used to be three
independent `position: absolute` elements at `right: 1rem` with
hand-tuned `top: calc(... + 2.4rem)` offsets. When the landmark
chip wrapped its distance to a second line on narrow viewports,
the codename collided with it and rendered behind.

**Constraint:** One right-aligned flex-column with a consistent
gap. `whiteSpace: nowrap` on all three so labels don't wrap.
Codename clips with ellipsis if too long. PR #62.

---

## 2026-04-24 — Playwright harness is headed by default locally, unique port

**Reason:** `reuseExistingServer: true` was reusing whatever
happened to be on port 4173 — during one run it was a "Clown Car
Chaos" preview server from a different repo. Silent failures are
the exact thing browser testing should expose.

**Constraint:** Unique port per repo (41731 for bs). Real Chrome
channel locally so GPU / audio behave like production. `PW_HEADLESS=1`
for CI. PR #61.

---

## 2026-04-24 — Biome transitions are visible via a center-screen banner

**Reason:** Runtime chunk lifecycle (PR #58) means creatures
actually change as the sub descends. Without a banner, the player
wouldn't read the biome boundary — the band of color shifts too
gradually to notice on a phone.

**Constraint:** 2.2s transient banner, Cormorant Garamond,
`biomeTintHex` for the color. Fires on first biome entry too so the
player sees the system is working. PR #60.

---

## 2026-04-24 — Pointer input uses callback refs; RAF rebinds only on isRunning flip

**Reason:** The previous loop had `callback` in its
`useEffect` deps, which recreated the RAF chain on every render.
Pointer events cause state updates cause renders cause RAF restart —
the "tap lag" reported on mobile.

**Constraint:** `useTouchInput` keeps position in a ref, never
`setState`s on pointermove. `useGameLoop` reads callback via ref so
the RAF mounts exactly once per run. PR #59.
