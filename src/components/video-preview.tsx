import React, { useMemo, useRef, forwardRef, useState } from "react";
import { AspectRatio } from "@/utils/aspect-ratios";
import type { KeyframeBounds, KeyframeData } from "@/utils/keyframe";
import {
  ReactiveVideoControls,
  useReactiveVideoTime,
} from "@/hooks/app/use-reactive-video-time";
import {
  getPlayingState,
  type PlayingStatus,
} from "@/hooks/app/use-video-controls-core";
import {
  useInterpolatedTransform,
  InterpolatedResult,
} from "@/hooks/app/use-interpolated-transform";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { getElementRef } from "@/lib/get-element-ref";
import logger from "@/utils/logger";
import type { CropMode } from "@/types/app";
import { CANVAS_RENDERER_SYMBOL, getRendererType } from "@/utils/renderer";
import { Volume } from "./volume";
import { Seek } from "./video-seek-bar";
import { cn } from "@/lib/utils";
import { useLatestValue } from "@/hooks/use-latest-value";
import { TrimData } from "@/types/app";
import { Playback } from "./video-controls";
import { msToSeconds, secondsToMs } from "@/utils/video";

export type Video = React.ReactElement<
  React.VideoHTMLAttributes<HTMLVideoElement> & {
    ref?: React.Ref<HTMLVideoElement>;
  }
>;

export type PreviewRenderContext = {
  video: Video;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  transform: InterpolatedResult;
  time: number;
  duration: number | null;
  playing: PlayingStatus;
  variant: CropMode;
  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
} & ReactiveVideoControls;

export interface VideoPreviewProps {
  source: Video;
  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
  variant: CropMode;
  keyframes?: KeyframeData[];

  onTimeChange?: (t: number) => void;

  playing?: boolean;
  onPlayingChange?: (p: PlayingStatus) => void;

  defaultRepeat?: boolean;

  children?: (context: PreviewRenderContext) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;

  // Keyframe bounds: relative to TRIMMED clip (0 = start of trim)
  keyframeBounds: KeyframeBounds;

  // Trim data: absolute positions in SOURCE video
  trimData: TrimData;

  externalControls?: boolean;
}

export const VideoPreview = forwardRef<HTMLDivElement, VideoPreviewProps>(
  (props, forwardedRef) => {
    const {
      source,
      baseAspect,
      targetAspect,
      variant,
      keyframes,
      trimData,
      onTimeChange,
      playing: externalPlaying = false,
      onPlayingChange,
      defaultRepeat = false,
      keyframeBounds,
      children,
      className,
      style,
      externalControls = false,
    } = props;

    const repeatRef = useRef(defaultRepeat);

    const validatedBounds = useMemo(() => {
      const trimStartSec = msToSeconds(trimData.trimStart);
      const trimEndSec = msToSeconds(trimData.trimEnd);

      const clampedStart = Math.max(keyframeBounds.start, trimStartSec);
      const clampedEnd = Math.min(keyframeBounds.end, trimEndSec);

      if (clampedStart >= clampedEnd) {
        return { start: trimStartSec, end: trimEndSec };
      }

      return { start: clampedStart, end: clampedEnd };
    }, [keyframeBounds, trimData]);

    const startRef = useLatestValue(validatedBounds.start);
    const endRef = useLatestValue(validatedBounds.end);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const composedRef = useComposedRefs(videoRef, getElementRef(source));

    const duration = keyframeBounds.end - keyframeBounds.start;

    const isValidVideo =
      React.isValidElement(source) &&
      typeof source.type === "string" &&
      source.type === "video";

    const rootVideo = useMemo(() => {
      return React.cloneElement(source, {
        ref: composedRef,
        muted: source.props.muted ?? false,
        preload: source.props.preload ?? "auto",
        playsInline: source.props.playsInline ?? true,
      });
    }, [source]);

    const filteredKeyframes = useMemo(() => {
      if (!keyframes) return undefined;

      return keyframes.filter((kf) => {
        return (
          kf.time >= validatedBounds.start && kf.time <= validatedBounds.end
        );
      });
    }, [keyframes, validatedBounds]);

    const { time, status, controls, isBuffering, hasError, buffered } =
      useReactiveVideoTime({
        videoRef,
        trimStartRef: startRef,
        trimEndRef: endRef,
        repeatRef,
        playing: externalPlaying,
        onTimeChange,
        onPlayingChange,
      });

    const transform = useInterpolatedTransform(
      filteredKeyframes,
      time,
      variant,
      baseAspect,
      targetAspect
    );

    const seekTrimData = useMemo<TrimData>(() => {
      return {
        trimStart: secondsToMs(validatedBounds.start),
        trimEnd: secondsToMs(validatedBounds.end),
        timelineOffset: 0,
      };
    }, [validatedBounds]);

    const playState = getPlayingState(status);

    const context: PreviewRenderContext = useMemo(
      () => ({
        video: rootVideo,
        videoRef,
        transform,
        time,
        duration,
        playing: status,
        ...controls,
        variant,
        baseAspect,
        targetAspect,
      }),
      [
        rootVideo,
        videoRef,
        transform,
        time,
        duration,
        controls,
        status,
        variant,
        baseAspect,
        targetAspect,
      ]
    );

    const renderedChild = useMemo(() => {
      if (typeof children === "function") {
        return children(context);
      }
      return children;
    }, [children, context]);

    const rendererType = getRendererType(renderedChild);
    const isChildCanvasRenderer = rendererType === CANVAS_RENDERER_SYMBOL;

    if (!isValidVideo) {
      logger.warn("VideoPreview: `source` must be a <video> React element.");
      return null;
    }

    return (
      <div
        ref={forwardedRef}
        className={cn("w-full h-full group", className)}
        style={{
          ...style,
        }}
      >
        <div
          className={cn("absolute inset-0 flex items-center justify-center")}
        >
          {renderedChild}
        </div>

        {!externalControls && (
          <>
            <div className="absolute top-2 left-2 z-20">
              <Volume.Root
                defaultValue={controls.getVolume()}
                onValueChangeAlways={controls.setVolume}
              >
                <Volume.Controls variant="pill">
                  <Volume.Button />
                  <Volume.Slider>
                    <Volume.Slider.Track>
                      <Volume.Slider.Range />
                      <Volume.Slider.Thumb />
                    </Volume.Slider.Track>
                  </Volume.Slider>
                </Volume.Controls>
              </Volume.Root>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Playback.Root
                defaultPlaying={playState.isPlaying}
                onPlayingChangeAlways={(shouldPlay) => {
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
                <Playback.Controls className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
                    <Playback.PlayToggle />
                    <Playback.LoopToggle
                      defaultLoop={repeatRef.current}
                      onLoopChange={(value) => {
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
                  primaryVideoRef={videoRef}
                  primaryTrim={seekTrimData}
                  secondaryTrim={null}
                  isPlaying={playState.isPlaying}
                  onSeek={(timeMs) => {
                    const sourceTimeSec =
                      msToSeconds(timeMs) + validatedBounds.start;
                    controls.seek(sourceTimeSec);
                  }}
                  primaryBuffered={buffered}
                  secondaryBuffered={null}
                >
                  <Seek.Content>
                    <Seek.TimeDisplay className="absolute top-4 translate-y right-4" />
                    {/* TODO: 58px height of Playback.Controls */}
                    <Seek.Track className="absolute w-[85%] bottom-[58px] translate-y-1/2 left-1/2 -translate-x-1/2">
                      <Seek.Buffer />
                      <Seek.Progress />
                      <Seek.Thumb />
                    </Seek.Track>
                    <Seek.Animator />
                  </Seek.Content>
                </Seek.Root>
              </Playback.Root>
            </div>
          </>
        )}

        {/* Hidden video element kept mounted as a frame source for CanvasVideoRenderer to read and paint from */}
        {isChildCanvasRenderer
          ? React.cloneElement(rootVideo, {
              style: {
                position: "absolute",
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
              },
            })
          : null}
      </div>
    );
  }
);

VideoPreview.displayName = "VideoPreview";

export default VideoPreview;
