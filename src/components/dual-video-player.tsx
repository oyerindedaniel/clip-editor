"use client";

import React, { useEffect, forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { ClipData, DualVideoClip } from "@/types/app";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";
import { ClipContext } from "@/contexts/clip-context";
import { PersistentOverlays } from "./persistent-overlays";
import { Seek } from "./video-seek-bar";
import { Volume } from "./volume";
import { Playback } from "./video-controls";
import { useDualVideoSync } from "@/hooks/app/use-dual-video-sync";
import { DualClockContext } from "@/contexts/dual-clock-context";
import { useConstrainedVideo } from "@/hooks/app/use-constrained-video";
import { useLatestValue } from "@/hooks/use-latest-value";
import { msToSeconds } from "@/utils/video";
import { getPlayingState } from "@/hooks/app/use-video-controls-core";

interface DualVideoPlayerProps {
  primaryClip: ClipData;
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
    const repeatRef = React.useRef(false);

    const { setDualVideoRef, secondaryContainerRef, activePersistentOverlays } =
      useShallowSelector(OverlaysContext, (state) => ({
        setDualVideoRef: state.setDualVideoRef,
        secondaryContainerRef: state.secondaryContainerRef,
        activePersistentOverlays: state.activePersistentOverlays,
      }));

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

    const { primaryVideoRef, secondaryVideoRef } = useShallowSelector(
      DualClockContext,
      (state) => ({
        primaryVideoRef: state.primaryVideoRef,
        secondaryVideoRef: state.secondaryVideoRef,
      })
    );

    const { controls, status, buffered, isBuffering, hasError } =
      useConstrainedVideo({
        videoRef: primaryVideoRef,
        trimStartRef: useLatestValue(msToSeconds(primaryTrim.trimStart) ?? 0),
        trimEndRef: useLatestValue(msToSeconds(primaryTrim.trimEnd) ?? 0),
        repeatRef,
      });

    const playState = getPlayingState(status);

    const {
      controls: dualVideoControls,
      primaryBuffered,
      secondaryBuffered,
      isBuffering: isBufferingDualVideo,
      hasError: hasErrorDualVideo,
      status: dualStatus,
      playbackRate: dualPlaybackRate,
      repeat: dualRepeat,
    } = useDualVideoSync({
      primaryVideoRef,
      secondaryVideoRef,
      primaryTrim,
      secondaryTrim,
      enabled: !!secondaryClip,
    });

    useEffect(() => {
      setDualVideoRef(primaryVideoRef);
    }, []);

    return (
      <div
        ref={forwardedRef}
        className={cn("flex flex-col gap-4 items-center relative", className)}
        style={style}
      >
        <div
          ref={secondaryContainerRef}
          className="relative flex flex-col items-center justify-center aspect-[9/16] w-full  overflow-hidden bg-surface-secondary shadow-md group"
        >
          <div
            className={cn(
              "relative overflow-hidden w-full flex",
              secondaryClip ? "items-end h-1/2" : "items-stretch"
            )}
          >
            <video
              ref={primaryVideoRef}
              src={primaryClip.url}
              poster={"/thumbnails/video-thumb-2.webp"}
              playsInline
              preload="metadata"
              className={cn("rounded-none object-contain")}
            />

            <div className="absolute bottom-2 left-2 z-20">
              <Volume.Root
                value={dualVideoSettings.primaryVolume}
                onValueChange={(volume) => {
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
                  value={dualVideoSettings.secondaryVolume}
                  onValueChange={(volume) => {
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

          {secondaryClip ? (
            <Playback.Root
              playing={dualStatus === "playing"}
              onPlayingChange={(shouldPlay) => {
                if (shouldPlay) {
                  dualVideoControls.play();
                } else {
                  dualVideoControls.pause();
                }
              }}
              playingStatus={dualStatus}
              isBuffering={isBufferingDualVideo}
              hasError={hasErrorDualVideo}
              isDual
            >
              <Playback.Controls className="px-4">
                <Playback.PlayToggle />
                <Playback.LoopToggle
                  defaultLoop={dualRepeat}
                  onLoopChangeAlways={dualVideoControls.toggleRepeat}
                />

                <Seek.Root
                  primaryVideoRef={primaryVideoRef}
                  primaryTrim={primaryTrim}
                  secondaryTrim={secondaryTrim}
                  primaryBuffered={primaryBuffered}
                  secondaryBuffered={secondaryBuffered}
                  isPlaying={dualStatus === "playing"}
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
          ) : (
            <Playback.Root
              playing={playState.isPlaying}
              onPlayingChange={(shouldPlay) => {
                if (shouldPlay) {
                  controls.play();
                } else {
                  controls.pause();
                }
              }}
              playingStatus={status}
              isBuffering={isBuffering}
              hasError={hasError}
            >
              <Playback.Controls className="flex items-center justify-between pt-8 px-4">
                <div className="flex items-center gap-2">
                  <Playback.PlayToggle />
                  <Playback.LoopToggle
                    defaultLoop={repeatRef.current}
                    onLoopChangeAlways={(value) => {
                      repeatRef.current = value;
                    }}
                  />
                </div>
                <Playback.RateControl
                  defaultRate={controls.getPlaybackRate()}
                  onRateChangeAlways={controls.setPlaybackRate}
                />
              </Playback.Controls>
              <Seek.Root
                primaryVideoRef={primaryVideoRef}
                primaryTrim={primaryTrim}
                secondaryTrim={null}
                primaryBuffered={buffered}
                secondaryBuffered={null}
                isPlaying={playState.isPlaying}
                onSeek={(timelineMs: number) => {
                  const sourceTimeSec = msToSeconds(
                    primaryTrim.trimStart + timelineMs
                  );
                  controls.seek(sourceTimeSec);
                }}
              >
                <Seek.Content>
                  <Seek.TimeDisplay className="absolute top-4 translate-y right-4" />
                  <Seek.Track className="absolute w-[85%] bottom-[58px] translate-y-1/2 left-1/2 -translate-x-1/2 z-30">
                    <Seek.Buffer />
                    <Seek.Progress />
                    <Seek.Thumb />
                  </Seek.Track>
                  <Seek.Animator />
                </Seek.Content>
              </Seek.Root>
            </Playback.Root>
          )}

          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent transition-opacity duration-200 ease-out opacity-0 group-hover:opacity-100"
            )}
          />
        </div>

        {activePersistentOverlays === "dual" && (
          <PersistentOverlays duration={duration} isDualVideo />
        )}
      </div>
    );
  }
);

DualVideoPlayer.displayName = "DualVideoPlayer";

export default DualVideoPlayer;
