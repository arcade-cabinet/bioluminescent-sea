---
title: Android icon sources
updated: 2026-04-23
status: current
domain: ops
---

# Android icon sources

The SVGs in this directory are the source of truth for the mipmap PNGs
under `android/app/src/main/res/mipmap-*/`. They are not referenced at
runtime — Android requires rasterized PNGs at specific densities.

## Files

| SVG                          | Use                                                |
| ---------------------------- | -------------------------------------------------- |
| `ic_launcher.svg`            | Pre-adaptive legacy launcher (API < 26 + fallback) |
| `ic_launcher_round.svg`      | Circular variant (manufacturer launchers)          |
| `ic_launcher_foreground.svg` | Adaptive-icon foreground (API 26+). Safe zone is the inner 72-radius circle |

## Regenerate

```sh
RES=android/app/src/main/res
cd android/icon-source

# Legacy + round
for density in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  d="${density%:*}"
  s="${density#*:}"
  magick -background none -density 1200 ic_launcher.svg       -resize "${s}x${s}" "../../$RES/mipmap-$d/ic_launcher.png"
  magick -background none -density 1200 ic_launcher_round.svg -resize "${s}x${s}" "../../$RES/mipmap-$d/ic_launcher_round.png"
done

# Adaptive foreground
for density in mdpi:108 hdpi:162 xhdpi:216 xxhdpi:324 xxxhdpi:432; do
  d="${density%:*}"
  s="${density#*:}"
  magick -background none -density 1200 ic_launcher_foreground.svg -resize "${s}x${s}" "../../$RES/mipmap-$d/ic_launcher_foreground.png"
done
```

The adaptive background color is the brand abyss navy
(`#0A1A2E`), defined in `values/ic_launcher_background.xml`.
