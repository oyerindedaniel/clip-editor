import React, { useRef, useLayoutEffect, useCallback } from "react";

type Size = {
  width: number;
  height: number;
};

export function useElementSize<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>;
  sizeRef: React.RefObject<Size>;
} {
  const ref = useRef<T | null>(null);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });

  const updateSizeVars = useCallback(
    (width: number, height: number, element: T) => {
      element.style.setProperty("--width", `${width}px`);
      element.style.setProperty("--height", `${height}px`);
    },
    []
  );

  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (!entry) return;

    const { width, height } = entry.contentRect;
    const current = sizeRef.current;

    if (current.width !== width || current.height !== height) {
      sizeRef.current = { width, height };

      const element = ref.current;
      if (element) updateSizeVars(width, height, element);
    }
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(handleResize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [handleResize]);

  return { ref, sizeRef };
}
