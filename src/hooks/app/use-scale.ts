import { useRef, useCallback, useEffect } from "react";
import { useLatestValue } from "../use-latest-value";

/**
 * Fixed scaling configuration - always uses the specified pixels per second
 */
type FixedScalingConfig = {
  type: "fixed";
  fixedPxPerSecond: number;
};

/**
 * Container-based scaling configuration - scales based on container width
 */
type ContainerScalingConfig = {
  type: "container";
};

/**
 * Auto scaling configuration - automatically switches between fixed and container scaling
 * based on container size and minimum usability constraints
 */
type AutoScalingConfig = {
  type: "auto";
  fixedPxPerSecond: number;
  minPxPerSecond?: number;
  maxPxPerSecond?: number;
};

type UseScaleConfig =
  | FixedScalingConfig
  | ContainerScalingConfig
  | AutoScalingConfig;

type ScalingType = "fixed" | "container" | "auto";

interface UseScaleReturn {
  pxPerMsRef: React.RefObject<number>;
  recalc: () => void;
  currentScalingType: ScalingType;
}

export function useScale({
  containerRef,
  durationMs,
  ...config
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  durationMs: number;
} & UseScaleConfig): UseScaleReturn {
  const pxPerMsRef = useRef(0);
  const currentScalingTypeRef = useRef<ScalingType>("container");
  const configRef = useLatestValue(config);

  const recalc = useCallback(() => {
    const config = configRef.current;

    if (config.type === "fixed") {
      pxPerMsRef.current = config.fixedPxPerSecond / 1000;
      currentScalingTypeRef.current = "fixed";
      return;
    }

    if (config.type === "container") {
      const el = containerRef.current;
      if (!el) return;

      const width = el.clientWidth;
      const containerPxPerMs =
        durationMs > 0 && width > 0 ? width / durationMs : 0;

      pxPerMsRef.current = containerPxPerMs;
      currentScalingTypeRef.current = "container";
      return;
    }

    if (config.type === "auto") {
      const el = containerRef.current;
      if (!el) return;

      const width = el.clientWidth;
      const containerPxPerMs =
        durationMs > 0 && width > 0 ? width / durationMs : 0;
      const fixedPxPerMs = config.fixedPxPerSecond / 1000;

      const containerPxPerSecond = containerPxPerMs * 1000;

      const minPxPerSecond = config.minPxPerSecond ?? config.fixedPxPerSecond;
      const isContainerTooSmall = containerPxPerSecond < minPxPerSecond;

      const isContainerTooLarge =
        config.maxPxPerSecond && containerPxPerSecond > config.maxPxPerSecond;

      if (isContainerTooSmall || isContainerTooLarge) {
        pxPerMsRef.current = fixedPxPerMs;
        currentScalingTypeRef.current = "auto";
      } else {
        pxPerMsRef.current = containerPxPerMs;
        currentScalingTypeRef.current = "auto";
      }
    }
  }, [durationMs]);

  useEffect(() => {
    recalc();

    if (config.type === "container" || config.type === "auto") {
      window.addEventListener("resize", recalc);
      return () => window.removeEventListener("resize", recalc);
    }
  }, [recalc, config.type]);

  return {
    pxPerMsRef,
    recalc,
    currentScalingType: currentScalingTypeRef.current,
  };
}
