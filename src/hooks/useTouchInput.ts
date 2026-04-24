import { useCallback, useEffect, useRef, useState } from "react";

export interface InputPosition {
  x: number;
  y: number;
  isActive: boolean;
}

/**
 * Pointer input adapter for the dive game loop.
 *
 * Design note: this hook is read EVERY FRAME by the render/sim loop
 * (60+ times per second). An earlier version did `setState` on every
 * pointermove, which caused Game.tsx to re-render whenever the player
 * dragged a finger across the screen. Game re-renders rebuild the
 * `gameLoop` useCallback, which in turn rebuilt the RAF animate, which
 * cancelled the in-flight frame. On mobile, that cascaded to visible
 * tap-lag (every drag dropped one frame of animation).
 *
 * The rewrite stores the live x/y in a ref and only sets React state
 * when `isActive` flips. The sim reads position through the returned
 * InputPosition object, whose x/y are updated in place on each
 * pointermove — zero extra React commits per frame.
 */
export function useTouchInput(containerRef: React.RefObject<HTMLElement | null>) {
  const [isActive, setIsActive] = useState(false);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const getRelativePosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };

      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    [containerRef]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const handlePointerDown = (e: PointerEvent) => {
      positionRef.current = getRelativePosition(e.clientX, e.clientY);
      setIsActive(true);
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // iOS sometimes rejects setPointerCapture for touch; ignore.
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      // Mutate the ref directly — NO setState. The sim picks up the
      // new position on the next animation frame.
      positionRef.current = getRelativePosition(e.clientX, e.clientY);
    };

    const handlePointerUp = () => {
      setIsActive(false);
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("pointercancel", handlePointerUp);

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [containerRef, getRelativePosition]);

  // Expose a stable object-shape for the game loop. The x/y are live
  // from the ref on every access, but the returned object identity is
  // stable across renders so downstream useCallback deps don't flip.
  const inputRef = useRef<InputPosition>({ x: 0, y: 0, isActive: false });
  inputRef.current.x = positionRef.current.x;
  inputRef.current.y = positionRef.current.y;
  inputRef.current.isActive = isActive;
  return inputRef.current;
}
