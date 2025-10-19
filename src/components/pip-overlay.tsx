"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useConstrainedVideo } from "@/hooks/app/use-constrained-video";
import { ClipContext } from "@/contexts/clip-context";
import { useShallowSelector } from "react-shallow-store";
import { useLatestValue } from "@/hooks/use-latest-value";
import { getElementRef } from "@/lib/get-element-ref";
import { PiP } from "./pip";
import type { AspectRatio } from "@/utils/aspect-ratios";
import type { Transform } from "@/utils/keyframe";
import type { Video } from "@/components/video-preview";

export interface PiPOverlayProps {
  children?: Video;
  containerRef: React.RefObject<HTMLDivElement | null>;
  activePlayer: "primary" | "secondary";
}

export const PiPOverlay = React.forwardRef<HTMLVideoElement, PiPOverlayProps>(
  ({ children, containerRef, activePlayer = "primary" }, forwardedRef) => {
    const {
      primaryTrimRef,
      secondaryTrimRef,
      dualVideoSettings: settings,
      setDualVideoSettings,
    } = useShallowSelector(ClipContext, (state) => ({
      primaryTrimRef: state.primaryTrimRef,
      secondaryTrimRef: state.secondaryTrimRef,
      dualVideoSettings: state.dualVideoSettings,
      setDualVideoSettings: state.setDualVideoSettings,
    }));

    const pipPlayer = activePlayer === "primary" ? "secondary" : "primary";

    const startRef = useLatestValue(
      pipPlayer === "primary"
        ? primaryTrimRef.current.trimStart
        : secondaryTrimRef.current.trimStart
    );
    const endRef = useLatestValue(
      pipPlayer === "primary"
        ? primaryTrimRef.current.trimEnd
        : secondaryTrimRef.current.trimEnd
    );

    const videoRef = React.useRef<HTMLVideoElement | null>(null);

    useConstrainedVideo({
      videoRef,
      trimStartRef: startRef,
      trimEndRef: endRef,
    });

    const composedRefs = useComposedRefs(
      videoRef,
      children ? getElementRef(children) : () => {},
      forwardedRef
    );

    const clonedVideo = React.useMemo(() => {
      if (!React.isValidElement(children)) return null;
      return React.cloneElement(children, {
        ref: composedRefs,
        className: cn("w-full h-full object-cover", children.props.className),
        playsInline: true,
        controls: false,
      });
    }, [children, composedRefs]);

    const handlePositionChange = React.useCallback(
      (position: { x: number; y: number; width: number; height: number }) => {
        const container = containerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();

        const normX = position.x / containerRect.width;
        const normY = position.y / containerRect.height;
        const scaleX = position.width / containerRect.width;
        const scaleY = position.height / containerRect.height;

        const scale = Math.min(scaleX, scaleY);

        // console.log({
        //   x: position.x,
        //   y: position.y,
        //   width: position.width,
        //   height: position.height,
        //   scale,
        //   normX,
        //   normY,
        // });

        setDualVideoSettings((prev) => ({
          ...prev,
          pip: {
            ...prev.pip,
            x: position.x,
            y: position.y,
            width: position.width,
            height: position.height,
            scale,
            normX,
            normY,
          },
        }));
      },
      []
    );

    if (settings.layout !== "pip") return null;

    return (
      <PiP
        containerRef={containerRef}
        aspectRatio="16:9"
        initialPosition={{
          width: 240,
          height: 135,
        }}
        constraints={{
          minWidth: 160,
          minHeight: 90,
        }}
        onPositionChange={handlePositionChange}
      >
        {clonedVideo}
      </PiP>
    );
  }
);

PiPOverlay.displayName = "PiPOverlay";

export default PiPOverlay;
