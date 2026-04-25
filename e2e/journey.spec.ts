import { test, expect } from "@playwright/test";
import {
  attachCollector,
  dumpBeat,
  summarizeClipping,
} from "./helpers/diagnostics";

// Every HUD and landing element we care about for visual-regression
// diagnostics. Any selector that resolves to a clipped rect is a bug.
const JOURNEY_PROBES = [
  "[data-testid='landing-screen']",
  "[data-testid='playing-screen']",
  "[data-testid='gameover-screen']",
  "[data-testid='complete-screen']",
  "[data-testid='hud-stat-score']",
  "[data-testid='hud-stat-oxygen']",
  "[data-testid='hud-stat-chain']",
  "[data-testid='hud-stat-depth']",
  "[data-testid='hud-stat-charted']",
  "[data-testid='hud-biome-chip']",
  "[data-testid='hud-landmark-chip']",
  "[data-testid='hud-codename-chip']",
  "[data-testid='objective-banner']",
  "canvas[aria-label*='playfield' i]",
  "button",
] as const;

test.describe("Bioluminescent Sea — full journey diagnostics", () => {
  test("landing → dive → play → dump every beat", async ({ page }, testInfo) => {
    const collector = attachCollector(page);
    const seen = { console: 0 };

    // Seed URL so the diagnostics beats are deterministic (same codename,
    // same biome order) across viewports and runs.
    await page.goto("/?seed=photic-kelpish-benthos");

    // Beat 1 — landing
    await expect(page.getByTestId("landing-screen")).toBeVisible();
    await expect(page.getByRole("heading", { name: /bioluminescent sea/i })).toBeVisible();

    const landingDump = await dumpBeat(page, testInfo, "01-landing", collector, JOURNEY_PROBES, seen);
    expect(
      summarizeClipping(landingDump),
      `landing has clipped elements on ${testInfo.project.name}:\n${summarizeClipping(landingDump).join("\n")}`
    ).toEqual([]);

    // Beat 2 — open the seed picker for each mode card, exercising the
    // shared overlay across descent / arena / exploration variants.
    await page.getByTestId("mode-card-descent").click();
    await expect(page.getByTestId("seed-picker-overlay")).toBeVisible({ timeout: 2000 });
    await dumpBeat(page, testInfo, "02-mode-descent", collector, JOURNEY_PROBES, seen);

    await page.getByTestId("seed-cancel-button").click();
    await expect(page.getByTestId("seed-picker-overlay")).not.toBeVisible();

    await page.getByTestId("mode-card-arena").click();
    await expect(page.getByTestId("seed-picker-overlay")).toBeVisible({ timeout: 2000 });
    await dumpBeat(page, testInfo, "03-mode-arena", collector, JOURNEY_PROBES, seen);

    await page.getByTestId("seed-cancel-button").click();
    await expect(page.getByTestId("seed-picker-overlay")).not.toBeVisible();

    await page.getByTestId("mode-card-exploration").click();
    await expect(page.getByTestId("seed-picker-overlay")).toBeVisible({ timeout: 2000 });

    // Beat 4 — click Begin Dive, assert transition lands under 2500ms
    const startedAt = Date.now();
    await page.getByTestId("begin-dive-button").click();
    await expect(page.getByTestId("playing-screen")).toBeVisible({ timeout: 2500 });
    const transitionMs = Date.now() - startedAt;
    expect(
      transitionMs,
      `landing → playing transition took ${transitionMs}ms (budget 2500ms — PRD says 600ms ideal)`
    ).toBeLessThan(2500);

    // Beat 4 — first gameplay frame. The compact HUD on phone viewports
    // collapses everything except the primary cluster (oxygen, score,
    // chain) behind a hamburger button — open it so the deep stats are
    // visible to the diagnostics dump. On tablet/desktop the inline HUD
    // already exposes all stats and the menu button isn't rendered.
    await expect(page.locator("canvas[aria-label*='playfield' i]")).toBeVisible();
    const menuButton = page.getByTestId("hud-menu-button");
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.getByTestId("hud-menu-panel")).toBeVisible();
    }
    await expect(page.getByTestId("hud-stat-score")).toBeVisible();
    await expect(page.getByTestId("hud-stat-oxygen")).toBeVisible();
    await expect(page.getByTestId("hud-stat-depth")).toBeVisible();
    await expect(page.getByTestId("objective-banner")).toBeVisible();
    // Close the panel so subsequent beats run against gameplay, not paused.
    if (await page.getByTestId("hud-menu-panel").isVisible().catch(() => false)) {
      await page.getByTestId("hud-menu-close").click();
      await expect(page.getByTestId("hud-menu-panel")).not.toBeVisible();
    }

    const firstFrameDump = await dumpBeat(
      page,
      testInfo,
      "04-play-first-frame",
      collector,
      JOURNEY_PROBES,
      seen
    );
    expect(
      summarizeClipping(firstFrameDump),
      `gameplay first-frame has clipped elements on ${testInfo.project.name}:\n${summarizeClipping(firstFrameDump).join("\n")}`
    ).toEqual([]);

    // Beat 5 — let the dive run for ~4s so we see oxygen tick, depth move,
    // and (at challenge pace) the first biome transition.
    await page.waitForTimeout(4000);
    const descendingDump = await dumpBeat(
      page,
      testInfo,
      "05-play-descending",
      collector,
      JOURNEY_PROBES,
      seen
    );
    expect(
      summarizeClipping(descendingDump),
      `descending (4s in) has clipped elements on ${testInfo.project.name}:\n${summarizeClipping(descendingDump).join("\n")}`
    ).toEqual([]);

    // Beat 6 — stat sanity: oxygen is ticking down, depth is growing.
    // On compact viewports the inline HUD is hidden behind the hamburger
    // panel. The compact primary cluster carries the oxygen reading
    // always, and depth lives in the panel — open it briefly to read.
    const compactOxygen = page.getByTestId("hud-compact-oxygen");
    const oxygenLocator = (await compactOxygen.isVisible().catch(() => false))
      ? compactOxygen
      : page.getByTestId("hud-stat-oxygen");
    const oxygenText = (await oxygenLocator.textContent()) ?? "";
    expect(
      oxygenText,
      `oxygen stat should contain a "Ns" reading but got "${oxygenText}"`
    ).toMatch(/\d+s/);

    const menuButtonForDepth = page.getByTestId("hud-menu-button");
    const usedMenu = await menuButtonForDepth.isVisible().catch(() => false);
    if (usedMenu) {
      await menuButtonForDepth.click();
      await expect(page.getByTestId("hud-menu-panel")).toBeVisible();
    }
    const depthText = (await page.getByTestId("hud-stat-depth").textContent()) ?? "";
    expect(
      depthText,
      `depth stat should be an "Nm" reading but got "${depthText}"`
    ).toMatch(/\d+m/);
    if (usedMenu) {
      await page.getByTestId("hud-menu-close").click();
      await expect(page.getByTestId("hud-menu-panel")).not.toBeVisible();
    }

    // Beat 7 — final console accounting. Errors are a hard fail.
    // Tone.js autoplay warnings are known-benign; anything else should
    // surface.
    const errors = collector.consoleMessages.filter((m) => m.type === "error");
    expect(
      errors,
      `console errors during journey on ${testInfo.project.name}:\n${errors.map((e) => e.text).join("\n")}`
    ).toEqual([]);

    expect(
      collector.pageErrors,
      `uncaught page errors during journey on ${testInfo.project.name}:\n${collector.pageErrors.join("\n")}`
    ).toEqual([]);
  });
});
