---
title: Autopilot Loop Runner
updated: 2026-04-27
status: current
domain: ops
---

# Autopilot Loop Runner

This file is the entry-point an automated loop reads at the top of
each iteration. It tells the agent **how** to operate. The queue
(`QUEUE.md`) tells it **what** to do.

## Hard rules

1. **One PR per iteration.** Never bundle two queue items into a
   single PR. Each item must be self-contained, reviewable,
   revertable.
2. **Every iteration ends with a merged PR or a clean stop.** No
   half-shipped state. If the chosen item turns out to be wrong
   (premise broken, prerequisite missing), demote it in the queue
   and pick the next viable item — never leave a dangling branch.
3. **Trust but verify.** Before shipping a fix for a finding,
   re-verify the finding on current main. A captured screenshot
   from a previous iteration may not still represent reality.
4. **Always work on a feature branch off main**, push, open PR via
   `gh pr create`, merge with `gh pr merge --squash` (auto-merge
   only if branch protection requires it).
5. **Tests must pass.** `pnpm typecheck && pnpm lint && pnpm test`
   green before push. If a test fails, fix the cause, don't skip
   the test.
6. **Never push to main directly** — branch protection blocks it.

## Iteration recipe

```
1. git checkout main && git fetch origin && git reset --hard origin/main
2. cat .autopilot/QUEUE.md  → identify topmost unchecked item under "## Active"
3. Brief sanity check: is the premise still true on current main?
   (If not — demote the item with a one-line note in the queue,
    move to the next item.)
4. git checkout -b <kind>/<short-slug>   (kinds: feat / fix / chore / docs)
5. Implement.  Keep scope tight.
6. pnpm typecheck && pnpm lint && pnpm test     ALL must pass.
7. git add -A && git commit -m "<conventional-commit-message>"
8. git push -u origin <branch>
9. gh pr create --title "..." --body "..."
10. gh pr merge <num> --squash
11. git checkout main && git fetch origin && git reset --hard origin/main
12. Edit .autopilot/QUEUE.md:
     - mark the item [x] with the trailing PR number
     - if new findings emerged, add them to the bottom of "## Active"
13. Open a *second* PR that lands the queue update.
14. Schedule the next iteration. Stop only when "## Active"
    has zero unchecked items.
```

## Queue update PR — special-case rule

Step 13 always produces a tiny PR (just `.autopilot/QUEUE.md`).
That's fine — it preserves the audit trail. Title format:

    chore(bs): autopilot — mark <item-slug> done

## When to stop the loop

- "## Active" in `QUEUE.md` has zero `[ ]` items.
- A test or build failure cannot be fixed within the iteration.
- A queue item requires user judgment (e.g., "should we adopt
  framework X?"). Demote with a `[?]` marker and a note, move on.

## Loop discovery — adding new items

When you encounter a finding mid-iteration that's not in scope for
the current PR, append it to "## Active" rather than expanding
scope. The next loop iteration will pick it up.

## Drift management

The queue can grow unbounded. Once a week (heuristic: every 10
iterations), do a *prune* iteration:
- Move stale `[ ]` items the codebase has solved organically into
  "## Done".
- Re-order items so highest-leverage / lowest-risk are at the top.
- Promote noted items (`NOTE`) to actionable items if confirmed.

## Example commit messages

```
feat(bs): wire authored creature JSON into actor archetypes
fix(bs): cap shallow-water god-ray gain so 50 m reads as ocean
chore(bs): autopilot — mark queue item M1 done
docs(bs): document seafloor symmetry slot in DESIGN
```
