import { type Page, expect, test } from "@playwright/test";
import { CANVAS_MOUNT_BUDGET_MS } from "./helpers/budget";

/**
 * Torpedo combat smoke test.
 *
 * Verifies from the player's POV that a double-tap on the canvas fires a
 * torpedo and deducts 5 s of oxygen — more than passive drain alone can
 * explain in the measurement window.
 *
 * Uses `devFastDive=2` so oxygen ticks at 2× real-time without compressing
 * the window so tight that the assertion fails on slow CI runners.
 *
 * Fire is triggered by two synthetic `pointerdown` events <300 ms apart on
 * the game container — the same double-tap detection path used on mobile.
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
    await page.goto("/?seed=photic-kelpish-benthos&devFastDive=2");

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

    // Allow several RAF frames for the game loop to read fire=true,
    // call advanceScene, and propagate torpedoOxygenCost → setTimeLeft.
    // 800ms gives ~48 frames at 60fps, enough even on slow CI runners.
    await page.waitForTimeout(800);

    const oxygenAfter = await readOxygen(page);

    expect(oxygenBefore, "oxygen read before torpedo fire").toBeGreaterThan(0);
    expect(oxygenAfter, "oxygen read after torpedo fire").toBeGreaterThan(0);

    // At 2× drain over ~1.65 s wall time, passive loss ≈ 3.3 s.
    // Torpedo adds 5 s cost → total drop ≥ 5 s even with zero passive.
    const drop = oxygenBefore - oxygenAfter;
    expect(
      drop,
      `torpedo should have deducted ≥5 s oxygen (before=${oxygenBefore}s, after=${oxygenAfter}s, drop=${drop}s)`,
    ).toBeGreaterThanOrEqual(5);
  });
});
