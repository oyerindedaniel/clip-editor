import { useEffect } from "react";
import { globalRAF } from "@/lib/raf-manager";
import { useStableHandler } from "./use-stable-handler";

/**
 * Subscribe to global RAF with optional ID.
 * @param callback - Function to call on each frame
 * @param enabled - Whether RAF should run
 * @param id - Optional unique ID for this RAF callback. Only needed if you want to trigger it manually from elsewhere.
 */
export function useRAF(
  callback: (time: number, deltaTime: number) => void,
  enabled: boolean = true,
  id?: string
): void {
  const stableCallback = useStableHandler(callback);

  useEffect(() => {
    if (!enabled) return;

    return globalRAF.subscribe((time, deltaTime) => {
      stableCallback(time, deltaTime);
    }, id);
  }, [enabled, id]);
}

/**
 * Register a manual RAF trigger handler for a specific ID.
 * Useful when you want to manually fire a RAF callback outside the normal loop.
 * @param id - Unique identifier for the trigger
 * @param callback - Function executed when the trigger fires
 */
export function useRAFTrigger(
  id: string,
  callback: (time: number, deltaTime: number) => void
): void {
  const stableCallback = useStableHandler(callback);

  useEffect(() => {
    return globalRAF.registerTriggerHandler(id, (time, deltaTime) => {
      stableCallback(time, deltaTime);
    });
  }, [id]);
}
