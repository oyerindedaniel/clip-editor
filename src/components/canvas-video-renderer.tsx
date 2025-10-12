import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { InterpolatedResult } from "@/hooks/app/use-interpolated-transform";
import type { Variant } from "@/utils/scale-range";
import { useLatestValue } from "@/hooks/use-latest-value";
import type { Color } from "./color-palette";
import {
  CANVAS_RENDERER_SYMBOL,
  TaggedRendererComponent,
} from "@/utils/renderer";

export interface CanvasVideoRendererProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  transformData: InterpolatedResult;
  width: number;
  height: number;
  variant: Variant;
  className?: string;
  color?: Color;
  shouldPaint?: boolean;
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
  shouldPaint = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useLatestValue<InterpolatedResult>(transformData);
  const rafRef = useRef<number | null>(null);

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
    ctx.scale(dpr, dpr);

    if (!shouldPaint) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }

    const draw = () => {
      const video = videoRef.current;

      if (!video || video.readyState < 2) {
        console.log("--video", video, video?.readyState);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      console.log("after");

      ctx.clearRect(0, 0, width, height);
      const t = transformRef.current;

      // Stretch
      if (variant === "stretch") {
        ctx.save();
        const tx = (t.x - 0.5) * width;
        const ty = (t.y - 0.5) * height;
        ctx.translate(width / 2 + tx, height / 2 + ty);
        ctx.scale(t.scale, t.scale);
        ctx.drawImage(video, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      // Crop
      else if (variant === "crop") {
        const vw = video.videoWidth || video.clientWidth || width;
        const vh = video.videoHeight || video.clientHeight || height;
        if (vw === 0 || vh === 0) {
          rafRef.current = requestAnimationFrame(draw);
          return;
        }

        const baseAR = t.baseAR;
        const targetAR = t.targetAR;
        const scaleX = t.scale;
        const scaleY = t.scale * (targetAR / baseAR);
        const srcW = vw / scaleX;
        const srcH = vh / scaleY;
        const centerX = t.x * vw;
        const centerY = t.y * vh;
        const sx = Math.min(Math.max(centerX - srcW / 2, 0), vw - srcW);
        const sy = Math.min(Math.max(centerY - srcH / 2, 0), vh - srcH);
        ctx.drawImage(video, sx, sy, srcW, srcH, 0, 0, width, height);
      }
      // Fit
      else {
        const vw = video.videoWidth || video.clientWidth || width;
        const vh = video.videoHeight || video.clientHeight || height;
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
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldPaint, width, height, variant, color, transformRef, videoRef]);

  return <canvas ref={canvasRef} className={cn("bg-red-800", className)} />;
};

CanvasVideoRenderer.displayName = "CanvasVideoRenderer";
CanvasVideoRenderer._rendererType = CANVAS_RENDERER_SYMBOL;

export default CanvasVideoRenderer;
