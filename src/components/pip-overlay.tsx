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
import { PIP_SETTINGS } from "@/constants/app";
import { getAspectRatioValue, type AspectRatio } from "@/utils/aspect-ratios";

export interface PiPOverlayProps {
  children: Video;
  containerRef: React.RefObject<HTMLDivElement | null>;
  playerType: "primary" | "secondary";
}

export const PiPOverlay = React.forwardRef<HTMLVideoElement, PiPOverlayProps>(
  ({ children, playerType, containerRef }, forwardedRef) => {
    const { dualVideoSettings: settings, setDualVideoSettings: setSettings } =
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

    const pipAspectRatio = (settings.pipAspectRatio || "16:9") as AspectRatio;

    const aspectValue = React.useMemo(
      () => getAspectRatioValue(pipAspectRatio),
      [pipAspectRatio]
    );

    const volumeOrientation = aspectValue < 1 ? "vertical" : "horizontal";
    const pipSettings = PIP_SETTINGS[pipAspectRatio];

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

        setSettings((prev) => ({
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
        key={pipAspectRatio}
        containerRef={containerRef}
        aspectRatio={pipAspectRatio}
        initialPosition={pipSettings.initialPosition}
        constraints={pipSettings.constraints}
        onPositionChange={handlePositionChange}
      >
        <>
          {clonedVideo}

          <Volume.Root
            orientation={volumeOrientation}
            defaultValue={(() => {
              const isPrimary = playerType === "primary";
              const video = pipVideoRef?.current;
              const volume = isPrimary
                ? settings.secondaryVolume
                : settings.primaryVolume;

              if (video && video.volume !== volume) {
                video.volume = Math.max(0, Math.min(volume, 1));
              }
              return volume;
            })()}
            value={
              playerType === "primary"
                ? settings.secondaryVolume
                : settings.primaryVolume
            }
            onValueChange={(volume) => {
              const isPrimary = playerType === "primary";
              const video = pipVideoRef.current;
              const clamped = Math.max(0, Math.min(volume, 1));
              if (video) video.volume = clamped;

              setSettings({
                ...settings,
                ...(isPrimary
                  ? { secondaryVolume: volume }
                  : { primaryVolume: volume }),
              });
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
