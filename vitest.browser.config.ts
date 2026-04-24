import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Real-Chromium tests via @vitest/browser-playwright. Used by the GOAP-bot
// per-mode integration test that mounts <Game> with a synthetic input
// provider in lieu of touch events.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
    exclude: ["node_modules/**", "e2e/**"],
    passWithNoTests: true,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
