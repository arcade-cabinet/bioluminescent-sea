# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.7.2...v0.8.0) (2026-04-25)


### Features

* **bs:** every gameplay parameter seed-derived; no hardcoded balance numbers ([#107](https://github.com/arcade-cabinet/bioluminescent-sea/issues/107)) ([30e6620](https://github.com/arcade-cabinet/bioluminescent-sea/commit/30e66207a57eeebf45171226158f20cd6737a196))

## [0.7.2](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.7.1...v0.7.2) (2026-04-25)


### Bug Fixes

* **bs:** carousel nav arrows clipped off-screen on mobile ([#103](https://github.com/arcade-cabinet/bioluminescent-sea/issues/103)) ([645f991](https://github.com/arcade-cabinet/bioluminescent-sea/commit/645f99181f8e9e8b4c06aaeef0210eaac0c96057))
* **bs:** refraction filter left a visible rectangle in upper-left ([#105](https://github.com/arcade-cabinet/bioluminescent-sea/issues/105)) ([8a6a3e8](https://github.com/arcade-cabinet/bioluminescent-sea/commit/8a6a3e8348b07a8ad542da8e7101ccfc8fe71c38))
* **bs:** water depth-tint filter clipped to half-screen rectangle ([#106](https://github.com/arcade-cabinet/bioluminescent-sea/issues/106)) ([124f2ac](https://github.com/arcade-cabinet/bioluminescent-sea/commit/124f2acdcf91aef21ee51c73ba42740653134052))

## [0.7.1](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.7.0...v0.7.1) (2026-04-25)


### Bug Fixes

* **bs:** Exploration idle descent never advanced past 0m ([#101](https://github.com/arcade-cabinet/bioluminescent-sea/issues/101)) ([c8bf6c7](https://github.com/arcade-cabinet/bioluminescent-sea/commit/c8bf6c7741c0f2d659dc87cc42c4c67b16bfd499))
* **bs:** five gameplay regressions surfaced by live QA ([#99](https://github.com/arcade-cabinet/bioluminescent-sea/issues/99)) ([919a87c](https://github.com/arcade-cabinet/bioluminescent-sea/commit/919a87ca2728ed31eeb371789b63f33829941e85))

## [0.7.0](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.6.1...v0.7.0) (2026-04-25)


### Features

* **bs:** balance pass — predator AI state machine + mode tunings (PR B) ([#94](https://github.com/arcade-cabinet/bioluminescent-sea/issues/94)) ([53311e5](https://github.com/arcade-cabinet/bioluminescent-sea/commit/53311e55739835a7f44ea2e3b6b653e01456e83e))
* **bs:** brand identity + visual overhaul of full player journey (PR A) ([#93](https://github.com/arcade-cabinet/bioluminescent-sea/issues/93)) ([6cc8d14](https://github.com/arcade-cabinet/bioluminescent-sea/commit/6cc8d1402c1c4c996cdca467b525f2d38c93067d))


### Bug Fixes

* **bs:** ambient fish visibility + predator detection radius ([#90](https://github.com/arcade-cabinet/bioluminescent-sea/issues/90)) ([126c8c9](https://github.com/arcade-cabinet/bioluminescent-sea/commit/126c8c9aa683add3a5211e8f9af56908e16369b6))
* **bs:** Arena dives don't end at frame 1 (shoal-press spawn carve-out) ([#98](https://github.com/arcade-cabinet/bioluminescent-sea/issues/98)) ([52191e2](https://github.com/arcade-cabinet/bioluminescent-sea/commit/52191e2462b8272650234e91f8246b126ac0f873))
* **bs:** instant game-over loop — snapshot resurrect after dive end ([#88](https://github.com/arcade-cabinet/bioluminescent-sea/issues/88)) ([f0044e7](https://github.com/arcade-cabinet/bioluminescent-sea/commit/f0044e797167a5da57b86cfa4e0591f4285b97c6))
* **bs:** objective banner type-on-water + predators read warm/red ([#97](https://github.com/arcade-cabinet/bioluminescent-sea/issues/97)) ([484467a](https://github.com/arcade-cabinet/bioluminescent-sea/commit/484467a86221f294a28b7c64a92edbc76a39e514))
* **bs:** real carousel + identity tests ([#95](https://github.com/arcade-cabinet/bioluminescent-sea/issues/95)) ([69256c5](https://github.com/arcade-cabinet/bioluminescent-sea/commit/69256c5ae6ab0ad7426673b9e1a2f7392750f7a5))
* **bs:** the dive playfield was permanently washed red ([#96](https://github.com/arcade-cabinet/bioluminescent-sea/issues/96)) ([81e8f1b](https://github.com/arcade-cabinet/bioluminescent-sea/commit/81e8f1b17e330614e8d9f124315f7a211ebc3904))
* **bs:** tighten predator detection radius to 380px ([#92](https://github.com/arcade-cabinet/bioluminescent-sea/issues/92)) ([bcbba83](https://github.com/arcade-cabinet/bioluminescent-sea/commit/bcbba83e46b71eee8697fc9d3354444248655228))
* **bs:** wire spawnAmbientFishForChunk into the actual chunk lifecycle ([#91](https://github.com/arcade-cabinet/bioluminescent-sea/issues/91)) ([81c3844](https://github.com/arcade-cabinet/bioluminescent-sea/commit/81c3844cd3e510709bc131e7c5751699b53380fd))

## [0.6.1](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.6.0...v0.6.1) (2026-04-25)


### Bug Fixes

* **bs:** every dive ended in 3-10s — predators spawned on the player ([#85](https://github.com/arcade-cabinet/bioluminescent-sea/issues/85)) ([1d63029](https://github.com/arcade-cabinet/bioluminescent-sea/commit/1d63029d50017bb94c0240f985ad1c24d4a53e57))
* **bs:** visual QA — caustic discs, lamp cone, sub scale ([#87](https://github.com/arcade-cabinet/bioluminescent-sea/issues/87)) ([a49afc8](https://github.com/arcade-cabinet/bioluminescent-sea/commit/a49afc8d8baad063182bfc110a961e361858b55e))

## [0.6.0](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.5.0...v0.6.0) (2026-04-25)


### Features

* **bs:** ambient fish baseline so chunks feel populated ([#82](https://github.com/arcade-cabinet/bioluminescent-sea/issues/82)) ([8b6944b](https://github.com/arcade-cabinet/bioluminescent-sea/commit/8b6944baeb6a2937cc6aea9397d9daebc06105b4))
* **bs:** arena pockets stay cleared after threats drop to zero ([#84](https://github.com/arcade-cabinet/bioluminescent-sea/issues/84)) ([921f15e](https://github.com/arcade-cabinet/bioluminescent-sea/commit/921f15ec7d18564441efba6ebe96dd5c675be1ee))
* **bs:** articulated submersible silhouette ([#83](https://github.com/arcade-cabinet/bioluminescent-sea/issues/83)) ([5ff37c3](https://github.com/arcade-cabinet/bioluminescent-sea/commit/5ff37c384e42da9f5f11de2c2e2ae33968cf4e72))
* **bs:** enforce Descent's lateralMovement=locked slot ([#80](https://github.com/arcade-cabinet/bioluminescent-sea/issues/80)) ([0ac9baa](https://github.com/arcade-cabinet/bioluminescent-sea/commit/0ac9baa77d91bf760e0bc04d1019657fd27200d1))
* **bs:** swipeable mode carousel for compact viewports ([#81](https://github.com/arcade-cabinet/bioluminescent-sea/issues/81)) ([c91979b](https://github.com/arcade-cabinet/bioluminescent-sea/commit/c91979b7cb98c7d84fd78af0dc535eea17a979c3))


### Bug Fixes

* **bs:** visual QA round 1 — landing, biome banner, spawns ([#77](https://github.com/arcade-cabinet/bioluminescent-sea/issues/77)) ([e16072f](https://github.com/arcade-cabinet/bioluminescent-sea/commit/e16072fc92123f0e40ed8e9a9b283c5aad0b7d1b))


### Refactoring

* **bs:** aquatic rebrand + redesigned mode slots ([#79](https://github.com/arcade-cabinet/bioluminescent-sea/issues/79)) ([0962196](https://github.com/arcade-cabinet/bioluminescent-sea/commit/0962196c98dcc3dbf52dfbfb9fd4965ae42f09e0))

## [0.5.0](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.4.0...v0.5.0) (2026-04-25)


### Features

* **bs:** adaptive HUD per device class + e2e extensions ([#76](https://github.com/arcade-cabinet/bioluminescent-sea/issues/76)) ([63e7408](https://github.com/arcade-cabinet/bioluminescent-sea/commit/63e7408dedb1bbad4f6de522b27480fc882d8753))
* **bs:** Add Powerup Anomalies and Stygian Leviathans to the simulation ([#72](https://github.com/arcade-cabinet/bioluminescent-sea/issues/72)) ([a17299a](https://github.com/arcade-cabinet/bioluminescent-sea/commit/a17299ae5cf113abf1959d7b0a76986377751b61))
* **bs:** Add Stygian Abyss Infinite Open World Loop ([#68](https://github.com/arcade-cabinet/bioluminescent-sea/issues/68)) ([b04d7bb](https://github.com/arcade-cabinet/bioluminescent-sea/commit/b04d7bb15eef4ed397f1d858eaa1410833ec8eaf))
* **bs:** Add Submersible Upgrade Meta-progression and Drydock UI ([#69](https://github.com/arcade-cabinet/bioluminescent-sea/issues/69)) ([6c2de3d](https://github.com/arcade-cabinet/bioluminescent-sea/commit/6c2de3d88a494c43f9a916fe28e65d3a92e2bee7))
* **bs:** biome transition banner — player sees the depth bands ([#60](https://github.com/arcade-cabinet/bioluminescent-sea/issues/60)) ([5ecb06b](https://github.com/arcade-cabinet/bioluminescent-sea/commit/5ecb06b109d7180cd8bad1ab8f2d10fba98f6ed3))
* **bs:** Implement Chunking, Lateral Scaling, Customization, Procedural Visuals and AI Steering ([#67](https://github.com/arcade-cabinet/bioluminescent-sea/issues/67)) ([28fca7f](https://github.com/arcade-cabinet/bioluminescent-sea/commit/28fca7fec91642a0e8d63936fd08184d42443e97))
* **bs:** runtime chunk lifecycle — biomes actually change during play ([#58](https://github.com/arcade-cabinet/bioluminescent-sea/issues/58)) ([423b998](https://github.com/arcade-cabinet/bioluminescent-sea/commit/423b998506263207c600607fd9a136412a8c10b2))
* **render:** entities layer projects worldYMeters through camera (F.4e) ([#55](https://github.com/arcade-cabinet/bioluminescent-sea/issues/55)) ([9acc999](https://github.com/arcade-cabinet/bioluminescent-sea/commit/9acc99913c9ca316672ba7b35f94350f7db2e3d6))
* **sim:** chunked-spawn populates Creature.worldYMeters (F.4e seam) ([#54](https://github.com/arcade-cabinet/bioluminescent-sea/issues/54)) ([a7bdd10](https://github.com/arcade-cabinet/bioluminescent-sea/commit/a7bdd10fd223dbb3d9bbe5fa7e01c8c83323b69b))
* **sim:** chunkLifecycleDelta — F.4f spawn/retire helper ([#56](https://github.com/arcade-cabinet/bioluminescent-sea/issues/56)) ([588ffb4](https://github.com/arcade-cabinet/bioluminescent-sea/commit/588ffb4af339d47a44669296bb4f99ee4990475c))


### Bug Fixes

* **bs:** address PR [#74](https://github.com/arcade-cabinet/bioluminescent-sea/issues/74) CodeRabbit feedback — real bugs + clear-room gating + palette tokens ([#75](https://github.com/arcade-cabinet/bioluminescent-sea/issues/75)) ([8942598](https://github.com/arcade-cabinet/bioluminescent-sea/commit/8942598ad17437a574f0e91038d335ff4052c912))
* **hud:** group right-side chip stack (landmark + biome + codename) ([#62](https://github.com/arcade-cabinet/bioluminescent-sea/issues/62)) ([affb2de](https://github.com/arcade-cabinet/bioluminescent-sea/commit/affb2defefc46567d002a1dcd31bf95013e52fd2))


### Performance

* **bs:** fix tap-lag — decouple pointer events from RAF rebinds ([#59](https://github.com/arcade-cabinet/bioluminescent-sea/issues/59)) ([70c0aac](https://github.com/arcade-cabinet/bioluminescent-sea/commit/70c0aaccbe845563801590be1e1ad042c5b22525))
* **bs:** stabilize autosave effect; keep ambient alive across mute toggles ([#63](https://github.com/arcade-cabinet/bioluminescent-sea/issues/63)) ([865d4b5](https://github.com/arcade-cabinet/bioluminescent-sea/commit/865d4b5b8dc89ff39f18ad74ca5d524d76be5869))


### Refactoring

* **bs:** decompose Game.tsx, add primitives, mode triptych landing + Radix seed picker ([#74](https://github.com/arcade-cabinet/bioluminescent-sea/issues/74)) ([928b536](https://github.com/arcade-cabinet/bioluminescent-sea/commit/928b53603e038c0badef21701a20a804b786451c))
* **bs:** remove legacy unchunked spawning logic ([#71](https://github.com/arcade-cabinet/bioluminescent-sea/issues/71)) ([09beee9](https://github.com/arcade-cabinet/bioluminescent-sea/commit/09beee9835278d12636634d0a8c6d53edc7fa9ea))


### Documentation

* **agentic:** handoff + decisions log for bioluminescent-sea ([#64](https://github.com/arcade-cabinet/bioluminescent-sea/issues/64)) ([ab43d5d](https://github.com/arcade-cabinet/bioluminescent-sea/commit/ab43d5d5472192ccf7f8bc1344806d20557e0759))
* **bs:** Update docs to reflect Stygian Abyss, Yuka AI, and Drydock decisions ([#73](https://github.com/arcade-cabinet/bioluminescent-sea/issues/73)) ([f80f067](https://github.com/arcade-cabinet/bioluminescent-sea/commit/f80f067c0934a75ee5814316403dc0b98ed6b5e8))
* **production:** mark sibling foundations complete ([#57](https://github.com/arcade-cabinet/bioluminescent-sea/issues/57)) ([c738bf8](https://github.com/arcade-cabinet/bioluminescent-sea/commit/c738bf8d13808cd87a97eb80423d0b2a48fd2bfd))
* **production:** split F.4 into reviewable sub-PRs ([#52](https://github.com/arcade-cabinet/bioluminescent-sea/issues/52)) ([038773c](https://github.com/arcade-cabinet/bioluminescent-sea/commit/038773ca3e61b08ca2b8e0e2a52b2024d9404eb5))

## [0.4.0](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.3.1...v0.4.0) (2026-04-24)


### Features

* **render:** backdrop ridges parallax with descent (F.4 backdrop) ([#49](https://github.com/arcade-cabinet/bioluminescent-sea/issues/49)) ([4c0fe81](https://github.com/arcade-cabinet/bioluminescent-sea/commit/4c0fe810ee6b552005fa1c3b63bd41aea8ab859d))
* **render:** bridge owns a live camera synced to sim depthTravelMeters ([#48](https://github.com/arcade-cabinet/bioluminescent-sea/issues/48)) ([3ef6da4](https://github.com/arcade-cabinet/bioluminescent-sea/commit/3ef6da4ce7bcdc3e1f533cdc2af6a9d9b3282b95))
* **render:** parallax snow wraps with descent (F.4 parallax) ([#51](https://github.com/arcade-cabinet/bioluminescent-sea/issues/51)) ([716eb3d](https://github.com/arcade-cabinet/bioluminescent-sea/commit/716eb3d6292427699f79b4997ac27ffeec6326b5))

## [0.3.1](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.3.0...v0.3.1) (2026-04-24)


### Documentation

* **production:** mark PR F.3 complete (sim side); split F.4 renderer ([#45](https://github.com/arcade-cabinet/bioluminescent-sea/issues/45)) ([06c9314](https://github.com/arcade-cabinet/bioluminescent-sea/commit/06c931422e5135a8bef3aa17e555c5567f931023))

## [0.3.0](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.2.3...v0.3.0) (2026-04-24)


### Features

* **sim:** createChunkedScene — F.3 target-shape scene factory ([#44](https://github.com/arcade-cabinet/bioluminescent-sea/issues/44)) ([59bfeb1](https://github.com/arcade-cabinet/bioluminescent-sea/commit/59bfeb1f452272260c0e0f352978a5cce6dc1b78))
* **sim:** per-chunk creature spawning (F.3 continued) ([#43](https://github.com/arcade-cabinet/bioluminescent-sea/issues/43)) ([b8449f5](https://github.com/arcade-cabinet/bioluminescent-sea/commit/b8449f54f8d03af8a860ff7072b945ba3515ce74))


### Documentation

* **production:** sibling landing heroes in flight ([#41](https://github.com/arcade-cabinet/bioluminescent-sea/issues/41)) ([2e846fc](https://github.com/arcade-cabinet/bioluminescent-sea/commit/2e846fc3ef62db35a6f3cc4f30edc1da6ced3c05))

## [0.2.3](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.2.2...v0.2.3) (2026-04-24)


### Documentation

* **production:** close dependabot-majors box + update sibling statuses ([#37](https://github.com/arcade-cabinet/bioluminescent-sea/issues/37)) ([cea69e7](https://github.com/arcade-cabinet/bioluminescent-sea/commit/cea69e72bcc0b7e650c40b5992822fa8c2c720a3))
* **production:** cosmic-gardener RNG scaffold in flight ([#34](https://github.com/arcade-cabinet/bioluminescent-sea/issues/34)) ([ee21493](https://github.com/arcade-cabinet/bioluminescent-sea/commit/ee21493af6fd27f046d15d7f270a4bae0fc197f8))

## [0.2.2](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.2.1...v0.2.2) (2026-04-24)


### Bug Fixes

* **ts:** drop globalThis qualifier on crypto for TS 6 compat ([#29](https://github.com/arcade-cabinet/bioluminescent-sea/issues/29)) ([2bb03d2](https://github.com/arcade-cabinet/bioluminescent-sea/commit/2bb03d2bd3270c5b4b28d91df260cd3dec8ad9d9))


### Documentation

* **production:** close POC-sweep + review-feedback boxes ([#31](https://github.com/arcade-cabinet/bioluminescent-sea/issues/31)) ([974b1ae](https://github.com/arcade-cabinet/bioluminescent-sea/commit/974b1ae3796b0234748161011aafdcd340bf3fb1))
* **production:** Pages live; check off deploy + console-errors boxes ([#28](https://github.com/arcade-cabinet/bioluminescent-sea/issues/28)) ([e5941b5](https://github.com/arcade-cabinet/bioluminescent-sea/commit/e5941b5cfdcbb0e10d34761c3892ea9fe93ddd79))

## [0.2.1](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.2.0...v0.2.1) (2026-04-24)


### Bug Fixes

* **dive:** initial spawn-grace window works on first impact ([#21](https://github.com/arcade-cabinet/bioluminescent-sea/issues/21)) ([bc50dca](https://github.com/arcade-cabinet/bioluminescent-sea/commit/bc50dca2d25f1ae2e44945965d5a02f1bb97e5b4))
* **hud:** move critical-oxygen banner to bottom-center ([#27](https://github.com/arcade-cabinet/bioluminescent-sea/issues/27)) ([dc10471](https://github.com/arcade-cabinet/bioluminescent-sea/commit/dc1047186f882e168f88148034d1cfe76f142bc1))


### Documentation

* **production:** check off release 0.2.0 + 60s audit, note triage blockers ([#22](https://github.com/arcade-cabinet/bioluminescent-sea/issues/22)) ([f29270b](https://github.com/arcade-cabinet/bioluminescent-sea/commit/f29270b3fa5ff37bcc86fef9c965f6ca5e76e707))
* **production:** PR F.2 groundwork landed; split F.3 (chunking) ([#25](https://github.com/arcade-cabinet/bioluminescent-sea/issues/25)) ([126e227](https://github.com/arcade-cabinet/bioluminescent-sea/commit/126e227657a98398e59e08fa80c1514f93f3ce5c))

## [0.2.0](https://github.com/arcade-cabinet/bioluminescent-sea/compare/v0.1.0...v0.2.0) (2026-04-24)


### Features

* **content:** PR H — authored JSON content pipeline ([#16](https://github.com/arcade-cabinet/bioluminescent-sea/issues/16)) ([41752be](https://github.com/arcade-cabinet/bioluminescent-sea/commit/41752be83ee6c8abfc2487660c5b0bf5c3753fb1))
* **dive:** PR E — seed-driven spawning + codename UI ([#13](https://github.com/arcade-cabinet/bioluminescent-sea/issues/13)) ([8a21e9a](https://github.com/arcade-cabinet/bioluminescent-sea/commit/8a21e9af934b4b050e97507cd460de10c9d8a78c))
* **dive:** PR F.1 — biome surface (HUD chip + backdrop tint + objective copy) ([#17](https://github.com/arcade-cabinet/bioluminescent-sea/issues/17)) ([ec89907](https://github.com/arcade-cabinet/bioluminescent-sea/commit/ec8990775700efb783bf36676be5ade2f4104909))
* docs tree, workflows, release-please, dependabot, Capacitor android ([85e1388](https://github.com/arcade-cabinet/bioluminescent-sea/commit/85e13886c49b3e3358edc903b8c8270c1c11460b))
* **hud:** identity-forward HUD + dynamic objective banner ([00976c7](https://github.com/arcade-cabinet/bioluminescent-sea/commit/00976c7cd59f70c464c4a7bef581ea39fc0e5c18))
* identity-forward landing with verb teaser + ambient glow ([#8](https://github.com/arcade-cabinet/bioluminescent-sea/issues/8)) ([041666c](https://github.com/arcade-cabinet/bioluminescent-sea/commit/041666c3fdd339c819e0414989ee410d64a5df8b))
* **identity+ci:** favicon, apple-touch, OG image; automerge + nightly sweep ([#18](https://github.com/arcade-cabinet/bioluminescent-sea/issues/18)) ([36d1bf1](https://github.com/arcade-cabinet/bioluminescent-sea/commit/36d1bf103a38a69602d6274ab4db2bfe7a1da530))
* initial bioluminescent-sea scaffold ([6a19fca](https://github.com/arcade-cabinet/bioluminescent-sea/commit/6a19fcac7b893bed282ef2b1bf7f214188551bec))
* landing hero + Playwright e2e + reduced-motion polish ([#19](https://github.com/arcade-cabinet/bioluminescent-sea/issues/19)) ([1ea3a39](https://github.com/arcade-cabinet/bioluminescent-sea/commit/1ea3a3920486401cb50c32a487ea9376797c6f7a))


### Refactoring

* **foundation:** PR A — stack + docs + directory skeleton aligned to mean-streets ([#9](https://github.com/arcade-cabinet/bioluminescent-sea/issues/9)) ([94d4acf](https://github.com/arcade-cabinet/bioluminescent-sea/commit/94d4acfefe2f57ed1d43ab7b853a9d131f72770d))
* **render:** PR C — PixiJS scene graph replaces hand-rolled canvas ([#11](https://github.com/arcade-cabinet/bioluminescent-sea/issues/11)) ([721cd3d](https://github.com/arcade-cabinet/bioluminescent-sea/commit/721cd3d69aa45ba23775da56f329d2464e114ad3))
* **sim:** PR B — split deepSeaSimulation into responsibility-scoped modules ([#10](https://github.com/arcade-cabinet/bioluminescent-sea/issues/10)) ([ec6a437](https://github.com/arcade-cabinet/bioluminescent-sea/commit/ec6a437d489e8d0ab9be77c7191a04d660b96326))

## [Unreleased]
