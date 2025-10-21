"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useAnimatePresence } from "../use-animate-presence";

type UseStackedTransitionOptions<K extends string> = {
  duration?: number; // in ms
  forceMount?: boolean;
  keys: readonly [K, K];
  defaultActive: NoInfer<K>;
  initial?: boolean; // if false, skip first animation
};

export function useStackedTransition<const K extends string>(
  options: UseStackedTransitionOptions<K>
) {
  const {
    duration = 250,
    forceMount = false,
    defaultActive,
    keys,
    initial = false,
  } = options;

  // We mimic an internal active state here because `useAnimatePresence` only manages
  // animation lifecycle (idle → entering → exiting). In this hook, however, the
  // keyframe assignment depends directly on the `active` key — not an explicit animation state.
  // So, when `initial` is false, we start with `null` to ensure no keyframes are applied
  // until the user toggles. This avoids running a visual animation on mount while still
  // keeping the external `active` always typed as `K` for consumer consistency.
  const [internalActive, setInternalActive] = useState<K | null>(
    initial ? defaultActive : null
  );

  const [animating, setAnimating] = useState(false);

  const active: K = internalActive ?? defaultActive;

  const pendingAnimations = useRef(0);

  const refs = {
    [keys[0]]: useRef<HTMLElement>(null),
    [keys[1]]: useRef<HTMLElement>(null),
  } as Record<K, React.RefObject<HTMLElement>>;

  const handleAnimate = useCallback(
    (presence: boolean, ref: React.RefObject<HTMLElement>, key: K) => {
      return new Promise<void>((resolve) => {
        const el = ref.current;

        if (presence) {
          if (forceMount && el) el.style.removeProperty("display");
          resolve();
          return;
        }

        if (!el) return;

        // EXIT animation: track until it ends
        pendingAnimations.current++;
        setAnimating(true);

        const onEnd = () => {
          el.removeEventListener("animationend", onEnd);

          pendingAnimations.current = Math.max(
            0,
            pendingAnimations.current - 1
          );
          if (pendingAnimations.current === 0) setAnimating(false);

          if (forceMount) el.style.display = "none";
          resolve();
        };

        el.addEventListener("animationend", onEnd);
      });
    },
    [forceMount, active]
  );

  const presenceMap = {
    [keys[0]]: useAnimatePresence(
      active === keys[0],
      (presence) => handleAnimate(presence, refs[keys[0]], keys[0]),
      { initial, forceMount }
    ),
    [keys[1]]: useAnimatePresence(
      active === keys[1],
      (presence) => handleAnimate(presence, refs[keys[1]], keys[1]),
      { initial, forceMount }
    ),
  } as Record<K, boolean>;

  const toggle = useCallback(() => {
    if (animating) return;
    setInternalActive((prev) => {
      if (prev === null) {
        return defaultActive === keys[0] ? keys[1] : keys[0];
      }
      return prev === keys[0] ? keys[1] : keys[0];
    });
  }, [animating, keys, defaultActive]);

  const shared =
    "absolute inset-0 w-full h-full overflow-hidden object-cover origin-center will-change-[transform,opacity,filter] backface-hidden";

  const classNames = useMemo(() => {
    const map = {} as Record<K, string>;
    keys.forEach((key) => {
      const isActive = internalActive === key;
      const layer = isActive ? "z-20" : "z-10";

      const transition =
        internalActive === null
          ? ""
          : isActive
          ? "animate-[stack-in_var(--stack-duration)_cubic-bezier(0.4,0,0.2,1)_forwards] pointer-events-auto"
          : "animate-[stack-out_var(--stack-duration)_cubic-bezier(0.4,0,0.2,1)_forwards] pointer-events-none";
      map[key] = `${shared} ${layer} ${transition}`;
    });
    return map;
  }, [internalActive, keys]);

  const styles = useMemo(() => {
    const baseStyle = {
      "--stack-duration": `${duration}ms`,
    } as React.CSSProperties;

    const isInitialNull = internalActive === null;
    const nonDefaultKey = defaultActive === keys[0] ? keys[1] : keys[0];

    return {
      [keys[0]]: {
        ...baseStyle,
        display:
          isInitialNull && keys[0] === nonDefaultKey ? "none" : undefined,
      },
      [keys[1]]: {
        ...baseStyle,
        display:
          isInitialNull && keys[1] === nonDefaultKey ? "none" : undefined,
      },
    } as Record<K, React.CSSProperties>;
  }, [duration, keys, internalActive, defaultActive]);

  const parentClassName =
    "relative [perspective:1200px] [perspective-origin:center_center] overflow-hidden";

  return {
    refs,
    classNames,
    styles,
    toggle,
    active,
    present: presenceMap,
    animating,
    parentClassName,
  };
}
