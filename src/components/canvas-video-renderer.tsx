import React, { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { InterpolatedResult } from "@/hooks/app/use-interpolated-transform";
import type { CropMode, BackgroundMode, BackgroundVideo } from "@/types/app";
import { useLatestValue } from "@/hooks/use-latest-value";
import type { Color } from "./color-palette";
import {
  CANVAS_RENDERER_SYMBOL,
  TaggedRendererComponent,
} from "@/utils/renderer";

/**
 * CanvasVideoRendererProps
 *
 * @property {boolean} [renderEnabled=true] -
 * When false, the canvas renderer suspends all painting.
 * When true, the canvas repaints continuously **if** the underlying video is playing,
 * or repaints on-demand when external state changes (e.g. scrubbing, resize, filter updates).
 */
export interface CanvasVideoRendererProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  transformData: InterpolatedResult;
  width: number;
  height: number;
  variant: CropMode;
  className?: string;
  color?: Color;
  renderEnabled?: boolean;
  // Background settings for letterbox mode
  backgroundMode?: BackgroundMode;
  backgroundVideo?: BackgroundVideo;
  backgroundVideoRef?: React.RefObject<HTMLVideoElement | null>;
  backgroundAlign?: "left" | "center" | "right";
  backgroundOpacity?: number;
  backgroundBlur?: number;
}

const CanvasVideoRenderer: TaggedRendererComponent<
  CanvasVideoRendererProps
> = ({
  videoRef,
  transformData,
  width,
  height,
  variant,
  color,
  className,
  renderEnabled = true,
  backgroundMode = "pad-color",
  backgroundVideo = "primary",
  backgroundVideoRef,
  backgroundAlign = "center",
  backgroundOpacity = 0.3,
  backgroundBlur = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useLatestValue<InterpolatedResult>(transformData);
  const callbackIdRef = useRef<number | null>(null);

  const widthRef = useLatestValue(width);
  const heightRef = useLatestValue(height);
  const variantRef = useLatestValue(variant);
  const colorRef = useLatestValue(color);
  const backgroundModeRef = useLatestValue(backgroundMode);
  const backgroundAlignRef = useLatestValue(backgroundAlign);
  const backgroundOpacityRef = useLatestValue(backgroundOpacity);
  const backgroundBlurRef = useLatestValue(backgroundBlur);

  const drawBackground = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    align: "left" | "center" | "right",
    opacity: number,
    blurPx: number
  ) => {
    if (backgroundModeRef.current === "video" && backgroundVideoRef?.current) {
      const bgVideo = backgroundVideoRef.current;
      if (bgVideo.readyState >= 2) {
        const prevAlpha = ctx.globalAlpha;
        const prevFilter = ctx.filter ?? "none";
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        ctx.filter = `blur(${Math.max(0, blurPx)}px)`;

        const bgAR = bgVideo.videoWidth / bgVideo.videoHeight;
        const canvasAR = width / height;
        let drawW: number, drawH: number, bgDx: number, bgDy: number;
        if (bgAR > canvasAR) {
          drawH = height;
          drawW = bgAR * drawH;
          if (align === "left") bgDx = 0;
          else if (align === "right") bgDx = width - drawW;
          else bgDx = (width - drawW) / 2;
          bgDy = 0;
        } else {
          drawW = width;
          drawH = drawW / bgAR;
          bgDx = 0;
          bgDy = (height - drawH) / 2;
        }
        ctx.drawImage(bgVideo, bgDx, bgDy, drawW, drawH);
        ctx.globalAlpha = prevAlpha;
        ctx.filter = prevFilter;
      } else {
        ctx.fillStyle = colorRef.current ?? "black";
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.fillStyle = colorRef.current ?? "black";
      ctx.fillRect(0, 0, width, height);
    }
  };

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const video = videoRef.current;
    if (!canvas || !ctx || !video) return;

    if (video.readyState < 2) return;

    const transform = transformRef.current;
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (vw <= 0 || vh <= 0) return;

    ctx.clearRect(0, 0, widthRef.current, heightRef.current);

    // Crop: maintains target aspect ratio, crops excess, applies scale as zoom
    if (variantRef.current === "crop") {
      // draw background if crop with non 9:16 aspect is in effect
      drawBackground(
        ctx,
        widthRef.current,
        heightRef.current,
        backgroundAlignRef.current,
        backgroundOpacityRef.current ?? 0.3,
        backgroundBlurRef.current ?? 0
      );
      const baseAR = transform.baseAR;
      const targetAR = transform.targetAR;

      let srcW: number, srcH: number;

      if (baseAR > targetAR) {
        srcH = vh / transform.scale;
        srcW = srcH * targetAR;
      } else {
        srcW = vw / transform.scale;
        srcH = srcW / targetAR;
      }

      if (srcW > vw) srcW = vw;
      if (srcH > vh) srcH = vh;

      const sx = transform.x * vw;
      const sy = transform.y * vh;

      const clampedSx = clampToRange(sx, 0, Math.max(0, vw - srcW));
      const clampedSy = clampToRange(sy, 0, Math.max(0, vh - srcH));

      ctx.drawImage(
        video,
        clampedSx,
        clampedSy,
        srcW,
        srcH,
        0,
        0,
        widthRef.current,
        heightRef.current
      );
      return;
    }

    // Fit/letterbox (default): shows full video with background, no transforms applied
    {
      const srcAR = vw / vh;
      let destW = widthRef.current;
      let destH = heightRef.current;
      let dx = 0;
      let dy = 0;

      if (srcAR > widthRef.current / heightRef.current) {
        destW = widthRef.current;
        destH = destW / srcAR;
        dy = (heightRef.current - destH) / 2;
      } else {
        destH = heightRef.current;
        destW = destH * srcAR;

        if (backgroundAlignRef.current === "left") {
          dx = 0;
        } else if (backgroundAlignRef.current === "right") {
          dx = widthRef.current - destW;
        } else {
          dx = (widthRef.current - destW) / 2;
        }
      }

      // Background fill or cover video
      drawBackground(
        ctx,
        widthRef.current,
        heightRef.current,
        backgroundAlignRef.current,
        backgroundOpacityRef.current ?? 0.3,
        backgroundBlurRef.current ?? 0
      );

      ctx.drawImage(video, 0, 0, vw, vh, dx, dy, destW, destH);
      return;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!renderEnabled) {
      drawFrame();
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const videoFrameCallback = () => {
      if (!renderEnabled) return;

      drawFrame();

      if (video) {
        callbackIdRef.current =
          video.requestVideoFrameCallback(videoFrameCallback);
      }
    };

    if (video) {
      drawFrame();
      callbackIdRef.current =
        video.requestVideoFrameCallback(videoFrameCallback);
    } else {
      drawFrame();
    }

    return () => {
      if (callbackIdRef.current !== null && video) {
        video.cancelVideoFrameCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
    };
  }, [renderEnabled, drawFrame]);

  return <canvas ref={canvasRef} className={cn("", className)} />;
};

CanvasVideoRenderer.displayName = "CanvasVideoRenderer";
CanvasVideoRenderer._rendererType = CANVAS_RENDERER_SYMBOL;

export default CanvasVideoRenderer;

function clampToRange(v: number, a: number, b: number) {
  if (!Number.isFinite(v)) return a;
  return Math.min(Math.max(v, a), b);
}
