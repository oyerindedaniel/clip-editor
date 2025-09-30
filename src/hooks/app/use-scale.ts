import { useCallback, useEffect, useMemo, useState } from "react";
import { useLatestValue } from "../use-latest-value";

/**
 * Fixed scaling configuration - always uses the specified pixels per second.
 */
type FixedScalingConfig = {
  type: "fixed";
  fixedPxPerSecond: number;
};

/**
 * Container-based scaling configuration - scales timeline
 * proportionally to the container width.
 */
type ContainerScalingConfig = {
  type: "container";
};

/**
 * Auto scaling configuration - chooses between fixed scaling
 * and container-based scaling depending on container width and
 * min/max usability constraints.
 */
type AutoScalingConfig = {
  type: "auto";
  fixedPxPerSecond: number;
  minPxPerSecond?: number;
  maxPxPerSecond?: number;
};

/**
 * Union of supported scaling configurations.
 */
type UseScaleConfig =
  | FixedScalingConfig
  | ContainerScalingConfig
  | AutoScalingConfig;

/**
 * Possible scaling modes currently in effect.
 */
type ScalingType = "fixed" | "container" | "auto";

/**
 * React hook for calculating timeline scaling (pixels per millisecond).
 * Supports fixed, container-based, and auto scaling strategies.
 */
export function useScale({
  containerRef,
  durationMs,
  paddingPx = 0,
  ...config
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  durationMs: number;
  paddingPx?: number;
} & UseScaleConfig) {
  const [pxPerMs, setPxPerMs] = useState(0);
  const [currentScalingType, setCurrentScalingType] =
    useState<ScalingType>("auto");
  const configRef = useLatestValue(config);

  const recalc = useCallback(() => {
    const config = configRef.current;

    if (config.type === "fixed") {
      const value = config.fixedPxPerSecond / 1000;
      setPxPerMs(value);
      setCurrentScalingType("fixed");
      return;
    }

    if (config.type === "container") {
      const el = containerRef.current;
      if (!el) return;

      const usableWidth = Math.max(0, el.clientWidth - paddingPx);
      const containerPxPerMs =
        durationMs > 0 && usableWidth > 0 ? usableWidth / durationMs : 0.05;

      setPxPerMs(containerPxPerMs);
      setCurrentScalingType("container");
      return;
    }

    if (config.type === "auto") {
      const el = containerRef.current;
      if (!el) return;

      const usableWidth = Math.max(0, el.clientWidth - paddingPx);
      const containerPxPerMs =
        durationMs > 0 && usableWidth > 0 ? usableWidth / durationMs : 0;
      const fixedPxPerMs = config.fixedPxPerSecond / 1000;

      const containerPxPerSecond = containerPxPerMs * 1000;

      const minPxPerSecond = config.minPxPerSecond ?? config.fixedPxPerSecond;
      const isContainerTooSmall = containerPxPerSecond < minPxPerSecond;

      const isContainerTooLarge =
        config.maxPxPerSecond && containerPxPerSecond > config.maxPxPerSecond;

      const isContainerWiderThanWindow = el.clientWidth > window.innerWidth;

      let finalValue: number;
      if (
        isContainerTooSmall ||
        isContainerTooLarge ||
        isContainerWiderThanWindow
      ) {
        finalValue = fixedPxPerMs;
        setPxPerMs(finalValue);
        setCurrentScalingType("fixed");
      } else {
        finalValue = containerPxPerMs;
        setPxPerMs(finalValue);
        setCurrentScalingType("container");
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

  const rawPxPerMs = pxPerMs + paddingPx / durationMs;

  return {
    pxPerMs,
    rawPxPerMs,
    recalc,
    currentScalingType,
  };
}
