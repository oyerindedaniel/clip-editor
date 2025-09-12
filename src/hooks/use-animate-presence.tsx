"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useStableHandler } from "./use-stable-handler";
import logger from "@/utils/logger";

interface AnimatePresenceOptions {
  animateOnInitialLoad?: boolean;
  timeout?: number; // Timeout for animation in ms
}

export function useAnimatePresence(
  externalPresence: boolean,
  onAnimate: (presence: boolean) => Promise<void>,
  options: AnimatePresenceOptions = {}
): boolean {
  const { animateOnInitialLoad = true, timeout = 400 } = options;

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
          setInternalPresence(presence);
        }
      } catch (error) {
        logger.warn("Animation failed:", error);
        if (currentAnimationIdRef.current === animationId) {
          setInternalPresence(presence);
        }
      } finally {
        clearAnimationTimeout();
      }
    },
    [onAnimateRef, timeout, clearAnimationTimeout]
  );

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      if (!animateOnInitialLoad) {
        return;
      }
    }

    const animationId = ++currentAnimationIdRef.current;
    handleAnimation(externalPresence, animationId);

    return (): void => {
      clearAnimationTimeout();
      currentAnimationIdRef.current++;
    };
  }, [
    externalPresence,
    animateOnInitialLoad,
    handleAnimation,
    clearAnimationTimeout,
  ]);

  return useMemo(() => {
    return externalPresence
      ? internalPresence && externalPresence
      : internalPresence || externalPresence;
  }, [externalPresence, internalPresence]);
}
