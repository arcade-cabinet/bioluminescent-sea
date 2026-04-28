# Autopilot Queue

State for the self-enforcing /loop. The loop reads this file at the
top of each iteration: pick the next `[ ]` item, ship it, mark `[x]`
when its PR merges. Add new items to the bottom as you discover them.

Treat each item as a self-contained PR. Every item must end with
`(PR #NNN)` once shipped.

## Active

- [ ] Wire authored `config/raw/creatures/*.json` into actor-archetype spawn weights so the JSON actually drives gameplay, not just docs
- [ ] Add 3–5 new creature JSONs per pelagic zone reflecting the authored ecology (lanternfish, hatchetfish, anglerfish, gulper-eel, dumbo-octopus, hadal-snailfish) — even if they reuse existing visual archetypes, the *names* land
- [ ] Audit the Drydock screen copy for stale lore-jargon — same pass we did on landing/seedpicker/celebration
- [ ] Sweep `docs/STATE.md` (if present) and `docs/RELEASE.md` to reflect the post-taxonomy state of the world
- [ ] Capture a fresh screenshot bundle on the latest main and assess for polish issues (#92 from the legacy task list)
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
