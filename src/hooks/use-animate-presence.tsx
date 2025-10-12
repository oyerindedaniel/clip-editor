"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useStableHandler } from "./use-stable-handler";
import logger from "@/utils/logger";

interface AnimatePresenceOptions {
  initial?: boolean;
  timeout?: number; // Timeout for animation in ms
  forceMount?: boolean;
}

export type AnimationState = "idle" | "entering" | "exiting";

export function useAnimatePresence(
  externalPresence: boolean,
  onAnimate: (presence: boolean) => Promise<void>,
  options: AnimatePresenceOptions = {}
): boolean {
  const { initial = true, forceMount = false, timeout = 10000 } = options;

  const [internalPresence, setInternalPresence] =
    useState<boolean>(externalPresence);

  const isInitialRender = useRef(true);
  const onAnimateRef = useStableHandler(onAnimate);

  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentAnimationIdRef = useRef<number>(0);

  const clearAnimationTimeout = useCallback((): void => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  const handleAnimation = useCallback(
    async (presence: boolean, animationId: number): Promise<void> => {
      clearAnimationTimeout();

      try {
        await Promise.race([
          onAnimateRef(presence),
          new Promise<void>((_, reject) => {
            animationTimeoutRef.current = setTimeout(() => {
              reject(
                new Error(
                  `Animation timeout after ${timeout}ms for presence=${presence}`
                )
              );
            }, timeout);
          }),
        ]);

        if (currentAnimationIdRef.current === animationId) {
          if (!forceMount) {
            setInternalPresence(presence);
          } else {
            if (presence) setInternalPresence(true);
          }
        }
      } catch (error) {
        // You may see this warning in edge cases—for example, when an animation is
        // running and the user switches windows or tabs mid-transition. It can be
        // safely ignored, as the animation will resolve correctly (animate out)
        // once the window regains focus.
        logger.warn("Animation failed:", error);
        if (currentAnimationIdRef.current === animationId) {
          if (!forceMount) {
            setInternalPresence(presence);
          } else {
            if (presence) setInternalPresence(true);
          }
        }
      } finally {
        clearAnimationTimeout();
      }
    },
    [timeout, clearAnimationTimeout]
  );

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      if (!initial) {
        return;
      }
    }

    const animationId = ++currentAnimationIdRef.current;
    handleAnimation(externalPresence, animationId);

    return (): void => {
      clearAnimationTimeout();
      currentAnimationIdRef.current++;
    };
  }, [externalPresence, initial, handleAnimation, clearAnimationTimeout]);

  return useMemo(() => {
    if (forceMount) return true;
    return externalPresence
      ? internalPresence && externalPresence
      : internalPresence || externalPresence;
  }, [externalPresence, internalPresence, forceMount]);
}

export function getState(animationState?: string) {
  switch (animationState) {
    case "entering":
      return "open";
    case "exiting":
      return "closed";
    default:
      return undefined;
  }
}
