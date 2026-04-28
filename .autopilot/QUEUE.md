# Autopilot Queue

State for the self-enforcing /loop. The loop reads this file at the
top of each iteration: pick the next `[ ]` item, ship it, mark `[x]`
when its PR merges. Add new items to the bottom as you discover them.

Treat each item as a self-contained PR. Every item must end with
`(PR #NNN)` once shipped.

## Active

- [ ] Wire authored `config/raw/creatures/*.json` into actor-archetype spawn weights so the JSON actually drives gameplay, not just docs
- [ ] Add 3–5 new creature JSONs per pelagic zone reflecting the authored ecology (lanternfish, hatchetfish, anglerfish, gulper-eel, dumbo-octopus, hadal-snailfish) — even if they reuse existing visual archetypes, the *names* land
- [x] Audit the Drydock screen copy for stale lore-jargon — Drydock player-facing copy was already clean, but stale biome-id references in code/doc comments across fx/water/chunk/region/entities/advance/DrydockScreen/VISUAL_REVIEW were swept (PR #234)
- [x] Refresh `docs/STATE.md` to reflect the post-taxonomy era; `docs/RELEASE.md` was already accurate (PR pending)
- [x] Visually assess the existing screenshot bundle — done in this PR; findings recorded in `docs/screenshots/iteration-1/ASSESSMENT.md`. Action items below were extracted from that pass.
- [ ] **CRITICAL fix**: shallow-water dive render is washed-out white. Cap GodrayFilter gain + lower surfaceRect alpha at very shallow depths so the scene actually reads as deep ocean. Spec in ASSESSMENT.md.
- [ ] **MEDIUM fix**: mode card carousel `>` arrow + pagination dots are too low-contrast — new players miss that there are three modes.
- [ ] **MEDIUM fix**: TODAY'S CHART vs REROLL in seed picker have ambiguous affordance (toggle vs action). Use distinct visual treatment.
- [ ] **LOW fix**: mobile DRYDOCK chip needs more safe-area padding.
- [ ] **LOW fix**: Drydock level-0 upgrade rows should ghost slightly so unpurchased upgrades read at a glance.
- [ ] **NOTE / verify**: Drydock lifetime band shows `BEST SCORE 0` and `DEEPEST 0m` with 23 dives logged. Either fixture state or a real PersonalBests writer bug — add an integration test that asserts both are > 0 after a completed dive.
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
