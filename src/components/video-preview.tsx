import React, { useMemo, useRef, useEffect, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ASPECT_RATIOS, AspectRatio } from "@/utils/aspect-ratios";
import type { KeyframeData } from "@/utils/keyframe";
import { usePlaybackClock } from "@/hooks/app/use-playback-clock";
import {
  useInterpolatedTransform,
  InterpolatedResult,
} from "@/hooks/app/use-interpolated-transform";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { getElementRef } from "@/lib/get-element-ref";
import CanvasVideoRenderer from "./canvas-video-renderer";
import logger from "@/utils/logger";
import type { Variant } from "@/utils/scale-range";
import {
  CANVAS_RENDERER_SYMBOL,
  getRendererType,
  isRendererOfType,
} from "@/utils/renderer";

export type PreviewRenderContext = {
  source: React.ReactElement<
    React.VideoHTMLAttributes<HTMLVideoElement> & {
      ref?: React.Ref<HTMLVideoElement>;
    }
  >;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  transform: InterpolatedResult;
  time: number;
  duration: number | null;
  playing: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setTime: (t: number) => void;
  variant: Variant;
  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
};

export interface VideoPreviewProps {
  source: React.ReactElement<
    React.VideoHTMLAttributes<HTMLVideoElement> & {
      ref?: React.Ref<HTMLVideoElement>;
    }
  >;
  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
  variant: Variant;
  keyframes?: KeyframeData[];

  time?: number | null;
  onTimeChange?: (t: number) => void;

  defaultPlaying: boolean;
  playing?: boolean;
  onPlayingChange?: (p: boolean) => void;

  playbackRate?: number;
  loop?: boolean;

  children?: (context: PreviewRenderContext) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const VideoPreview = forwardRef<HTMLDivElement, VideoPreviewProps>(
  (props, forwardedRef) => {
    const {
      source,
      baseAspect,
      targetAspect,
      variant,
      keyframes,
      time: externalTime = null,
      onTimeChange,
      defaultPlaying = false,
      playing: externalPlaying = false,
      onPlayingChange,
      playbackRate = 1,
      loop = false,
      children,
      className,
      style,
    } = props;

    if (
      !React.isValidElement(source) ||
      typeof source.type !== "string" ||
      source.type !== "video"
    ) {
      logger.warn("VideoPreview: `source` must be a <video> React element.");
      return null;
    }

    const duration = useMemo<number | null>(() => {
      if (!keyframes || keyframes.length === 0) return null;
      return Math.max(...keyframes.map((k) => k.time));
    }, [keyframes]);

    const { time, setTime, playing, play, pause, toggle } = usePlaybackClock({
      externalTime,
      defaultTime: 0,
      externalPlaying,
      defaultPlaying,
      playbackRate,
      duration,
      loop,
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

    const videoRef = useRef<HTMLVideoElement | null>(null);

    const composedRef = useComposedRefs(videoRef, getElementRef(source));

    const clonedVideoElement = useMemo(() => {
      return React.cloneElement(source, {
        ref: composedRef,
        muted: source.props.muted ?? true,
        preload: source.props.preload ?? "auto",
        playsInline: source.props.playsInline ?? true,
      });
    }, [source, videoRef]);

    // ensure media element seeks to preview time (helps Canvas renderer to sample frames)
    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      try {
        // only seek when difference is significant to avoid thrash
        const prev = v.currentTime || 0;
        if (Math.abs(prev - time) > 0.05) {
          if (v.readyState >= 2) {
            v.currentTime = Math.max(0, Math.min(v.duration || Infinity, time));
          } else {
            const onLoaded = () => {
              try {
                v.currentTime = Math.max(
                  0,
                  Math.min(v.duration || Infinity, time)
                );
              } catch {
                // ignore
              }
              v.removeEventListener("loadedmetadata", onLoaded);
            };
            v.addEventListener("loadedmetadata", onLoaded);
          }
        }
      } catch {
        // ignore seek errors (some origins/browsers disallow)
      }
    }, [time]);

    // sync playback state to the underlying media element
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      try {
        video.playbackRate = playbackRate;
        if (playing) {
          void video.play().catch(() => {
            /* autoplay blocked */
          });
        } else {
          video.pause();
        }
      } catch {
        // ignore
      }
    }, [playing, playbackRate]);

    const context: PreviewRenderContext = useMemo(
      () => ({
        source,
        videoRef,
        transform,
        time,
        duration,
        playing,
        play,
        pause,
        toggle,
        setTime,
        variant,
        baseAspect,
        targetAspect,
      }),
      [
        clonedVideoElement,
        videoRef,
        transform,
        time,
        duration,
        playing,
        play,
        pause,
        toggle,
        setTime,
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

    console.log({ isChildCanvasRenderer });

    return (
      <div
        ref={forwardedRef}
        className={cn(
          "relative overflow-hidden rounded-lg shadow-md w-full aspect-(--aspect-ratio)",
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

        {/* Hidden video element kept mounted as a frame source for CanvasVideoRenderer to read and paint from */}
        {isChildCanvasRenderer
          ? React.cloneElement(clonedVideoElement, {
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
