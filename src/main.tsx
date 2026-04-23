// Must import before pixi.js is loaded elsewhere — patches the WebGL
// renderer to use pre-compiled shader programs instead of runtime
// dynamic compilation. Required for Capacitor's strict CSP and for
// Vite's dev-mode CSP. The side-effect import is intentional.
import "pixi.js/unsafe-eval";

import React from "react";
import { createRoot } from "react-dom/client";
import "@/theme/global.css";
import Game from "@/ui/Game";

const mountNode = document.getElementById("root");
if (!mountNode) {
  throw new Error("Missing #root element — check index.html");
}

createRoot(mountNode).render(
  <React.StrictMode>
    <Game />
  </React.StrictMode>
);
