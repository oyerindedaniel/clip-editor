import React, { useEffect, useRef } from "react";
import type { InterpolatedResult } from "@/hooks/app/use-interpolated-transform";
import type { Variant } from "@/utils/scale-range";

interface CanvasVideoRendererProps {
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  transformData: InterpolatedResult;
  width: number;
  height: number;
  variant: Variant;
  className?: string;
}

export function CanvasVideoRenderer({
  videoElementRef,
  transformData,
  width,
  height,
  variant,
  className,
}: CanvasVideoRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useRef<InterpolatedResult>(transformData);

  useEffect(() => {
    transformRef.current = transformData;
  }, [transformData]);

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

    let rafId: number | null = null;

    const draw = () => {
      const v = videoElementRef.current;
      if (!v || v.readyState < 2) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      const t = transformRef.current;

      if (variant === "stretch") {
        ctx.save();
        const tx = (t.x - 0.5) * width;
        const ty = (t.y - 0.5) * height;
        ctx.translate(width / 2 + tx, height / 2 + ty);
        ctx.scale(t.scale, t.scale);
        ctx.drawImage(v, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else if (variant === "crop") {
        const vw = v.videoWidth || v.clientWidth || width;
        const vh = v.videoHeight || v.clientHeight || height;
        if (vw === 0 || vh === 0) {
          rafId = requestAnimationFrame(draw);
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
        ctx.drawImage(v, sx, sy, srcW, srcH, 0, 0, width, height);
      } else {
        const vw = v.videoWidth || v.clientWidth || width;
        const vh = v.videoHeight || v.clientHeight || height;
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
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(v, 0, 0, vw, vh, dx, dy, destW, destH);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [videoElementRef, width, height, variant]);

  return <canvas ref={canvasRef} className={className} />;
}
