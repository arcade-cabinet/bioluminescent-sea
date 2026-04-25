import { expect, test } from "@playwright/test";

/**
 * Drydock purchase smoke. Seeds the meta-progression localStorage with
 * enough Lux to afford one Hull upgrade (cost 500 at level 0 → 1), opens
 * the Drydock from the landing chip, clicks Upgrade on the hull row,
 * asserts the level chip increments to "Lvl 1 / 5".
 *
 * No bot, no GOAP — this is a UI flow assertion. The numeric balance is
 * checked via the Drydock's currency chip.
 */

test.describe("Drydock purchase flow", () => {
  test("seeded Lux can buy one Hull upgrade level", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("bs_currency", "1000");
      localStorage.setItem(
        "bs_upgrades",
        JSON.stringify({ hull: 0, battery: 0, motor: 0, lamp: 0 }),
      );
    });

    await page.goto("/");

    // Drydock chip on the landing carries the current Lux balance.
    const drydockChip = page.getByTestId("drydock-chip");
    await expect(drydockChip).toBeVisible();
    await expect(drydockChip).toContainText("1000");

    await drydockChip.click();
    await expect(page.getByTestId("drydock-screen")).toBeVisible();

    // Hull starts at level 0 with cost 500 (UPGRADE_COSTS[1]).
    const hullRow = page.getByTestId("upgrade-hull");
    await expect(hullRow).toBeVisible();

    // Capture the level text from the row, which contains "Lvl 0 / 5".
    const hullCard = hullRow.locator("xpath=ancestor::*[contains(@class,'border-deep') or self::section][1]");
    await expect(hullCard).toContainText(/Lvl 0/);

    await hullRow.click();

    // After purchase: level becomes 1, currency drops by 500.
    await expect(hullCard).toContainText(/Lvl 1/, { timeout: 4000 });

    // Lux balance in the header shrunk to 500.
    await expect(page.locator(":root").locator("text=/^500 Lux$/").first()).toBeVisible({
      timeout: 4000,
    });
  });
});
