"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { ClipContext } from "@/contexts/clip-context";
import { useShallowSelector } from "react-shallow-store";
import { getElementRef } from "@/lib/get-element-ref";
import { PiP } from "./pip";
import type { Video } from "@/components/video-preview";
import { Volume } from "./volume";

export interface PiPOverlayProps {
  children: Video;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const PiPOverlay = React.forwardRef<HTMLVideoElement, PiPOverlayProps>(
  ({ children, containerRef }, forwardedRef) => {
    const { dualVideoSettings: settings, setDualVideoSettings } =
      useShallowSelector(ClipContext, (state) => ({
        dualVideoSettings: state.dualVideoSettings,
        setDualVideoSettings: state.setDualVideoSettings,
      }));

    const pipVideoRef = React.useRef<HTMLVideoElement | null>(null);

    const composedRefs = useComposedRefs(
      getElementRef(children),
      pipVideoRef,
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
        <>
          {clonedVideo}

          <Volume.Root
            orientation="horizontal"
            defaultValue={settings.secondaryVolume}
            onValueChangeAlways={(volume: number) => {
              const video = pipVideoRef.current;
              if (!video) return;
              const clamped = Math.max(0, Math.min(volume, 1));
              video.volume = clamped;
            }}
          >
            <Volume.Controls
              variant="pill"
              className="absolute bottom-2 left-2 z-14 pointer-events-auto"
            >
              <Volume.Button size="icon" aria-label="Primary volume" />
              <Volume.Slider>
                <Volume.Slider.Track className="!glass">
                  <Volume.Slider.Range className="bg-white" />
                  <Volume.Slider.Thumb className="bg-white" />
                </Volume.Slider.Track>
              </Volume.Slider>
            </Volume.Controls>
          </Volume.Root>
        </>
      </PiP>
    );
  }
);

PiPOverlay.displayName = "PiPOverlay";

export default PiPOverlay;
