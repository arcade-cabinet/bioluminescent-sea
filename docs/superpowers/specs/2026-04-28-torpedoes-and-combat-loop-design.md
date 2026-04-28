---
title: Torpedoes + combat loop
updated: 2026-04-28
status: current
domain: technical
---

# Spec 4 — Torpedoes + combat loop

## Why

Today's only "combat" is ramming, which the scoop spec already partly
retired (creatures are scooped, not rammed). Predators still bite by
proximity and the player's only defense is the lamp. That's a
strangely passive answer to a sub-with-a-scoop facing a torpedo-eel —
the player should be able to push back.

This spec adds **torpedoes**:

- Player can fire from the scoop's forward midpoint.
- Torpedoes are projectile actors via the factory pyramid (new
  `actor/projectile` archetype kind).
- Predators react: hit predators flee or die; near-miss predators
  enter a brief dodge state with avoidance steering.
- Torpedoes have a **cost** — limited ammo OR oxygen-cost OR cooldown,
  so combat is a real trade-off against the meditative pacing.

## Vision defaults — pending user review

Five vision-impacting choices the autopilot loop made by default,
flagged so review can flip any without re-architecting:

1. **Torpedo cost: oxygen-burn (3s per shot).** Pairs with the
   meditative pillar — every offensive action has a real meditation
   cost. Ammo would feel arcade; cooldown alone wouldn't bite.
   *Alternatives:* ammo-counter, cooldown-only, or all three.
2. **Damage model: 2 hits to kill baseline predator, 1 hit to dodge-flee.**
   First hit triggers FleeState (existing predator state). Second hit
   while in flee = kill. Heavies (leviathans, shadow-octopus) take 4+
   hits. Tunable per-archetype via existing PredatorArchetypeProfile.
3. **Aim: torpedoes track player's `aim` vector from Spec 2 controls.**
   Mobile right-stick aims, desktop mouse aims. Torpedo flies straight
   on launch — no homing for v1.
   *Alternative:* short-range homing once per torpedo's lifespan.
4. **Visual identity: bright-mint trail, fast.** Mint matches the
   bioluminescent palette; fast kills feeling of "weapon" and reads
   as "burst of light, sub launched something." 800 px/sec, 1.5s
   lifespan, fades on impact. *Alternative:* slow blue glow torpedo.
5. **Predator dodge: if a torpedo is within `dodgeDetectRadiusPx` of
   a predator, the predator's state machine inserts a brief Dodge
   state (lateral steering force perpendicular to torpedo bearing,
   0.4s).** Adds the "near-miss" feedback. *Alternative:* no dodge,
   predators just take hits. Rejected because it means the player
   can blindly pelt torpedoes for free; dodge gives predators agency.

If a default proves wrong on playtest, change the bullet, change the
test contract, change the constant. Architecture survives.

## Goals

- Player has a real offensive action with a real cost.
- Predators have a real defensive reaction (dodge state).
- Torpedoes integrate into the factory pyramid without special-cased
  spawning code.
- Cavitation × perception (Spec 1+2) carries over: torpedo launch
  also bumps predator memory of the player within an audible radius
  (lower than cavitation's because the launch is brief).
- Test coverage: projectile motion, collision, damage application,
  predator state transition, oxygen-cost gating.

## Non-goals

- No heavy weapons (depth charges, mines) this spec. Single torpedo
  type at launch.
- No torpedo upgrades in the upgrade tree. The DEFAULT_TORPEDO config
  ships as a fixed value; upgrades follow if playtesting demands.
- No rebalance of predator HP or speed — predators take torpedo
  damage, but their existing tuning (patrol speed, charge windup,
  detection radius) is unchanged.
- No multiplayer / network considerations.

## Module shape

```
src/sim/factories/actor/
  projectile.ts             # NEW — TorpedoArchetype + createTorpedo
  archetypes.ts             # MODIFIED — register "torpedo" kind
src/sim/entities/
  types.ts                  # MODIFIED — Torpedo entity type;
                            #   PredatorAiState gains "dodge"
src/sim/engine/
  collection.ts             # MODIFIED — collectTorpedoes(player, predators, torpedoes, dt)
  advance.ts                # MODIFIED — wire torpedo step + collision
src/sim/ai/
  predator-brain/states.ts  # MODIFIED — DodgeState, transition rules
src/sim/player/
  torpedo.ts                # NEW — fireTorpedo(player, ammo) → Torpedo
  __tests__/
    torpedo.test.ts         # NEW
```

## Sim contract

```ts
export interface Torpedo {
  id: string;
  /** Position. */
  x: number;
  y: number;
  /** Velocity vector (px/sec). */
  vx: number;
  vy: number;
  /** Sim-time the torpedo expires. */
  expiresAt: number;
  /** Sim-time at launch — for FX age gating. */
  launchedAt: number;
}

export interface FireTorpedoResult {
  /** New torpedo entity to add to scene. null when fire was rejected. */
  torpedo: Torpedo | null;
  /** Oxygen cost in seconds (subtracted by caller). 0 when rejected. */
  oxygenCost: number;
  /** Player input was acknowledged this frame (for SFX gating). */
  fired: boolean;
}

/**
 * Attempt to fire a torpedo. Rejects when player is on cooldown
 * (lastTorpedoTime + cooldownSeconds > simTime) or when oxygen budget
 * is too low (caller's responsibility to guard pre-call; this fn just
 * reports the cost).
 */
export function fireTorpedo(
  player: { x: number; y: number; angle: number },
  simTime: number,
  lastTorpedoTime: number,
  config: TorpedoConfig,
): FireTorpedoResult;
```

The torpedo flies straight: `position += velocity * dt`. No drag, no
homing. Hits a predator when `Math.hypot(torpedo.x - p.x, torpedo.y - p.y)
< p.size * 0.5`.

## Damage + dodge contract

Predator brain gains `hp` damage on torpedo hit. The existing
`PredatorBrain.hp` field already supports this via the lamp-pressure
path; torpedoes apply `lampDamagePerHit` × `2` per hit (arbitrary —
makes 2 torpedoes lethal for baseline predator, 1 for already-flee'ing).

When a torpedo enters within `dodgeDetectRadiusPx` of a predator AND
the predator's current state is patrol/stalk/charge (not strike,
recover, flee, ambient):

- StateMachine transitions to `DodgeState`.
- DodgeState applies a steering force perpendicular to the torpedo's
  bearing, scaled by archetype `dodgeForce`.
- After `dodgeDurationSeconds` (~0.4s), state returns to whatever it
  was before.
- Dodge has a per-predator cooldown (`dodgeCooldownSeconds` ~ 1.5s)
  so a barrage of torpedoes doesn't stutter-step the predator
  indefinitely.

`PredatorAiState` gains a `"dodge"` variant. Renderer reads it the
same way it reads other states.

## Oxygen cost gating

Default: `OXYGEN_COST_PER_TORPEDO = 3` seconds. Default cooldown:
`COOLDOWN_SECONDS = 0.6`. When the player attempts to fire and oxygen
< OXYGEN_COST_PER_TORPEDO + a 5s safety margin, the runtime rejects
the input — no torpedo, no cost, the SFX layer plays a "click" not a
"woosh."

## Cavitation cross-cut

Torpedo launch fires an audible event distinct from sustained
cavitation but using the same `AIManager.applyCavitationBump` path:

```ts
ai.applyCavitationBump(player.x, player.y, TORPEDO_AUDIBLE_RADIUS_PX, simTime);
```

Where `TORPEDO_AUDIBLE_RADIUS_PX < CAVITATION_AUDIBLE_RADIUS_PX`
because a single shot is briefer than sustained sprint.

## Test strategy (Spec 4b — failing tests first)

### Projectile motion (`torpedo.test.ts`)

- Fire torpedo with player facing +X → torpedo velocity is +X at config
  speed.
- Heading rotation propagates: facing +Y → velocity +Y.
- Step forward `dt=1` → position advances by velocity × dt.
- Expires at simTime > launchedAt + lifespan.
- NaN inputs → `torpedo: null`, `fired: false`, `oxygenCost: 0`.

### Cooldown gating

- Fire at simTime=0 succeeds.
- Fire at simTime=0.5 (within 0.6s cooldown) → fired: false.
- Fire at simTime=0.7 → fired: true.

### Damage + dodge

- Torpedo hits predator → predator hp drops by torpedo damage.
- Two consecutive hits on baseline predator → predator hp ≤ 0
  (death or flee triggered).
- Torpedo passes within dodgeDetectRadius of predator in patrol state →
  StateMachine transitions to DodgeState.
- After dodgeDurationSeconds, state machine returns to patrol.
- Dodge cooldown prevents back-to-back transitions.

### Cavitation bump on launch

- Successful fire calls applyCavitationBump with TORPEDO_AUDIBLE_RADIUS.
- Rejected fire does NOT call bump.

## Acceptance criteria

1. `pnpm test:node` passes including all torpedo + dodge tests.
2. The existing GOAP-bot integration test stays green — bots ignore
   the torpedo channel (no regression).
3. `grep -rn "torpedo" src/sim/factories/actor/archetypes.ts` shows
   the new archetype registered through the pyramid, not special-cased.

## Risks / open follow-ups

- **Performance: torpedoes × predators is O(NM)** per frame; with N=4
  active torpedoes and M=8 predators, 32 hit-tests/frame is fine.
  Spatial-hash if it ever bites.
- **Bot driving torpedoes.** Out of scope — GOAP profiles continue to
  ignore the torpedo channel. A `RamPredatorProfile` equivalent that
  fires torpedoes is a Spec 4.x follow-up if useful for headless tests.
- **Renderer subscription** is a deferred React-surface commit, same as
  Specs 2/3 — sim-layer torpedo state lands here; particle trail +
  fire button + ammo HUD live in `src/ui/`.

## Spec-5 handoff

Spec 5 (creature schools as Yuka flocks) doesn't directly depend on
torpedoes. The two specs are independent — schools could land before
torpedoes if scope demands.
