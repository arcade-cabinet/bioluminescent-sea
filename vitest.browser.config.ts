import path from "node:path";
import { defineConfig } from "vitest/config";

// Real-Chromium tests via @vitest/browser-playwright for canvas rendering + touch input.
export default defineConfig({
  test: {
    include: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
    exclude: ["node_modules/**", "e2e/**"],
    passWithNoTests: true,
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
