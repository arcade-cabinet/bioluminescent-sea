import { useCallback, useEffect, useRef, useState } from "react";

export interface InputPosition {
  x: number;
  y: number;
  isActive: boolean;
}

export function useTouchInput(containerRef: React.RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<InputPosition>({
    x: 0,
    y: 0,
    isActive: false,
  });
  const lastPosition = useRef({ x: 0, y: 0 });

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
      const pos = getRelativePosition(e.clientX, e.clientY);
      lastPosition.current = pos;
      setPosition({ ...pos, isActive: true });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const pos = getRelativePosition(e.clientX, e.clientY);
      lastPosition.current = pos;
      setPosition((prev) => (prev.isActive ? { ...pos, isActive: true } : prev));
    };

    const handlePointerUp = () => {
      setPosition((prev) => ({ ...prev, isActive: false }));
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

  return position;
}
