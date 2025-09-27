"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface VideoSeekBarProps {
  primaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  primaryTrim: { trimStart: number; trimEnd: number };
  isPlaying: boolean;
  onSeek: (timeMs: number) => void;
  className?: React.HTMLAttributes<HTMLDivElement>["className"];
}

export const VideoSeekBar: React.FC<VideoSeekBarProps> = ({
  primaryVideoRef,
  primaryTrim,
  isPlaying,
  onSeek,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const seekBarRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  const trimDurationMs = primaryTrim.trimEnd - primaryTrim.trimStart;
  const trimDurationSec = trimDurationMs / 1000;

  const updateProgress = useCallback(() => {
    const video = primaryVideoRef.current;
    if (!video || isDragging) return;

    const currentTimeMs = video.currentTime * 1000;
    const relativeTime = Math.max(0, currentTimeMs - primaryTrim.trimStart);
    const newProgress = Math.min(100, (relativeTime / trimDurationMs) * 100);

    setProgress(newProgress);
  }, [primaryVideoRef, primaryTrim, trimDurationMs, isDragging]);

  useEffect(() => {
    const animate = () => {
      updateProgress();
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, updateProgress]);

  useEffect(() => {
    if (!isPlaying) {
      updateProgress();
    }
  }, [isPlaying, updateProgress]);

  const getTimeFromPosition = useCallback(
    (clientX: number): number => {
      const seekBar = seekBarRef.current;
      if (!seekBar) return primaryTrim.trimStart;

      const rect = seekBar.getBoundingClientRect();
      const clickPercent = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      return primaryTrim.trimStart + clickPercent * trimDurationMs;
    },
    [primaryTrim, trimDurationMs]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const timeMs = getTimeFromPosition(e.clientX);
      onSeek(timeMs);

      const newProgress =
        ((timeMs - primaryTrim.trimStart) / trimDurationMs) * 100;
      setProgress(newProgress);
    },
    [getTimeFromPosition, onSeek, primaryTrim, trimDurationMs]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const timeMs = getTimeFromPosition(e.clientX);
      onSeek(timeMs);

      const newProgress =
        ((timeMs - primaryTrim.trimStart) / trimDurationMs) * 100;
      setProgress(newProgress);
    },
    [isDragging, getTimeFromPosition, onSeek, primaryTrim, trimDurationMs]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleHover = useCallback(
    (e: React.MouseEvent) => {
      const seekBar = seekBarRef.current;
      if (!seekBar) return;

      const rect = seekBar.getBoundingClientRect();
      const timeMs = getTimeFromPosition(e.clientX);
      setHoverTime(timeMs);
      setHoverX(e.clientX - rect.left);
    },
    [getTimeFromPosition]
  );

  const handleHoverLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const formatTime = useCallback((timeMs: number): string => {
    const seconds = Math.floor(timeMs / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const currentTimeMs =
    primaryTrim.trimStart + (progress / 100) * trimDurationMs;

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex justify-between text-xs text-foreground-muted font-mono">
        <span>{formatTime(currentTimeMs)}</span>
        <span>{formatTime(primaryTrim.trimEnd)}</span>
      </div>

      <div className="relative">
        <div
          ref={seekBarRef}
          className="relative h-1.5 bg-surface-tertiary/60 rounded-full cursor-pointer group hover:h-2 transition-all duration-200"
          onMouseDown={handleMouseDown}
          onMouseMove={handleHover}
          onMouseLeave={handleHoverLeave}
        >
          <div className="absolute inset-0 bg-surface-tertiary/60 rounded-full" />

          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />

          <div
            className={cn(
              "absolute top-1/2 w-3 h-3 bg-primary border-2 border-surface-primary rounded-full shadow-md transform -translate-y-1/2 -translate-x-1/2 transition-all duration-200",
              "opacity-0 group-hover:opacity-100",
              isDragging && "opacity-100 scale-110"
            )}
            style={{ left: `${progress}%` }}
          />

          {hoverTime !== null && !isDragging && (
            <div
              className="absolute bottom-full mb-2 px-2 py-1 bg-surface-primary/95 backdrop-blur-sm border border-surface-tertiary/50 rounded-md text-xs font-mono whitespace-nowrap transform -translate-x-1/2 pointer-events-none shadow-lg"
              style={{ left: hoverX }}
            >
              {formatTime(hoverTime)}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-surface-primary/95" />
            </div>
          )}
        </div>

        <div className="absolute top-0 left-0 right-0 h-2 rounded-full overflow-hidden pointer-events-none"></div>
      </div>
    </div>
  );
};
