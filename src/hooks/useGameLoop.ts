import { useCallback, useEffect, useRef } from "react";
import { isRuntimePaused } from "@/lib/runtimePause";

export type GameLoopCallback = (deltaTime: number, totalTime: number) => void;

export function useGameLoop(callback: GameLoopCallback, isRunning: boolean) {
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const totalTimeRef = useRef<number>(0);

  // Keep a live ref to the latest callback. The RAF loop reads
  // callbackRef.current each frame instead of closing over `callback`
  // directly — that way changes to the callback don't cancel and
  // restart the RAF chain. Without this, every touch (which changes
  // React state → new gameLoop → new animate) dropped the in-flight
  // frame, producing visible tap-lag on mobile.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!isRunning) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      return undefined;
    }

    previousTimeRef.current = undefined;
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = Math.min((time - previousTimeRef.current) / 1000, 0.1);
        if (!isRuntimePaused()) {
          totalTimeRef.current += deltaTime;
          callbackRef.current(deltaTime, totalTimeRef.current);
        }
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isRunning]);

  const reset = useCallback(() => {
    totalTimeRef.current = 0;
    previousTimeRef.current = undefined;
  }, []);

  return { reset, totalTime: totalTimeRef.current };
}
