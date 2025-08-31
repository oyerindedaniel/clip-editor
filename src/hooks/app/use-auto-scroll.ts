import { useRef, useCallback } from "react";

interface UseAutoScrollOptions {
  edgeThreshold?: number; // Distance from edge (px) where scroll starts
  maxScrollSpeed?: number; // Max scroll speed (px per frame)
  acceleration?: number; // Curve factor for acceleration near edge
}

interface UseAutoScrollReturn {
  handleDragMove: (event: MouseEvent) => void;
  startAutoScroll: (
    containerRef: React.RefObject<HTMLDivElement | null>,
    onScrollChange?: (scrollDelta: number) => void
  ) => void;
  stopAutoScroll: () => void;
}

export function useAutoScroll({
  edgeThreshold = 80,
  maxScrollSpeed = 25,
  acceleration = 2.5,
}: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const isAutoScrollingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastMouseEventRef = useRef<MouseEvent | null>(null);
  const onScrollChangeRef = useRef<((scrollDelta: number) => void) | null>(
    null
  );

  const calculateScrollSpeed = useCallback(
    (distanceFromEdge: number) => {
      if (distanceFromEdge >= edgeThreshold) return 0;
      const proximity = 1 - distanceFromEdge / edgeThreshold;
      const accelerated = Math.pow(proximity, acceleration);
      return accelerated * maxScrollSpeed;
    },
    [edgeThreshold, maxScrollSpeed, acceleration]
  );

  const loop = useCallback(
    (containerRef: React.RefObject<HTMLDivElement | null>) => {
      if (!isAutoScrollingRef.current) return;
      const container = containerRef.current;
      const event = lastMouseEventRef.current;
      if (container && event) {
        const rect = container.getBoundingClientRect();
        const mouseX = event.clientX;

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
            onScrollChangeRef.current(scrollDelta);
          }
        }
      }
      rafIdRef.current = requestAnimationFrame(() => loop(containerRef));
    },
    [calculateScrollSpeed, edgeThreshold]
  );

  const handleDragMove = useCallback((event: MouseEvent) => {
    lastMouseEventRef.current = event;
  }, []);

  const startAutoScroll = useCallback(
    (
      containerRef: React.RefObject<HTMLDivElement | null>,
      onScrollChange?: (scrollDelta: number) => void
    ) => {
      if (!isAutoScrollingRef.current) {
        isAutoScrollingRef.current = true;
        onScrollChangeRef.current = onScrollChange || null;
        rafIdRef.current = requestAnimationFrame(() => loop(containerRef));
      }
    },
    [loop]
  );

  const stopAutoScroll = useCallback(() => {
    isAutoScrollingRef.current = false;
    onScrollChangeRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  return {
    handleDragMove,
    startAutoScroll,
    stopAutoScroll,
  };
}
