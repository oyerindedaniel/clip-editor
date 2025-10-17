"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  BoundaryBox,
  type BoundaryBoxRootProps,
} from "@/components/boundary-box";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import {
  useReactiveVideoTime,
  UseReactiveVideoTimeOptions,
} from "@/hooks/app/use-reactive-video-time";
import type { Transform } from "@/utils/keyframe";
import {
  DEFAULT_VIDEO_WIDTH,
  DEFAULT_VIDEO_HEIGHT,
} from "@/utils/aspect-ratios";
import { type Video } from "./video-preview";
import { getElementRef } from "@/lib/get-element-ref";

export interface PiPOverlayProps
  extends Omit<BoundaryBoxRootProps, "children">,
    Omit<
      UseReactiveVideoTimeOptions,
      "videoRef" | "onPlayingChange" | "onTimeChange" | ""
    > {
  children: Video;
  onPiPTimeUpdate?: (time: number) => void;
  primaryVideoRef?: React.RefObject<HTMLVideoElement | null>;
  draggable?: boolean;
  resizable?: boolean;
  className?: string;
}

export const PiPOverlay = React.forwardRef<HTMLDivElement, PiPOverlayProps>(
  (
    {
      children,
      trimStartRef,
      trimEndRef,
      repeatRef,
      playing,
      onPiPTimeUpdate,
      primaryVideoRef,
      visible = true,
      draggable = true,
      resizable = true,
      aspectRatio = "16:9",
      defaultAspectRatio = "16:9",
      transform,
      defaultTransform,
      onTransformChange,
      className,
      ...rest
    },
    forwardedRef
  ) => {
    const [currentTransform, setCurrentTransform] =
      useControllableState<Transform>({
        defaultValue: transform ??
          defaultTransform ?? {
            x: 0,
            y: 0,
            width: Math.round(DEFAULT_VIDEO_WIDTH * 0.25),
            height: Math.round(DEFAULT_VIDEO_HEIGHT * 0.25),
            scale: 1,
            normX: 0,
            normY: 0,
          },
        controlled: transform,
        onChange: onTransformChange,
      });

    const [isVisible] = useControllableState<boolean>({
      defaultValue: visible,
      controlled: visible,
    });

    const _videoRef = React.useRef<HTMLVideoElement | null>(null);
    const composedRefs = useComposedRefs(forwardedRef);

    useReactiveVideoTime({
      videoRef: _videoRef,
      trimStartRef,
      trimEndRef,
      repeatRef,
      playing,
      onTimeChange: onPiPTimeUpdate,
      onPlayingChange: undefined,
    });

    const existingRef = getElementRef(children);
    const videoRef = useComposedRefs(_videoRef, existingRef);

    const clonedVideo = React.useMemo(() => {
      if (!React.isValidElement(children)) return null;
      return React.cloneElement(children, {
        ref: videoRef,
        className: cn("w-full h-full object-cover", children.props.className),
        playsInline: children.props?.playsInline ?? true,
      });
    }, [children]);

    if (!isVisible) return null;

    return (
      <BoundaryBox
        {...rest}
        aspectRatio={aspectRatio}
        defaultAspectRatio={defaultAspectRatio}
        transform={currentTransform}
        onTransformChange={setCurrentTransform}
      >
        <BoundaryBox.Container
          ref={composedRefs}
          className={cn("pointer-events-none", className)}
        >
          <BoundaryBox.Overlay>
            <div className="w-full h-full pointer-events-auto">
              {clonedVideo}
            </div>
            {draggable && <BoundaryBox.Draggable />}
            {resizable && (
              <>
                <BoundaryBox.Resizable side="top-left" />
                <BoundaryBox.Resizable side="top-right" />
                <BoundaryBox.Resizable side="bottom-left" />
                <BoundaryBox.Resizable side="bottom-right" />
              </>
            )}
          </BoundaryBox.Overlay>
        </BoundaryBox.Container>
      </BoundaryBox>
    );
  }
);

PiPOverlay.displayName = "PiPOverlay";

export default PiPOverlay;
