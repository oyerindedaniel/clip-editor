import React, { useMemo, isValidElement } from "react";
import { cn } from "@/lib/utils";
import type {
  VideoPreviewProps,
  VideoPreviewStretchCropProps,
} from "@/types/preview";
import { useKeyframeAnimation } from "@/hooks/app/use-keyframe-animation";
import { calculateAspectRatioScale } from "@/utils/video";
import { ASPECT_RATIOS } from "@/utils/aspect-ratios";

export function VideoPreview(props: VideoPreviewProps) {
  const { baseAspect, targetAspect, children, variant, className } = props;

  if (!isValidElement(children) || children.type !== "video") return null;

  const { scale } = useMemo(
    () => calculateAspectRatioScale(baseAspect, targetAspect),
    [baseAspect, targetAspect]
  );

  const animationName =
    variant !== "letterbox"
      ? useKeyframeAnimation(
          (props as VideoPreviewStretchCropProps).keyframes,
          variant
        )
      : undefined;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-2xl bg-black",
        className
      )}
      style={{ aspectRatio: `${ASPECT_RATIOS[targetAspect]}` }}
    >
      {React.cloneElement(children, {
        className: cn(
          "object-cover transition-transform duration-300",
          children.props.className
        ),
        style: {
          ...(variant === "stretch"
            ? { transform: `scale(${scale})` }
            : variant === "crop"
            ? { transform: `scale(${Math.max(1, scale)})` }
            : { objectFit: "contain" as const }),
          ...(animationName && variant !== "letterbox"
            ? {
                animation: `${animationName} ${(
                  (props as VideoPreviewStretchCropProps).keyframes?.at(-1)
                    ?.time || 0
                ).toFixed(2)}s linear infinite`,
              }
            : {}),
        } as React.CSSProperties,
      })}
    </div>
  );
}
