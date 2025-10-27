import { useEffect } from "react";
import { useLatestValue } from "@/hooks/use-latest-value";
import { globalRAF } from "@/lib/raf-manager";

export function useRAF(
  callback: (time: number, deltaTime: number) => void,
  enabled = true
): void {
  const callbackRef = useLatestValue(callback);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = globalRAF.subscribe((time, deltaTime) => {
      callbackRef.current(time, deltaTime);
    });

    return unsubscribe;
  }, [enabled, callbackRef]);
}
