import React, { useMemo } from "react";
import type { InterpolatedResult } from "./use-interpolated-transform";
import type { Variant } from "@/utils/scale-range";

export function useVideoTransformStyle(
  data: InterpolatedResult,
  variant: Variant
): React.CSSProperties {
  return useMemo(() => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      willChange: "transform, clip-path",
    };

    if (variant === "letterbox") {
      return {
        ...baseStyle,
        objectFit: "contain",
        transform: `translate(0%, 0%) scale(1)`,
      };
    }

    if (variant === "stretch") {
      return {
        ...baseStyle,
        objectFit: "fill",
        transform: data.transform ?? `translate(0%, 0%) scale(${data.scale})`,
      };
    }

    // crop
    return {
      ...baseStyle,
      objectFit: "cover",
      clipPath: data.clipPath,
      transform: `translate(-50%, -50%) scale(1)`,
    };
  }, [data, variant]);
}
