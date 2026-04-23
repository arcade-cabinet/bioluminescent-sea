import { useCallback, useEffect, useRef } from "react";
import { isRuntimePaused } from "@/lib/runtimePause";

export type GameLoopCallback = (deltaTime: number, totalTime: number) => void;

export function useGameLoop(callback: GameLoopCallback, isRunning: boolean) {
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const totalTimeRef = useRef<number>(0);

  const animate = useCallback(
    (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = Math.min((time - previousTimeRef.current) / 1000, 0.1);
        if (!isRuntimePaused()) {
          totalTimeRef.current += deltaTime;
          callback(deltaTime, totalTimeRef.current);
        }
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    },
    [callback]
  );

  useEffect(() => {
    if (isRunning) {
      previousTimeRef.current = undefined;
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, animate]);

  const reset = useCallback(() => {
    totalTimeRef.current = 0;
    previousTimeRef.current = undefined;
  }, []);

  return { reset, totalTime: totalTimeRef.current };
}
