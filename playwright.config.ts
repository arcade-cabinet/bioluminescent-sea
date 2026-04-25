import { defineConfig, devices } from "@playwright/test";

const IS_CI = !!process.env.CI;
const IS_HEADLESS = process.env.PW_HEADLESS === "1";
const CHROMIUM_CHANNEL =
  process.env.PW_CHROMIUM_CHANNEL ?? (!IS_CI && !IS_HEADLESS ? "chrome" : undefined);
const REUSE_SERVER = !IS_CI && process.env.PW_REUSE_SERVER === "1";

// Flags match mean-streets: keep Canvas2D / PixiJS happy, mute the trench
// drone, and prevent the browser from throttling RAF when the window is
// backgrounded so diagnostics dumps reflect real perf.
const GAME_ARGS = [
  "--no-sandbox",
  "--use-angle=gl",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--mute-audio",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  workers: IS_CI ? 1 : undefined,
  timeout: IS_CI ? 90_000 : 60_000,
  reporter: IS_CI ? [["github"], ["json", { outputFile: "test-results/results.json" }]] : [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:41731",
    headless: IS_HEADLESS,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: IS_CI ? 30_000 : 15_000,
    navigationTimeout: IS_CI ? 30_000 : 15_000,
    browserName: "chromium",
    channel: CHROMIUM_CHANNEL,
    launchOptions: { args: GAME_ARGS },
  },
  projects: [
    {
      name: "mobile-portrait",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-landscape",
      use: { ...devices["Pixel 7"], viewport: { width: 844, height: 390 } },
    },
    {
      name: "tablet-portrait",
      use: { ...devices["iPad (gen 7)"], viewport: { width: 834, height: 1194 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    // Unique per-repo port so we never accidentally bind to (or reuse)
    // another project's dev server. 41731 is arbitrary but distinct from
    // the ones mean-streets / cosmic-gardener / arcade-cabinet use.
    command: "pnpm exec vite preview --host 127.0.0.1 --port 41731",
    url: "http://127.0.0.1:41731",
    reuseExistingServer: REUSE_SERVER,
    timeout: 120_000,
  },
});
