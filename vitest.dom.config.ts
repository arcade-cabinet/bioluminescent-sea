import path from "node:path";
import { defineConfig } from "vitest/config";

// jsdom tests for presentational React components that don't need a real WebGL/Canvas.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/ui/**/*.dom.test.ts", "src/ui/**/*.dom.test.tsx"],
    exclude: ["e2e/**", "node_modules/**"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
