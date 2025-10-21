import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  memo,
} from "react";
import { useClock } from "@/hooks/app/use-clock";
import { useDualVideoSync } from "@/hooks/app/use-dual-video-sync";

type TrimData = {
  trimStartMs: number;
  trimEndMs: number;
  timelineOffsetMs: number;
};

type PreviewMode = "native" | "canvas";

type PipPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  normX: number;
  normY: number;
};

type DualPreviewProps = {
  clock: ReturnType<typeof useClock>;
  primarySrc: string;
  secondarySrc: string;
  primaryTrim: TrimData;
  secondaryTrim: TrimData;
  pip: PipPosition;
  mode?: PreviewMode;
  canvasWidth?: number;
  canvasHeight?: number;
};

function DualPreview(props: DualPreviewProps) {
  const {
    clock,
    primarySrc,
    secondarySrc,
    primaryTrim,
    secondaryTrim,
    pip,
    mode = "native",
    canvasWidth = 1280,
    canvasHeight = 720,
  } = props;

  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [renderMode, setRenderMode] = useState<PreviewMode>(mode);

  useEffect(() => setRenderMode(mode), [mode]);

  const handleRender = useCallback(
    (timelineMs: number) => {
      const canvas = canvasRef.current;
      const pVid = primaryVideoRef.current;
      const sVid = secondaryVideoRef.current;
      if (!canvas || !pVid || !sVid) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvasWidth;
      const height = canvasHeight;

      if (
        canvas.width !== Math.round(width * dpr) ||
        canvas.height !== Math.round(height * dpr)
      ) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      try {
        ctx.drawImage(pVid, 0, 0, width, height);
      } catch {}

      const secDurationMs = secondaryTrim.trimEndMs - secondaryTrim.trimStartMs;
      const secStartMs = secondaryTrim.timelineOffsetMs;
      const secEndMs = secStartMs + secDurationMs;
      const isActive = timelineMs >= secStartMs && timelineMs <= secEndMs;

      if (isActive) {
        const pipW = pip.width * pip.scale;
        const pipH = pip.height * pip.scale;
        const pipX = pip.normX * width;
        const pipY = pip.normY * height;

        ctx.save();

        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4);
        ctx.shadowBlur = 0;

        try {
          ctx.drawImage(sVid, pipX, pipY, pipW, pipH);
        } catch {}
        ctx.restore();
      }

      ctx.restore();
    },
    [canvasWidth, canvasHeight, pip, secondaryTrim]
  );

  // useDualVideoSync({
  //   clock,
  //   primaryVideoRef,
  //   secondaryVideoRef,
  //   primaryTrim,
  //   secondaryTrim,
  //   onRender: renderMode === "canvas" ? handleRender : undefined,
  // });

  useEffect(() => {
    const p = primaryVideoRef.current;
    const s = secondaryVideoRef.current;
    if (p) {
      p.src = primarySrc;
      p.preload = "auto";
      p.playsInline = true;
      p.muted = true;
    }
    if (s) {
      s.src = secondarySrc;
      s.preload = "auto";
      s.playsInline = true;
      s.muted = true;
    }
  }, [primarySrc, secondarySrc]);

  const handleToggleMode = useCallback(() => {
    setRenderMode((prev) => (prev === "native" ? "canvas" : "native"));
  }, []);

  const pipStyle = useMemo(() => {
    return {
      position: "absolute" as const,
      left: `${pip.x}px`,
      top: `${pip.y}px`,
      width: `${pip.width}px`,
      height: `${pip.height}px`,
      transform: `scale(${pip.scale})`,
      transformOrigin: "top left",
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
      transition: "transform 0.12s linear",
    };
  }, [pip]);

  return (
    <div
      style={{
        position: "relative",
        width: canvasWidth,
        height: canvasHeight,
        background: "#000",
        overflow: "hidden",
      }}
    >
      {renderMode === "native" ? (
        <>
          <video
            ref={primaryVideoRef}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            playsInline
          />
          <video ref={secondaryVideoRef} style={pipStyle} playsInline />
        </>
      ) : (
        <>
          <canvas ref={canvasRef} />
          <video
            ref={primaryVideoRef}
            style={{ display: "none" }}
            playsInline
          />
          <video
            ref={secondaryVideoRef}
            style={{ display: "none" }}
            playsInline
          />
        </>
      )}

      <div
        style={{
          position: "absolute",
          left: 8,
          top: 8,
          zIndex: 99,
        }}
      >
        <button onClick={handleToggleMode}>
          {renderMode === "native" ? "Canvas" : "Native"}
        </button>
      </div>
    </div>
  );
}

export default memo(DualPreview);
