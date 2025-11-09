import React, { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { InterpolatedResult } from "@/hooks/app/use-interpolated-transform";
import type { CropMode, BackgroundMode, BackgroundVideo } from "@/types/app";
import type { Color } from "./color-palette";
import {
  CANVAS_RENDERER_SYMBOL,
  TaggedRendererComponent,
} from "@/utils/renderer";
import { useStableHandler } from "@/hooks/use-stable-handler";

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
  const callbackIdRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isMountedRef = useRef(false);

  const drawBackground = useStableHandler(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      align: "left" | "center" | "right",
      opacity: number,
      blurPx: number
    ) => {
      if (backgroundMode === "video" && backgroundVideoRef?.current) {
        const bgVideo = backgroundVideoRef.current;
        if (bgVideo.readyState >= 2) {
          const prevAlpha = ctx.globalAlpha;
          const prevFilter = ctx.filter ?? "none";
          ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
          ctx.filter = `blur(${Math.max(0, blurPx)}px)`;

          const bgAR = bgVideo.videoWidth / bgVideo.videoHeight;
          const canvasAR = w / h;
          let drawW: number, drawH: number, bgDx: number, bgDy: number;

          if (bgAR > canvasAR) {
            drawH = h;
            drawW = bgAR * drawH;
            if (align === "left") bgDx = 0;
            else if (align === "right") bgDx = w - drawW;
            else bgDx = (w - drawW) / 2;
            bgDy = 0;
          } else {
            drawW = w;
            drawH = drawW / bgAR;
            bgDx = 0;
            bgDy = (h - drawH) / 2;
          }

          ctx.drawImage(bgVideo, bgDx, bgDy, drawW, drawH);
          ctx.globalAlpha = prevAlpha;
          ctx.filter = prevFilter;
        } else {
          ctx.fillStyle = color ?? "black";
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        ctx.fillStyle = color ?? "black";
        ctx.fillRect(0, 0, w, h);
      }
    }
  );

  const drawFrame = useStableHandler(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const video = videoRef.current;
    if (!canvas || !ctx || !video) return;

    if (video.readyState < 2) return;

    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (vw <= 0 || vh <= 0) return;

    ctx.clearRect(0, 0, width, height);

    // Crop: maintains target aspect ratio, crops excess, applies scale as zoom
    if (variant === "crop") {
      drawBackground(
        ctx,
        width,
        height,
        backgroundAlign,
        backgroundOpacity ?? 0.3,
        backgroundBlur ?? 0
      );

      const transform = transformData;
      const baseAR = transform.baseAR;
      const targetAR = transform.targetAR;
      const scale = transform.scale ?? 1;

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      let srcW: number, srcH: number;
      if (baseAR > targetAR) {
        srcH = vh / scale;
        srcW = srcH * targetAR;
      } else {
        srcW = vw / scale;
        srcH = srcW / targetAR;
      }

      if (srcW > vw) srcW = vw;
      if (srcH > vh) srcH = vh;

      const sx = clampToRange(transform.x * vw, 0, vw - srcW);
      const sy = clampToRange(transform.y * vh, 0, vh - srcH);

      const destW = width;
      const destH = width / targetAR;

      let dx = 0;
      if (backgroundAlign === "center") {
        dx = (width - destW) / 2;
      } else if (backgroundAlign === "right") {
        dx = width - destW;
      } else {
        dx = 0;
      }

      const dy = (height - destH) / 2;

      ctx.drawImage(video, sx, sy, srcW, srcH, dx, dy, destW, destH);
      return;
    }

    // Fit/letterbox (default): shows full video with background, no transforms applied
    const srcAR = vw / vh;
    let destW = width;
    let destH = height;
    let dx = 0;
    let dy = 0;

    if (srcAR > width / height) {
      destW = width;
      destH = destW / srcAR;
      dy = (height - destH) / 2;
    } else {
      destH = height;
      destW = destH * srcAR;

      if (backgroundAlign === "left") dx = 0;
      else if (backgroundAlign === "right") dx = width - destW;
      else dx = (width - destW) / 2;
    }

    drawBackground(
      ctx,
      width,
      height,
      backgroundAlign,
      backgroundOpacity ?? 0.3,
      backgroundBlur ?? 0
    );

    ctx.drawImage(video, 0, 0, vw, vh, dx, dy, destW, destH);
  });

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

    if (!isMountedRef.current) {
      isMountedRef.current = true;
      timeoutRef.current = setTimeout(() => {
        drawFrame();
        timeoutRef.current = null;
      }, 50);
    } else {
      drawFrame();
    }

    callbackIdRef.current = video.requestVideoFrameCallback(videoFrameCallback);
  }, [renderEnabled, width, height, drawFrame]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const video = videoRef.current;
      if (callbackIdRef.current !== null && video) {
        video.cancelVideoFrameCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
    };
  }, []);

  return <canvas ref={canvasRef} className={cn("", className)} />;
};

CanvasVideoRenderer.displayName = "CanvasVideoRenderer";
CanvasVideoRenderer._rendererType = CANVAS_RENDERER_SYMBOL;

export default CanvasVideoRenderer;

function clampToRange(v: number, a: number, b: number) {
  if (!Number.isFinite(v)) return a;
  return Math.min(Math.max(v, a), b);
}
