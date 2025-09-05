import { useRef, useCallback } from "react";

interface UseAutoScrollOptions {
  edgeThreshold?: number; // Distance from edge (px) where scroll starts
  maxScrollSpeed?: number; // Max scroll speed (px per frame)
  acceleration?: number; // Curve factor for acceleration near edge
}

export function useAutoScroll({
  edgeThreshold = 80,
  maxScrollSpeed = 25,
  acceleration = 2.5,
}: UseAutoScrollOptions = {}) {
  const isInitializedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastMouseEventRef = useRef<MouseEvent | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onScrollChangeRef = useRef<
    ((scrollDelta: number, currentScrollLeft: number) => void) | null
  >(null);

  const calculateScrollSpeed = useCallback(
    (distanceFromEdge: number) => {
      if (distanceFromEdge >= edgeThreshold) return 0;
      const proximity = 1 - distanceFromEdge / edgeThreshold;
      const accelerated = Math.pow(proximity, acceleration);
      return accelerated * maxScrollSpeed;
    },
    [edgeThreshold, maxScrollSpeed, acceleration]
  );

  const loop = useCallback(() => {
    if (!isInitializedRef.current) return;

    const container = containerRef.current;
    const event = lastMouseEventRef.current;

    if (container && event) {
      const rect = container.getBoundingClientRect();
      const MARGIN = 50;
      const rawMouseX: number = event.clientX;
      const minX: number = rect.left - MARGIN;
      const maxX: number = rect.right + MARGIN;
      const mouseX: number = Math.max(minX, Math.min(rawMouseX, maxX));

      const distanceFromLeft = mouseX - rect.left;
      const distanceFromRight = rect.right - mouseX;

      let scrollDirection = 0;
      let speed = 0;

      if (distanceFromLeft < edgeThreshold) {
        scrollDirection = -1;
        speed = calculateScrollSpeed(distanceFromLeft);
      } else if (distanceFromRight < edgeThreshold) {
        scrollDirection = 1;
        speed = calculateScrollSpeed(distanceFromRight);
      }

      if (scrollDirection !== 0 && speed > 0) {
        const oldScrollLeft = container.scrollLeft;
        const newScrollLeft = container.scrollLeft + scrollDirection * speed;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        const clampedScrollLeft = Math.max(
          0,
          Math.min(newScrollLeft, maxScrollLeft)
        );

        container.scrollLeft = clampedScrollLeft;

        const scrollDelta = clampedScrollLeft - oldScrollLeft;
        if (scrollDelta !== 0 && onScrollChangeRef.current) {
          onScrollChangeRef.current(scrollDelta, clampedScrollLeft);
        }
      }
    }

    rafIdRef.current = requestAnimationFrame(loop);
  }, [calculateScrollSpeed, edgeThreshold]);

  const handleAutoScroll = useCallback((event: MouseEvent) => {
    lastMouseEventRef.current = event;
  }, []);

  const startAutoScroll = useCallback(
    (
      container: HTMLDivElement | null,
      onScrollChange?: (scrollDelta: number, currentScrollLeft: number) => void
    ) => {
      if (!isInitializedRef.current && container) {
        containerRef.current = container;
        isInitializedRef.current = true;
        onScrollChangeRef.current = onScrollChange || null;

        rafIdRef.current = requestAnimationFrame(loop);
      }
    },
    [loop]
  );

  const stopAutoScroll = useCallback(() => {
    isInitializedRef.current = false;
    containerRef.current = null;
    onScrollChangeRef.current = null;
    lastMouseEventRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  return {
    handleAutoScroll,
    startAutoScroll,
    stopAutoScroll,
  };
}
