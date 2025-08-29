import { useRef, useCallback, useEffect } from "react";

interface UseScaleProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  durationMs: number;
  fixedPxPerSecond?: number;
  useFixedScaling?: boolean;
}

export function useScale({
  containerRef,
  durationMs,
  fixedPxPerSecond = 100,
  useFixedScaling = false,
}: UseScaleProps) {
  const pxPerMsRef = useRef(0);

  const recalc = useCallback(() => {
    if (useFixedScaling) {
      pxPerMsRef.current = fixedPxPerSecond / 1000;
    } else {
      const el = containerRef.current;
      if (!el) return;
      const width = el.clientWidth;
      pxPerMsRef.current = durationMs > 0 && width > 0 ? width / durationMs : 0;
    }
  }, [containerRef, durationMs, fixedPxPerSecond, useFixedScaling]);

  useEffect(() => {
    recalc();
    if (!useFixedScaling) {
      window.addEventListener("resize", recalc);
      return () => window.removeEventListener("resize", recalc);
    }
  }, [recalc, useFixedScaling]);

  return { pxPerMsRef, recalc };
}
