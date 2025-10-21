"use client";

import React, { useEffect, forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { S3ClipData, DualVideoClip } from "@/types/app";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";
import { ClipContext } from "@/contexts/clip-context";
import { PersistentOverlays } from "./persistent-overlays";
import { Seek } from "./video-seek-bar";
import { Volume } from "./volume";
import { Playback } from "./video-controls";
import { useDualVideoSync } from "@/hooks/app/use-dual-video-sync";
import { DualClockContext } from "@/contexts/dual-clock-context";

interface DualVideoPlayerProps {
  primaryClip: S3ClipData;
  duration: number;
  secondaryClip: DualVideoClip | null;
  className?: string;
  style?: React.CSSProperties;
}

export const DualVideoPlayer = forwardRef<HTMLDivElement, DualVideoPlayerProps>(
  (
    { primaryClip, secondaryClip, duration, className, style },
    forwardedRef
  ) => {
    const { setDualVideoRef, secondaryContainerRef } = useShallowSelector(
      OverlaysContext,
      (state) => ({
        setDualVideoRef: state.setDualVideoRef,
        secondaryContainerRef: state.secondaryContainerRef,
      })
    );

    const {
      primaryTrim,
      secondaryTrim,
      dualVideoSettings,
      setDualVideoSettings,
    } = useShallowSelector(ClipContext, (state) => ({
      primaryTrim: state.primaryTrim,
      secondaryTrim: state.secondaryTrim,
      dualVideoSettings: state.dualVideoSettings,
      setDualVideoSettings: state.setDualVideoSettings,
    }));

    const { clock, primaryVideoRef, secondaryVideoRef } = useShallowSelector(
      DualClockContext,
      (state) => ({
        clock: state.clock,
        primaryVideoRef: state.primaryVideoRef,
        secondaryVideoRef: state.secondaryVideoRef,
      })
    );

    const {
      controls: dualVideoControls,
      primaryBuffered,
      secondaryBuffered,
      isBuffering: isBufferingDualVideo,
      hasError: hasErrorDualVideo,
    } = useDualVideoSync({
      clock,
      primaryVideoRef,
      secondaryVideoRef,
      primaryTrim,
      secondaryTrim,
      enabled: !!secondaryClip,
    });

    useEffect(() => {
      setDualVideoRef(primaryVideoRef);
    }, [setDualVideoRef, primaryVideoRef]);

    return (
      <div
        ref={forwardedRef}
        className={cn("flex flex-col gap-4 items-center relative", className)}
        style={style}
      >
        <div
          ref={secondaryContainerRef}
          className="relative flex flex-col items-center aspect-[9/16] w-full justify-center overflow-hidden bg-surface-secondary shadow-md group"
        >
          <div
            className={cn(
              "relative overflow-hidden w-full flex h-1/2",
              secondaryClip ? "items-end h-1/2" : "items-center h-1/2"
            )}
          >
            <video
              ref={primaryVideoRef}
              src={primaryClip.url}
              poster={"/thumbnails/video-thumb-2.webp"}
              playsInline
              preload="metadata"
              className={cn(
                "rounded-none",
                secondaryClip
                  ? "object-contain"
                  : "object-contain w-full h-full"
              )}
            />

            <div className="absolute bottom-2 left-2 z-20">
              <Volume.Root
                defaultValue={dualVideoSettings.primaryVolume}
                onValueChangeAlways={(volume) => {
                  const video = primaryVideoRef.current;
                  if (!video) return;
                  const clamped = Math.max(0, Math.min(volume, 1));
                  video.volume = clamped;

                  setDualVideoSettings({
                    ...dualVideoSettings,
                    primaryVolume: volume,
                  });
                }}
              >
                <Volume.Controls variant="pill">
                  <Volume.Button aria-label="Primary volume" />
                  <Volume.Slider>
                    <Volume.Slider.Track>
                      <Volume.Slider.Range />
                      <Volume.Slider.Thumb />
                    </Volume.Slider.Track>
                  </Volume.Slider>
                </Volume.Controls>
              </Volume.Root>
            </div>
          </div>
          {secondaryClip && (
            <div
              className={cn(
                "relative overflow-hidden h-1/2 w-full flex items-start"
              )}
            >
              <video
                ref={secondaryVideoRef}
                src={secondaryClip.url}
                poster={"/thumbnails/video-thumb-2.webp"}
                playsInline
                preload="metadata"
                className={cn("rounded-none object-contain")}
              />

              <div className="absolute top-2 left-2 z-20">
                <Volume.Root
                  defaultValue={dualVideoSettings.secondaryVolume}
                  onValueChangeAlways={(volume) => {
                    const video = secondaryVideoRef.current;
                    if (!video) return;
                    const clamped = Math.max(0, Math.min(volume, 1));
                    video.volume = clamped;

                    setDualVideoSettings({
                      ...dualVideoSettings,
                      secondaryVolume: volume,
                    });
                  }}
                >
                  <Volume.Controls variant="pill">
                    <Volume.Button aria-label="Secondary volume" />
                    <Volume.Slider>
                      <Volume.Slider.Track>
                        <Volume.Slider.Range />
                        <Volume.Slider.Thumb />
                      </Volume.Slider.Track>
                    </Volume.Slider>
                  </Volume.Controls>
                </Volume.Root>
              </div>
            </div>
          )}

          {secondaryClip && (
            <div className="absolute top-1/2 left-0 right-0 h-px bg-error transform -translate-y-px" />
          )}

          <Playback.Root
            playing={clock.status === "playing"}
            onPlayingChange={(shouldPlay) => {
              if (shouldPlay) {
                dualVideoControls.play();
              } else {
                dualVideoControls.pause();
              }
            }}
            isBuffering={isBufferingDualVideo}
            hasError={hasErrorDualVideo}
          >
            <Playback.Controls className="px-4">
              <Playback.PlayToggle />
              <Playback.LoopToggle
                defaultLoop={clock.repeat}
                onLoopChangeAlways={clock.controls.toggleRepeat}
              />

              <Seek.Root
                primaryVideoRef={primaryVideoRef}
                primaryTrim={primaryTrim}
                secondaryTrim={secondaryClip ? secondaryTrim : null}
                primaryBuffered={primaryBuffered}
                secondaryBuffered={secondaryBuffered}
                isPlaying={clock.status === "playing"}
                onSeek={dualVideoControls.seek}
              >
                <Seek.Content>
                  <Seek.TimeDisplay className="absolute top-1/2 -translate-y-1/2 right-4" />
                  <Seek.Track className="-translate-y-full absolute top-0 w-[85%] left-1/2 -translate-x-1/2">
                    <Seek.Buffer />
                    <Seek.Progress />
                    <Seek.Thumb />
                  </Seek.Track>
                  <Seek.Animator />
                </Seek.Content>
              </Seek.Root>
            </Playback.Controls>
          </Playback.Root>

          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent transition-opacity duration-200 ease-out opacity-0 group-hover:opacity-100"
            )}
          />
        </div>

        <PersistentOverlays duration={duration} isDualVideo />
      </div>
    );
  }
);

DualVideoPlayer.displayName = "DualVideoPlayer";

export default DualVideoPlayer;
