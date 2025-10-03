import { useCallback, useEffect, useState } from "react";
import { useLatestValue } from "../use-latest-value";

/**
 * Fixed scaling configuration - always uses the specified pixels per second.
 */
type FixedScalingConfig = {
  type: "fixed";
  fixedPxPerSecond: number;
};

/**
 * Container-based scaling configuration - scales timeline to fit the scroll container.
 */
type ContainerScalingConfig = {
  type: "container";
};

/**
 * Auto scaling configuration - chooses between fixed scaling
 * and container-based scaling depending on scroll container width and
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
 *
 * @param containerRef - ref to the scroll container
 * @param durationMs - total timeline duration in milliseconds
 * @param paddingPx - optional padding to subtract from container/timeline width
 * @param config - scaling configuration (fixed, container, or auto)
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
  const FALLBACK_PX_PER_MS = 0.05;

  const [pxPerMs, setPxPerMs] = useState(0);
  const [currentScalingType, setCurrentScalingType] =
    useState<ScalingType>("auto");
  const configRef = useLatestValue(config);

  const recalc = useCallback(() => {
    const config = configRef.current;
    const containerEl = containerRef.current;

    if (!containerEl) return;

    const containerWidth = containerEl.clientWidth;
    const usableWidth = Math.max(0, containerWidth - paddingPx);

    const fixedPxPerMs =
      config.type !== "container" ? config.fixedPxPerSecond / 1000 : 0;

    let newPxPerMs: number;
    let newScalingType: ScalingType = "fixed";

    if (config.type === "fixed") {
      newPxPerMs = fixedPxPerMs;
      newScalingType = "fixed";
    } else if (config.type === "container") {
      newPxPerMs =
        durationMs > 0 ? usableWidth / durationMs : FALLBACK_PX_PER_MS;
      newScalingType = "container";
    } else if (config.type === "auto") {
      const containerPxPerMs =
        durationMs > 0 ? usableWidth / durationMs : FALLBACK_PX_PER_MS;

      const containerPxPerSecond = containerPxPerMs * 1000;
      const minPxPerSecond = config.minPxPerSecond ?? config.fixedPxPerSecond;
      const isTooSmall = containerPxPerSecond < minPxPerSecond;
      const isTooLarge =
        config.maxPxPerSecond && containerPxPerSecond > config.maxPxPerSecond;

      if (!isTooSmall && !isTooLarge) {
        newPxPerMs = containerPxPerMs;
        newScalingType = "container";
      } else {
        newPxPerMs = fixedPxPerMs;
        newScalingType = "fixed";
      }
    } else {
      newPxPerMs = FALLBACK_PX_PER_MS;
      newScalingType = "fixed";
    }

    setPxPerMs(newPxPerMs);
    setCurrentScalingType(newScalingType);
  }, [durationMs, paddingPx]);

  useEffect(() => {
    recalc();

    if (config.type === "container" || config.type === "auto") {
      const handleResize = () => recalc();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
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
