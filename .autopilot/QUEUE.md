# Autopilot Queue

State for the self-enforcing /loop. The loop reads this file at the
top of each iteration: pick the next `[ ]` item, ship it, mark `[x]`
when its PR merges. Add new items to the bottom as you discover them.

Treat each item as a self-contained PR. Every item must end with
`(PR #NNN)` once shipped.

## Active

- [x] Wire authored `config/raw/creatures/*.json` into actor-archetype spawn weights so the JSON actually drives gameplay, not just docs (PR #238)
- [x] Add 3–5 new creature JSONs per pelagic zone reflecting the authored ecology (lanternfish, hatchetfish, anglerfish, gulper-eel, dumbo-octopus, hadal-snailfish) — even if they reuse existing visual archetypes, the *names* land (PR #240)
- [x] Audit the Drydock screen copy for stale lore-jargon — Drydock player-facing copy was already clean, but stale biome-id references in code/doc comments across fx/water/chunk/region/entities/advance/DrydockScreen/VISUAL_REVIEW were swept (PR #234)
- [x] Refresh `docs/STATE.md` to reflect the post-taxonomy era; `docs/RELEASE.md` was already accurate (PR pending)
- [x] Visually assess the existing screenshot bundle — done in this PR; findings recorded in `docs/screenshots/iteration-1/ASSESSMENT.md`. Action items below were extracted from that pass.
- [?] **CRITICAL fix → demoted**: shallow-water "washed-out white" finding could not be reproduced from code review. At 52m the surfaceRect alpha is ~0.05 mint and GodrayFilter gain ~0.20; AdjustmentFilter doesn't attenuate until 2400m. A pink wash is more consistent with either (a) a screenshot captured during the 1.4s biome-sweep cinematic at dive start (band alpha up to 0.55 in biome tint), or (b) the low-O₂ red vignette firing (oxygenRatio < 0.18 paints `#ff3a2a` edges that compound with the mint base). The proposed "cap GodrayFilter gain" fix targets the wrong subsystem. Re-capture under controlled conditions before re-promoting.
- [x] **MEDIUM fix**: mode card carousel `>` arrow + pagination dots are too low-contrast — new players miss that there are three modes. (PR #243)
- [x] **MEDIUM fix**: TODAY'S CHART vs REROLL in seed picker have ambiguous affordance (toggle vs action). Use distinct visual treatment. (PR #245)
- [x] **LOW fix**: mobile DRYDOCK chip needs more safe-area padding. (PR #247)
- [x] **LOW fix**: Drydock level-0 upgrade rows should ghost slightly so unpurchased upgrades read at a glance. (PR #249)
- [x] **NOTE / verify**: Drydock lifetime band shows `BEST SCORE 0` and `DEEPEST 0m` with 23 dives logged. Verified: writer is correct (`Math.max(previous, summary)`); original screenshot was fixture state. Added integration test guarding against future regressions. (PR #251)
- [ ] Increase `OCEAN_FLOOR_METERS` reach: currently the deepest landmark is at 10500 m and the floor is 11000 m — add a mid-hadopelagic landmark around 8000 m so the player has a beat between the cold seep at 5500 m and the hadal trench at 10500 m
- [ ] The HUD shows "next landmark + metres-to-go" but the *direction* hint (still null because landmarks are below) is silently dropped. Consider rendering a small ↓ glyph next to the metres-to-go so the spatial relationship is unambiguous
- [ ] Verify the chunk-spawn species table actually reflects every authored zone's `ecology.collectibles` array — eyeball + tighten if there's drift
- [ ] Add an achievement for passing every named landmark in a single dive (12 currently — would require tracking landmarks-passed in run stats)
- [ ] Ambient render layer's per-biome description was updated in PR #228 but the actual painted ambient may still match the old 4-biome assumption. Verify `src/render/layers/ambient.ts` paints distinct ambient for all 5 zones, not just 4.

## Done

- [x] Seafloor symmetry — bottom mirrors top (PR #227)
- [x] Post-taxonomy doc/comment sweep + GOAP seafloor balance test (PR #228)
- [x] Drive HUD landmarks from authored content (PR #229)
- [x] Expand landmark catalogue 6 → 12 (PR #230)
- [x] Trench blurbs reference the new landmarks (PR #231)
- [x] Plain-English dive-completion copy (PR #232)
- [x] Finish stale-biome comment sweep across fx/water/chunk/region/entities/advance/DrydockScreen/VISUAL_REVIEW (PR #234)
- [x] Visual assessment of iteration-0 + iteration-1 screenshots (this PR)
