import React, { useMemo, useRef, forwardRef } from "react";
import { AspectRatio } from "@/utils/aspect-ratios";
import type { KeyframeData } from "@/utils/keyframe";
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

  keyframeBounds: {
    start: number;
    end: number;
  };
}

export const VideoPreview = forwardRef<HTMLDivElement, VideoPreviewProps>(
  (props, forwardedRef) => {
    const {
      source,
      baseAspect,
      targetAspect,
      variant,
      keyframes,
      onTimeChange,
      playing: externalPlaying = false,
      onPlayingChange,
      defaultRepeat = false,
      keyframeBounds,
      children,
      className,
      style,
    } = props;

    const repeatRef = useRef(defaultRepeat);
    const startRef = useLatestValue(keyframeBounds.start);
    const endRef = useLatestValue(keyframeBounds.end);
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
    }, [source, composedRef]);

    const { time, status, controls } = useReactiveVideoTime({
      videoRef,
      trimStartRef: startRef,
      trimEndRef: endRef,
      repeatRef,
      playing: externalPlaying,
      onTimeChange,
      onPlayingChange,
    });

    const transform = useInterpolatedTransform(
      keyframes,
      time,
      variant,
      baseAspect,
      targetAspect
    );

    const trimData = useMemo<TrimData>(() => {
      return {
        trimStart: keyframeBounds.start * 1000,
        trimEnd: keyframeBounds.end * 1000,
        timelineOffset: 0,
      };
    }, [keyframeBounds.start, keyframeBounds.end]);

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
        className={cn(
          "relative overflow-hidden rounded-lg shadow-md w-full aspect-(--aspect-ratio) group",
          className
        )}
        style={
          {
            "--aspect-ratio": targetAspect.replace(":", "/"),
            ...style,
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            "absolute inset-0",
            targetAspect !== "9:16" && "flex items-center justify-center"
          )}
        >
          {renderedChild}
        </div>

        <div className="absolute top-2 left-2 z-10">
          <Volume.Root
            defaultValue={controls.getVolume()}
            onValueChangeAlways={controls.setVolume}
          >
            <Volume.Controls variant="pill">
              <Volume.Button aria-label="Volume" />
              <Volume.Slider>
                <Volume.Slider.Track>
                  <Volume.Slider.Range />
                  <Volume.Slider.Thumb />
                </Volume.Slider.Track>
              </Volume.Slider>
            </Volume.Controls>
          </Volume.Root>
        </div>

        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 transition-all duration-300 ease-out opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 z-20"
          )}
        >
          <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-sm">
            <div className="px-4 py-3 space-y-3">
              <Seek.Root
                primaryVideoRef={videoRef}
                primaryTrim={trimData}
                secondaryTrim={null}
                isPlaying={playState.isPlaying}
                onSeek={(timeMs) => controls.seek(timeMs / 1000)}
              >
                <Seek.Content>
                  <Seek.TimeDisplay />
                  <Seek.Track>
                    <Seek.Buffer />
                    <Seek.Progress />
                    <Seek.Thumb />
                  </Seek.Track>
                  <Seek.Animator />
                </Seek.Content>
              </Seek.Root>

              <div className="flex items-center justify-center gap-2">
                <Playback.Root isPlaying={playState.isPlaying}>
                  <Playback.Controls>
                    <Playback.PlayToggle
                      defaultPlaying={playState.isPlaying}
                      onPlayingChangeAlways={() => controls.toggle()}
                    />
                    <Playback.LoopToggle
                      defaultLoop={repeatRef.current}
                      onLoopChange={(value) => {
                        repeatRef.current = value;
                      }}
                    />
                    <Playback.RateControl
                      defaultRate={controls.getPlaybackRate()}
                      onRateChangeAlways={controls.setPlaybackRate}
                    />
                  </Playback.Controls>
                </Playback.Root>
              </div>
            </div>
          </div>
        </div>

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
