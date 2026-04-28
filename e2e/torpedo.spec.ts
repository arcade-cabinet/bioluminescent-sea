import { type Page, expect, test } from "@playwright/test";
import { CANVAS_MOUNT_BUDGET_MS, budget } from "./helpers/budget";

/**
 * Torpedo combat smoke test.
 *
 * Verifies from the player's POV that a double-tap on the canvas fires a
 * torpedo and deducts 5 s of oxygen — more than passive drain alone can
 * explain in the measurement window.
 *
 * Uses `devFastDive=4` so oxygen ticks at 4× real-time. At that rate,
 * passive drain over the ~1.15 s wall-clock observation window ≈ 4.6 s.
 * Torpedo adds 5 s → total drop ≥ 5 s even if every frame arrives late.
 *
 * Fire is triggered by two synthetic `pointerdown` events <300 ms apart on
 * the game container — the same double-tap detection path used on mobile.
 *
 * Post-fire assertion uses expect.poll() so slow CI RAF frames are tolerated
 * up to the poll timeout rather than a fixed sleep.
 */

async function readOxygen(page: Page): Promise<number> {
  const compact = page.getByTestId("hud-compact-oxygen");
  const compactVisible = await compact.isVisible().catch(() => false);

  let text: string | null = null;
  if (compactVisible) {
    text = await compact.textContent();
  } else {
    const wrapper = page.locator('[data-testid="hud-stat-oxygen"]');
    text = await wrapper.textContent().catch(() => null);
  }

  if (!text) return -1;
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : -1;
}

async function dispatchPointerDown(page: Page): Promise<void> {
  await page.evaluate(() => {
    const container = document.querySelector<HTMLElement>(".touch-none");
    if (!container) throw new Error("game container not found");
    const rect = container.getBoundingClientRect();
    container.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        pointerId: 1,
      }),
    );
  });
}

// Run serially — the test reads oxygen values from a live RAF loop; parallel
// GPU/canvas resource contention on CI can delay frames enough to miss the
// assertion window (same pattern as capture-iteration-2.spec.ts).
test.describe.configure({ mode: "serial" });

test.describe("Torpedo combat", () => {
  test("double-tap fires torpedo and deducts ≥5 s oxygen vs passive drain", async ({
    page,
  }) => {
    // devFastDive=4: oxygen ticks at 4× real-time, making the 5 s torpedo
    // cost a clear outlier above passive-only drain in any timing window.
    await page.goto("/?seed=photic-kelpish-benthos&devFastDive=4");

    await page.getByTestId("mode-card-descent").click();
    await expect(page.getByTestId("seed-picker-overlay")).toBeVisible();
    await page.getByTestId("begin-dive-button").click();

    const canvas = page.locator('canvas[aria-label*="playfield" i]');
    await expect(canvas).toBeVisible({ timeout: CANVAS_MOUNT_BUDGET_MS });

    // Settle for 1 s so the HUD has live values.
    await page.waitForTimeout(1000);

    const oxygenBefore = await readOxygen(page);

    // First tap — establishes lastTapTime in useTouchInput.
    await dispatchPointerDown(page);
    // 150 ms gap — well within the 300 ms double-tap window.
    await page.waitForTimeout(150);
    // Second tap — triggers isDoubleTap = true → fire = true.
    await dispatchPointerDown(page);

    expect(oxygenBefore, "oxygen read before torpedo fire").toBeGreaterThan(0);

    // Poll until the oxygen drop propagates through the RAF game loop.
    // expect.poll retries on the assertion; we check that the *current*
    // oxygen is at least 5 s below the pre-fire reading, regardless of
    // how many frames have elapsed since the tap.
    await expect
      .poll(
        async () => {
          const oxygenAfter = await readOxygen(page);
          return oxygenBefore - oxygenAfter;
        },
        {
          message: `torpedo should deduct ≥5 s oxygen (before=${oxygenBefore}s)`,
          timeout: budget(3000),
          intervals: [100, 200, 300, 500],
        },
      )
      .toBeGreaterThanOrEqual(5);
  });
});
