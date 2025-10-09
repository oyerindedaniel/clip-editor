"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useAnimatePresence } from "../use-animate-presence";

type UseStackedTransitionOptions<T extends string> = {
  duration?: number;
  unmount?: boolean;
  defaultActive: T;
  keys: readonly [T, T];
};

export function useStackedTransition<const T extends string>(
  options: UseStackedTransitionOptions<T>
) {
  const { duration = 700, unmount = false, defaultActive, keys } = options;

  const [active, setActive] = useState<T>(defaultActive);
  const [animating, setAnimating] = useState(false);

  const refs = {
    [keys[0]]: useRef<HTMLElement>(null),
    [keys[1]]: useRef<HTMLElement>(null),
  } as Record<T, React.RefObject<HTMLElement>>;

  const handleAnimate = useCallback(
    (presence: boolean, ref: React.RefObject<HTMLElement>, key: T) => {
      return new Promise<void>((resolve) => {
        const el = ref.current;
        if (!el) return resolve();
        setAnimating(true);

        const onEnd = () => {
          el.removeEventListener("animationend", onEnd);
          if (!unmount) el.style.display = presence ? "" : "none";
          if (key === active || !presence) setAnimating(false);
          resolve();
        };

        el.addEventListener("animationend", onEnd);
      });
    },
    [unmount, active]
  );

  const presenceMap = {
    [keys[0]]: useAnimatePresence(
      active === keys[0],
      (presence) => handleAnimate(presence, refs[keys[0]], keys[0]),
      { initial: false, timeout: 10000 }
    ),
    [keys[1]]: useAnimatePresence(
      active === keys[1],
      (presence) => handleAnimate(presence, refs[keys[1]], keys[1]),
      { initial: false, timeout: 10000 }
    ),
  } as Record<T, boolean>;

  const toggle = useCallback(() => {
    if (animating) return;
    setActive((prev) => (prev === keys[0] ? keys[1] : keys[0]));
  }, [animating, keys]);

  const shared =
    "absolute inset-0 w-full h-full object-cover transition-all ease-in-out will-change-transform";

  const classNames = useMemo(() => {
    const map = {} as Record<T, string>;
    keys.forEach((key) => {
      const isActive = active === key;

      const layer = isActive ? "z-20" : "z-10";
      const visibility = isActive ? "opacity-100 blur-0" : "opacity-0 blur-sm";
      const transition = isActive
        ? "animate-[stack-in_var(--stack-duration)_ease-in-out_forwards]"
        : "animate-[stack-out_var(--stack-duration)_ease-in-out_forwards]";
      map[key] = `${shared} ${layer} ${visibility} ${transition}`;
    });
    return map;
  }, [active, keys]);

  const styles = useMemo(() => {
    const style = {
      "--stack-duration": `${duration}ms`,
    } as React.CSSProperties;
    return { [keys[0]]: style, [keys[1]]: style } as Record<
      T,
      React.CSSProperties
    >;
  }, [duration, keys]);

  return {
    refs,
    classNames,
    styles,
    toggle,
    active,
    present: presenceMap,
    animating,
  };
}
