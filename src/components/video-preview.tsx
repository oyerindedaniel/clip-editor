import React, { useMemo, useRef, useEffect, forwardRef } from "react";
import { AspectRatio } from "@/utils/aspect-ratios";
import type { KeyframeData } from "@/utils/keyframe";
import {
  getPlayingState,
  ReactiveVideoControls,
  useReactiveVideoTime,
  type PlayingStatus,
} from "@/hooks/app/use-reactive-video-time";
import {
  useInterpolatedTransform,
  InterpolatedResult,
} from "@/hooks/app/use-interpolated-transform";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { getElementRef } from "@/lib/get-element-ref";
import logger from "@/utils/logger";
import type { Variant } from "@/utils/scale-range";
import { CANVAS_RENDERER_SYMBOL, getRendererType } from "@/utils/renderer";
import { Volume } from "./volume";
import { VideoSeekBar } from "./video-seek-bar";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Repeat } from "lucide-react";
import { VideoControls } from "./video-controls";
import { cn } from "@/lib/utils";
import { useLatestValue } from "@/hooks/use-latest-value";
import { TrimData } from "@/types/app";

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
  variant: Variant;
  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
} & ReactiveVideoControls;

export interface VideoPreviewProps {
  source: Video;
  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
  variant: Variant;
  keyframes?: KeyframeData[];

  onTimeChange?: (t: number) => void;

  playing?: boolean;
  onPlayingChange?: (p: PlayingStatus) => void;

  playbackRate?: number;
  repeat?: boolean;

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
      playbackRate: externalplaybackRate = 1,
      repeat = false,
      keyframeBounds,
      children,
      className,
      style,
    } = props;

    const [volume, setVolume] = React.useState(1);
    const [isRepeat, setIsRepeat] = React.useState(repeat);

    const repeatRef = useLatestValue(isRepeat);
    const playbackRateRef = useLatestValue(externalplaybackRate);

    const startRef = useLatestValue(keyframeBounds.start);
    const endRef = useLatestValue(keyframeBounds.end);

    if (
      !React.isValidElement(source) ||
      typeof source.type !== "string" ||
      source.type !== "video"
    ) {
      logger.warn("VideoPreview: `source` must be a <video> React element.");
      return null;
    }

    const duration = keyframeBounds.end - keyframeBounds.start;

    const videoRef = useRef<HTMLVideoElement | null>(null);

    const composedRef = useComposedRefs(videoRef, getElementRef(source));

    const rootVideo = useMemo(() => {
      return React.cloneElement(source, {
        ref: composedRef,
        muted: source.props.muted ?? false,
        preload: source.props.preload ?? "auto",
        playsInline: source.props.playsInline ?? true,
      });
    }, [source]);

    const { time, status, controls } = useReactiveVideoTime({
      videoRef,
      trimStartRef: startRef,
      trimEndRef: endRef,
      repeatRef,
      playing: externalPlaying,
      playbackRateRef,
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
        <div className="absolute inset-0">{renderedChild}</div>

        <div className="absolute top-2 left-2 z-10">
          <Volume.Root value={volume} onValueChange={setVolume}>
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
              <VideoSeekBar
                primaryVideoRef={videoRef}
                primaryTrim={trimData}
                secondaryTrim={null}
                isPlaying={playState.isPlaying}
                onSeek={(timeMs) => controls.seek(timeMs / 1000)}
                className="w-full"
              />

              <div className="flex items-center justify-center gap-2">
                <VideoControls
                  playing={playState.isPlaying}
                  onToggle={controls.toggle}
                />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setIsRepeat((r) => !r)}
                      className={cn(
                        "h-8 w-8 border-white/30 text-white transition-all duration-200 hover:scale-105 shadow-sm",
                        isRepeat
                          ? "bg-primary/90 hover:bg-primary text-foreground-on-accent border-primary/50"
                          : "bg-white/10 hover:bg-white/20"
                      )}
                    >
                      <Repeat className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-surface-primary border-surface-tertiary text-foreground-default font-medium"
                  >
                    {isRepeat ? "Repeat On" : "Repeat Off"}
                  </TooltipContent>
                </Tooltip>
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

export default VideoPreview;
