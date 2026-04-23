---
title: Release
updated: 2026-04-23
status: current
domain: ops
---

# Release

## Tooling

- [release-please](https://github.com/googleapis/release-please-action)
  reads Conventional Commits on `main`, opens a release PR with a
  bumped version + CHANGELOG update, and on merge tags a release.
- The `release.yml` workflow runs on `push: main` and tagged releases.
- `cd.yml` deploys Pages on every `push: main`.

## Cutting a release

1. Merge PRs with Conventional Commit messages to `main`.
   - `feat:` → minor bump (pre-major this is `0.Y.0`).
   - `fix:` / `perf:` → patch.
   - `feat!:` or `BREAKING CHANGE:` footer → major.
2. `release-please-action` auto-opens a release PR within a few
   minutes of the push.
3. Review the release PR's CHANGELOG; merge when ready.
4. Merging the release PR creates a tag and triggers the `android`
   and `ios` jobs in `release.yml`.

## Manifest state

Tracked in `.release-please-manifest.json`. Do not hand-edit.

## Pre-1.0 rules

Per `release-please-config.json`:
- `bump-minor-pre-major: true`
- `bump-patch-for-minor-pre-major: false`

So `feat:` bumps minor (0.1 → 0.2), `fix:` bumps patch (0.2.0 → 0.2.1),
and we only graduate to 1.0 with an explicit major release PR.
