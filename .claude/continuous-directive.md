---
title: Continuous Work Directive — Bioluminescent Sea
status: ACTIVE
updated: 2026-04-28
domain: context
---

# Continuous Work Directive — Bioluminescent Sea

This directive governs the autopilot loop for the **pre-1.0 launch
polish** work-unit covering player governance, controls, combat, and
creature autonomy. While `Status: ACTIVE`, the Stop hook
(`.claude/hooks/anti-stop-check.sh`) blocks session end whenever any
`- [ ]` remains below.

`docs/PRODUCTION.md` is the long-running production queue and is
currently fully drained. This directive is the active work-unit on top
of it. When this directive's queue drains, flip `Status: RELEASED`.

## What CONTINUOUS means right now

- **One long-running PR per topic, commits per issue inside it.** All
  five specs land as a sequence of commits on a single branch; only
  one PR is opened at the end.
- **Pipelined local review per commit.** Every commit is followed by
  three reviewers spawned **in parallel, in the background**
  (`run_in_background: true`):
  1. `feature-dev:code-reviewer` — bugs, logic errors, convention drift
  2. `general-purpose` subagent prompted for security review
  3. `code-simplifier` — over-abstraction, redundant code, slop
  Then **immediately move on to the next task**. Fold findings into
  the work-in-progress for the next commit. Reject findings that are
  wrong; address the rest.
- **No push until every box below is checked.** Local commits are the
  safety net. The single PR opens only at the end with green CI.
- **Docs → Tests → Code, every spec.** Each spec lands its design doc
  first, then a failing test that encodes the player-journey /
  visual / audio / gameplay assertion the doc requires, then the
  implementation that turns the test green. Test failures point to
  what to implement next; never stub or placeholder around them.

## Operating loop

For each spec N below:

1. Brainstorm + write design doc → commit (`docs:`).
2. Write failing tests against the design's contract → commit (`test:`).
3. Implement until tests pass → commit (`feat:`).
4. Spawn 3 reviewers in background on the just-landed commits.
5. Move to spec N+1 immediately. When findings arrive, fold into the
   next commit (`fix:` / `refactor:` / `chore:` as appropriate).
6. Check the spec's box.

After spec 5: one final review pass on the cumulative diff, push, open
the single PR, wait for CI green, merge.

## Forbidden phrases for this queue

- "Let me know if you'd like me to continue."
- "Should I proceed with the next spec?"
- "I'll wait for your input on…"
- Any closing summary that asks for confirmation.

The user has already said go. The loop continues until the queue is
drained or `Status` flips to `RELEASED`.

## Queue — pre-1.0 launch polish (5 specs, one PR)

### Branch + scaffolding

- [x] Create branch `feat/pre-launch-polish` off `main`.
- [x] Initial commit: this directive + anti-stop hook + settings update.

### Spec 1 — Perception layer (`src/sim/ai/perception/`)

Cone-of-vision + radius + line-of-sight. Wire into GOAP profiles so the
test bot reasons only from what a real player can see. Pirates already
have an awareness model — generalize it.

- [x] 1a. Brainstorm Spec 1 + write `docs/superpowers/specs/2026-04-28-perception-layer-design.md` → commit `docs:`.
- [x] 1b. Write failing tests asserting GOAP bot survival under realistic perception drops to player-realistic numbers → commit `test:`.
- [x] 1c. Implement perception module + retire direct `scene.creatures` / `scene.predators` reads in GOAP profiles → commit `feat:`.
- [x] 1d. Dispatch 3 reviewers in background.
- [x] 1e. Spec 1 complete; advance to Spec 2.

### Spec 2 — Player Vehicle + thrust controls

Joystick (mobile) + WASD/arrows (desktop). Sub becomes a Yuka-shaped
Vehicle with mass, maxForce, drag. Cavitation FX particles on the fx
layer keyed off speed.

- [ ] 2a. Brainstorm Spec 2 + write `docs/superpowers/specs/2026-04-28-player-vehicle-thrust-controls-design.md` → commit `docs:`.
- [ ] 2b. Write failing tests for thrust → velocity, drag decay, joystick deadzone, keyboard mapping, cavitation threshold → commit `test:`.
- [ ] 2c. Implement player Vehicle, joystick component, keyboard input, cavitation particles → commit `feat:`.
- [ ] 2d. Dispatch 3 reviewers in background. Fold pending findings from Spec 1.
- [ ] 2e. Spec 2 complete; advance to Spec 3.

### Spec 3 — Scoop + collection animation

Front-mounted scoop arc replaces body-overlap collection. Diegetic
collection animation plays on capture.

- [ ] 3a. Brainstorm Spec 3 + write `docs/superpowers/specs/2026-04-28-scoop-and-collection-animation-design.md` → commit `docs:`.
- [ ] 3b. Write failing tests for scoop arc geometry, only-front collection, animation event firing → commit `test:`.
- [ ] 3c. Implement scoop hit-test + animation pipeline + retire body-overlap collection → commit `feat:`.
- [ ] 3d. Dispatch 3 reviewers in background. Fold pending findings from Spec 2.
- [ ] 3e. Spec 3 complete; advance to Spec 4.

### Spec 4 — Torpedoes + combat loop

Projectile actor archetype (factory pyramid). Predator dodge state +
damage/flee. Torpedo cooldown + oxygen cost so combat is a real
trade-off.

- [ ] 4a. Brainstorm Spec 4 + write `docs/superpowers/specs/2026-04-28-torpedoes-and-combat-loop-design.md` → commit `docs:`.
- [ ] 4b. Write failing tests for projectile archetype, predator dodge state transitions, damage model, oxygen cost → commit `test:`.
- [ ] 4c. Implement projectile actor + predator dodge/damage/flee + torpedo controls + cooldown UI → commit `feat:`.
- [ ] 4d. Dispatch 3 reviewers in background. Fold pending findings from Spec 3.
- [ ] 4e. Spec 4 complete; advance to Spec 5.

### Spec 5 — Creature schools as Yuka flocks

Use the already-imported `AlignmentBehavior` + `CohesionBehavior` +
`SeparationBehavior` for ambient fish. Skittish flee on player approach.

- [ ] 5a. Brainstorm Spec 5 + write `docs/superpowers/specs/2026-04-28-creature-schools-design.md` → commit `docs:`.
- [ ] 5b. Write failing tests for flocking metrics, skittish flee distance, school cohesion under approach → commit `test:`.
- [ ] 5c. Implement creature Vehicle + flocking + skittish brain → commit `feat:`.
- [ ] 5d. Dispatch 3 reviewers in background. Fold pending findings from Spec 4.
- [ ] 5e. Spec 5 complete.

### Final pass

- [ ] Final cumulative review (3 agents on the full branch diff). Fold findings.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:browser && pnpm test:e2e` all green locally.
- [ ] Push branch.
- [ ] Open single PR titled `feat: pre-launch polish — perception, controls, scoop, combat, schools`.
- [ ] Wait for CI green; address any CodeRabbit / human feedback.
- [ ] Squash-merge to main.
- [ ] Flip this directive `Status: RELEASED`.

## Out of scope (genuinely — not deferrals)

- Visual rebrand passes beyond what each spec requires.
- New biomes / regions / chunk archetypes.
- Audio system rewrite (additive SFX/cues for new mechanics ARE in
  scope as part of each spec).
- Anything in `docs/PRODUCTION.md` "Next games" — those are sibling
  repos and stay there.
