---
title: Deployment
updated: 2026-04-23
status: current
domain: ops
---

# Deployment

## Environments

| Environment | Trigger | What ships |
| ----------- | ------- | ---------- |
| GitHub Pages | push to `main` via `cd.yml` | `dist/` built with `GITHUB_PAGES=true` |
| GitHub Release | release-please tag | web bundle + Android debug APK |
| Android Debug APK | every PR via `ci.yml` | `android/app/build/outputs/apk/debug/*.apk` |

Production base path on Pages is `/bioluminescent-sea/`; Vite's
`vite.config.ts` conditionally sets that from `GITHUB_PAGES=true`.

## Secrets

| Secret | Used by |
| ------ | ------- |
| `ANDROID_KEYSTORE_BASE64` | release.yml signed release APK build |
| `ANDROID_KEYSTORE_PASSWORD` | release.yml |
| `ANDROID_KEY_ALIAS` | release.yml |
| `ANDROID_KEY_PASSWORD` | release.yml |

Without these the release job still runs but produces an unsigned
debug AAB — useful for local install, not Play Store.

## Local APK build

```bash
pnpm build
pnpm exec cap sync android
cd android
./gradlew assembleDebug
# APK lands at android/app/build/outputs/apk/debug/app-debug.apk
```

## Local Pages preview

```bash
GITHUB_PAGES=true pnpm build
pnpm preview  # serves /bioluminescent-sea/ to check base path
```
