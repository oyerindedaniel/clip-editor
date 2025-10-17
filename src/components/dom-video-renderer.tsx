import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useVideoTransformStyle } from "@/hooks/app/use-video-transform-style";
import type { InterpolatedResult } from "@/hooks/app/use-interpolated-transform";
import { getElementRef } from "@/lib/get-element-ref";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import type { CropMode } from "@/types/app";
import { DOM_RENDERER_SYMBOL, TaggedRendererComponent } from "@/utils/renderer";
import type { Video } from "./video-preview";

interface DOMVideoRendererProps {
  video: Video;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  transformData: InterpolatedResult;
  variant: CropMode;
  className?: string;
}

const DOMVideoRenderer: TaggedRendererComponent<DOMVideoRendererProps> = ({
  video,
  videoRef,
  transformData,
  variant,
  className,
}) => {
  const style = useVideoTransformStyle(transformData, variant);

  const composedRef = useComposedRefs(videoRef, getElementRef(video));

  const cloned = useMemo(() => {
    return React.cloneElement(video, {
      ref: composedRef,
      className: cn(
        "absolute inset-0 w-full h-full object-cover",
        video.props.className
      ),
      style: {
        ...video.props.style,
        ...style,
      },
      controls: false,
      muted: true,
      playsInline: true,
    });
  }, [video, style]);

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
};

DOMVideoRenderer.displayName = "DOMVideoRenderer";
DOMVideoRenderer._rendererType = DOM_RENDERER_SYMBOL;

export default DOMVideoRenderer;
