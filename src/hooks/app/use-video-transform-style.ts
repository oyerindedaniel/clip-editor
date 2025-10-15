import React, { useMemo } from "react";
import type { InterpolatedResult } from "./use-interpolated-transform";
import type { CropMode } from "@/types/app";

export function useVideoTransformStyle(
  data: InterpolatedResult,
  variant: CropMode
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

    if (variant === "crop") {
      return {
        ...baseStyle,
        objectFit: "cover",
        clipPath: data.clipPath,
        transform: `translate(-50%, -50%) scale(1)`,
      };
    }

    return baseStyle;
  }, [data, variant]);
}
