import { expect, test } from "@playwright/test";
import { CANVAS_MOUNT_BUDGET_MS } from "./helpers/budget";

/**
 * Refresh persistence smoke. Start a dive on seed A, wait for the
 * autosave to fire (~400ms initial + 2.5s interval), then reload onto
 * seed B (a different URL param). When the player picks Begin Dive,
 * `resolveDeepSeaSnapshot()` should restore the *original* seed A from
 * the persisted snapshot rather than starting fresh on seed B —
 * proving the snapshot's stored seed (added in PR #75) overrides the
 * URL when present. The URL gets rewritten back to A via
 * pushSeedToUrl on the resumed dive.
 */

test.describe("Mid-dive refresh persistence", () => {
  test("reload while diving restores the same dive on the same seed", async ({ page }) => {
    await page.goto("/?seed=glassy-olivine-cenote");

    await page.getByTestId("mode-card-descent").click();
    await expect(page.getByTestId("seed-picker-overlay")).toBeVisible();
    await page.getByTestId("begin-dive-button").click();
    await expect(page.locator('canvas[aria-label*="playfield" i]')).toBeVisible({
      timeout: CANVAS_MOUNT_BUDGET_MS,
    });

    // Seed A — what the snapshot will store.
    const seedA = new URL(page.url()).searchParams.get("seed");
    expect(seedA).toBeTruthy();

    // Let the autosave fire at least once (initial fires at 400ms).
    await page.waitForTimeout(1500);

    // Reload onto a *different* seed B. Without the snapshot, Begin
    // Dive on this page would start a fresh dive on seed B. With the
    // snapshot, it should resume seed A's dive instead.
    const seedB = "photic-kelpish-benthos";
    expect(seedB).not.toBe(seedA);
    await page.goto(`/?seed=${seedB}`);

    await page.getByTestId("mode-card-descent").click();
    await expect(page.getByTestId("seed-picker-overlay")).toBeVisible();
    await page.getByTestId("begin-dive-button").click();
    await expect(page.locator('canvas[aria-label*="playfield" i]')).toBeVisible({
      timeout: CANVAS_MOUNT_BUDGET_MS,
    });

    // The resumed dive must run on seed A, not seed B — and Game's
    // pushSeedToUrl should rewrite the URL back to A.
    await expect.poll(
      () => new URL(page.url()).searchParams.get("seed"),
      { timeout: 5000, message: "seed A from snapshot should win over URL seed B" }
    ).toBe(seedA);
  });
});
