import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useVideoTransformStyle } from "@/hooks/app/use-video-transform-style";
import type { InterpolatedResult } from "@/hooks/app/use-interpolated-transform";
import { getElementRef } from "@/lib/get-element-ref";
import { useComposedRefs } from "@/hooks/use-composed-refs";

interface DOMVideoRendererProps {
  videoElement: React.ReactElement<
    React.VideoHTMLAttributes<HTMLVideoElement> & {
      ref?: React.Ref<HTMLVideoElement>;
    }
  >;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  transformData: InterpolatedResult;
  variant: "crop" | "stretch" | "letterbox";
  className?: string;
}

export function DOMVideoRenderer({
  videoElement,
  videoRef,
  transformData,
  variant,
  className,
}: DOMVideoRendererProps) {
  const style = useVideoTransformStyle(transformData, variant);

  const cloned = useMemo(() => {
    const composedRef = useComposedRefs(videoRef, getElementRef(videoElement));

    return React.cloneElement(videoElement, {
      ref: composedRef,
      className: cn(
        "absolute inset-0 w-full h-full object-cover",
        videoElement.props.className
      ),
      style: {
        ...videoElement.props.style,
        ...style,
      },
      controls: false,
      muted: true,
      playsInline: true,
    });
  }, [videoElement, videoRef, style]);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden",
        "flex items-center justify-center",
        className
      )}
    >
      {cloned}
    </div>
  );
}
