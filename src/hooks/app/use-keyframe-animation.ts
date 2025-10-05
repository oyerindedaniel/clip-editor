import { useMemo } from "react";
import type { KeyframeData } from "@/types/keyframe";

export function useKeyframeAnimation(
  keyframes?: KeyframeData[],
  variant?: "stretch" | "crop"
): string | undefined {
  return useMemo(() => {
    if (!keyframes || !variant) return undefined;

    const frames = keyframes
      .sort((a, b) => a.time - b.time)
      .map((kf) => {
        const percent = `${
          (kf.time / keyframes[keyframes.length - 1].time) * 100
        }%`;
        const { x, y, scale } = kf.transform;
        const transform =
          variant === "crop"
            ? `translate(${x}%, ${y}%) scale(${scale})`
            : `scale(${scale}) translate(${x}%, ${y}%)`;
        return `${percent} { transform: ${transform}; }`;
      })
      .join("\n");

    const animationName = `videoKF_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const style = document.createElement("style");
    style.innerHTML = `@keyframes ${animationName} { ${frames} }`;
    document.head.appendChild(style);

    return animationName;
  }, [keyframes, variant]);
}
