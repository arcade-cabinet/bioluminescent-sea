import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

interface GameViewportProps extends HTMLAttributes<HTMLDivElement> {
  background?: string;
  children?: ReactNode;
}

/**
 * Fills the available parent space at a fixed aspect, with `100svh` fallback
 * so mobile browsers with retracting address bars don't collapse the canvas.
 */
export const GameViewport = forwardRef<HTMLDivElement, GameViewportProps>(
  function GameViewport({ background = "#050a14", style, children, ...rest }, ref) {
    const merged: CSSProperties = {
      position: "relative",
      width: "100%",
      height: "100%",
      minHeight: "100svh",
      background,
      overflow: "hidden",
      ...style,
    };
    return (
      <div ref={ref} style={merged} {...rest}>
        {children}
      </div>
    );
  }
);
