import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { InterpolatedResult } from "@/hooks/app/use-interpolated-transform";
import type { Variant } from "@/utils/scale-range";
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
  variant: Variant;
  className?: string;
  color?: Color;
  renderEnabled?: boolean;
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useLatestValue<InterpolatedResult>(transformData);
  const rafIdRef = useRef<number | null>(null);

  const drawFrame = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const video = videoRef.current;
    if (!canvas || !ctx || !video) return;

    if (video.readyState < 2) return;

    const transform = transformRef.current;
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (vw <= 0 || vh <= 0) return;

    ctx.clearRect(0, 0, width, height);

    // Stretch: distorts video to fill canvas, applies uniform scale and position offset
    if (variant === "stretch") {
      ctx.save();

      const tx = (transform.x - 0.5) * width;
      const ty = (transform.y - 0.5) * height;

      ctx.translate(width / 2 + tx, height / 2 + ty);
      ctx.scale(transform.scale, transform.scale);

      ctx.drawImage(video, -width / 2, -height / 2, width, height);
      ctx.restore();
      return;
    }

    // Crop: maintains target aspect ratio, crops excess, applies scale as zoom
    if (variant === "crop") {
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
        width,
        height
      );
      return;
    }

    // Fit/letterbox (default): shows full video with black bars, no transforms applied
    {
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
        dx = (width - destW) / 2;
      }

      ctx.fillStyle = color ?? "black";
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(video, 0, 0, vw, vh, dx, dy, destW, destH);
      return;
    }
  };

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
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      drawFrame();
      return;
    }

    let mounted = true;

    const loop = () => {
      if (!mounted) return;
      drawFrame();

      const video = videoRef.current;
      if (video && !video.ended) {
        rafIdRef.current = requestAnimationFrame(loop);
      }
    };

    const video = videoRef.current;
    if (video && !video.ended) {
      rafIdRef.current = requestAnimationFrame(loop);
    } else {
      drawFrame();
    }

    return () => {
      mounted = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [renderEnabled, width, height, variant, color]);

  return <canvas ref={canvasRef} className={cn("", className)} />;
};

CanvasVideoRenderer.displayName = "CanvasVideoRenderer";
CanvasVideoRenderer._rendererType = CANVAS_RENDERER_SYMBOL;

export default CanvasVideoRenderer;

function clampToRange(v: number, a: number, b: number) {
  if (!Number.isFinite(v)) return a;
  return Math.min(Math.max(v, a), b);
}
