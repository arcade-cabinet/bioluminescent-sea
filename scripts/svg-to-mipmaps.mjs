#!/usr/bin/env node
/**
 * Render `public/favicon.svg` into Android mipmap PNGs at every density
 * tier. Run with `node scripts/svg-to-mipmaps.mjs`. Outputs replace
 * Capacitor's scaffold icons in place.
 *
 * Density → pixel size mapping (Android docs, launcher icon):
 *   mdpi    → 48×48
 *   hdpi    → 72×72
 *   xhdpi   → 96×96
 *   xxhdpi  → 144×144
 *   xxxhdpi → 192×192
 *
 * The foreground icon for adaptive icons (mipmap-anydpi-v26) wants the
 * subject inside the inner 66dp safe zone, so we render at full size
 * then leave the surrounding transparency.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SVG_PATH = path.join(REPO_ROOT, "public", "favicon.svg");
const ANDROID_RES = path.join(REPO_ROOT, "android", "app", "src", "main", "res");

const TIERS = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

const VARIANTS = [
  { name: "ic_launcher.png", round: false },
  { name: "ic_launcher_round.png", round: true },
  { name: "ic_launcher_foreground.png", round: false },
];

async function main() {
  const svg = await readFile(SVG_PATH);
  console.log(`[mipmaps] read ${SVG_PATH} (${svg.byteLength}B)`);

  for (const tier of TIERS) {
    for (const variant of VARIANTS) {
      const outPath = path.join(ANDROID_RES, tier.dir, variant.name);
      let pipeline = sharp(svg, { density: 384 }).resize(tier.size, tier.size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
      if (variant.round) {
        // Composite a circular mask on the round variant so launchers that
        // want a round shape get one cleanly.
        const r = Math.floor(tier.size / 2);
        const mask = Buffer.from(
          `<svg width="${tier.size}" height="${tier.size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
        );
        pipeline = pipeline
          .composite([{ input: mask, blend: "dest-in" }])
          .png();
      }
      const buf = await pipeline.png().toBuffer();
      await writeFile(outPath, buf);
      console.log(`[mipmaps] wrote ${path.relative(REPO_ROOT, outPath)} (${tier.size}×${tier.size})`);
    }
  }

  console.log("[mipmaps] done");
}

main().catch((err) => {
  console.error("[mipmaps] failed:", err);
  process.exit(1);
});
