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
