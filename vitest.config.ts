import path from "node:path";
import { defineConfig } from "vitest/config";

// Node-only: pure simulation / lib logic. No DOM, no framer-motion.
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: [
      "src/engine/**/*.test.ts",
      "src/lib/**/*.test.ts",
      "src/sim/**/*.test.ts",
      "src/ecs/**/*.test.ts",
      "src/data/**/*.test.ts",
    ],
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
