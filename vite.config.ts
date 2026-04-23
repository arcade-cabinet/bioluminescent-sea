import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages deploys to /bioluminescent-sea/; local dev stays at /.
const base = process.env.GITHUB_PAGES === "true" ? "/bioluminescent-sea/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
