"use client";

import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { throttle } from "@/utils/app";
import type { TrimData } from "@/types/app";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface VideoSeekBarProps {
  primaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef?: React.RefObject<HTMLVideoElement | null>;
  primaryTrim: TrimData;
  secondaryTrim: TrimData | null;
  isPlaying: boolean;
  onSeek: (normalizedTimeMs: number) => void;
  className?: React.HTMLAttributes<HTMLDivElement>["className"];
}

export const VideoSeekBar: React.FC<VideoSeekBarProps> = ({
  primaryVideoRef,
  primaryTrim,
  secondaryTrim,
  isPlaying,
  onSeek,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const seekBarRef = useRef<HTMLDivElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number>(0);
  const visualUpdateRef = useRef<number>(0);
  const progressRef = useRef(0);
  const pendingVisualUpdate = useRef(false);
  const currentTimeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const lockedHoverTimeRef = useRef<number | null>(null);

  const calculateTimelineDuration = useCallback(() => {
    const primaryDuration = primaryTrim.trimEnd - primaryTrim.trimStart;

    if (!secondaryTrim) return primaryDuration;

    const secondaryDuration = secondaryTrim.trimEnd - secondaryTrim.trimStart;
    const secondaryOffset = secondaryTrim.timelineOffset || 0;
    const secondaryEnd = secondaryOffset + secondaryDuration;

    return Math.max(primaryDuration, secondaryEnd);
  }, [primaryTrim, secondaryTrim]);

  const timelineDurationMs = calculateTimelineDuration();

  const getCurrentNormalizedTime = useCallback(
    (secondaryVideoRef?: React.RefObject<HTMLVideoElement | null>) => {
      const primaryVideo = primaryVideoRef.current;
      const secondaryVideo = secondaryVideoRef?.current;
      if (!primaryVideo) return 0;

      const primaryCurrentMs = primaryVideo.currentTime * 1000;
      const primaryRelativeMs = Math.max(
        0,
        primaryCurrentMs - primaryTrim.trimStart
      );

      if (!secondaryTrim || !secondaryVideo) return primaryRelativeMs;

      const secondaryCurrentMs = secondaryVideo.currentTime * 1000;
      const secondaryRelativeMs = Math.max(
        0,
        secondaryCurrentMs - secondaryTrim.trimStart
      );
      const secondaryOffset = secondaryTrim.timelineOffset || 0;

      const primaryTimelinePos = primaryRelativeMs;
      const secondaryTimelinePos = secondaryOffset + secondaryRelativeMs;

      return Math.max(primaryTimelinePos, secondaryTimelinePos);
    },
    [primaryTrim, secondaryTrim]
  );

  const scheduleVisualUpdate = useCallback(
    (progress: number) => {
      const barEl = seekBarRef.current;
      if (!barEl) return;

      if (visualUpdateRef.current) {
        cancelAnimationFrame(visualUpdateRef.current);
      }

      visualUpdateRef.current = requestAnimationFrame(() => {
        const clamped = Math.max(0, Math.min(1, progress));
        progressRef.current = clamped;

        if (progressFillRef.current) {
          progressFillRef.current.style.transform = `scaleX(${clamped})`;
        }

        if (thumbRef.current) {
          const barWidth = barEl.offsetWidth;
          const x = clamped * barWidth;
          thumbRef.current.style.transform = `translate3d(${x}px, -50%, 0)`;
        }

        if (currentTimeDisplayRef.current) {
          const currentTimeMs = clamped * timelineDurationMs;

          currentTimeDisplayRef.current.textContent = formatTime(currentTimeMs);
        }
      });
    },
    [timelineDurationMs, primaryTrim.trimStart]
  );

  const updateProgress = useCallback(() => {
    const normalizedTimeMs = getCurrentNormalizedTime();
    let newProgress = 0;
    if (timelineDurationMs > 0 && Number.isFinite(normalizedTimeMs)) {
      newProgress = Math.min(1, normalizedTimeMs / timelineDurationMs);
    }

    scheduleVisualUpdate(newProgress);
  }, [getCurrentNormalizedTime, timelineDurationMs, scheduleVisualUpdate]);

  useEffect(() => {
    const animate = () => {
      if (!isDragging) {
        updateProgress();
      }
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      updateProgress();
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      cancelAnimationFrame(visualUpdateRef.current);
      pendingVisualUpdate.current = false;
    };
  }, [isPlaying, isDragging, updateProgress]);

  const getTimeFromPosition = useCallback(
    (clientX: number): number => {
      const seekBar = seekBarRef.current;
      if (!seekBar) return 0;

      const rect = seekBar.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      return ratio * timelineDurationMs;
    },
    [timelineDurationMs]
  );

  const throttledSeek = useMemo(
    () => throttle((timeMs: number) => onSeek(timeMs), 100),
    [onSeek]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const normalizedTimeMs = getTimeFromPosition(e.clientX);
      onSeek(normalizedTimeMs);

      const newProgress = normalizedTimeMs / timelineDurationMs;
      scheduleVisualUpdate(newProgress);
    },
    [getTimeFromPosition, onSeek, timelineDurationMs, scheduleVisualUpdate]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const normalizedTimeMs = getTimeFromPosition(e.clientX);
      throttledSeek(normalizedTimeMs);

      const newProgress = normalizedTimeMs / timelineDurationMs;
      scheduleVisualUpdate(newProgress);
    },
    [
      isDragging,
      getTimeFromPosition,
      throttledSeek,
      timelineDurationMs,
      scheduleVisualUpdate,
    ]
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

      const timeMs = getTimeFromPosition(e.clientX);

      const normalizedProgressMs = progressRef.current * timelineDurationMs;
      if (Math.abs(timeMs - normalizedProgressMs) < 50) {
        lockedHoverTimeRef.current = timeMs;
        setHoverTime(timeMs);
        return;
      }

      if (lockedHoverTimeRef.current !== null) {
        return;
      }

      setHoverTime(timeMs);
    },
    [getTimeFromPosition, timelineDurationMs]
  );

  const handleHoverLeave = useCallback(() => {
    setHoverTime(null);
    lockedHoverTimeRef.current = null;
  }, []);

  const formatTime = useCallback((timeMs: number): string => {
    const seconds = Math.floor(timeMs / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hours = Math.floor(mins / 60);
    const displayMins = mins % 60;

    if (hours > 0) {
      return `${hours}:${displayMins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${displayMins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex justify-between text-xs text-foreground-muted">
        <span ref={currentTimeDisplayRef}>0:00</span>
        <span>{formatTime(timelineDurationMs)}</span>
      </div>

      <div className="relative">
        <div
          ref={seekBarRef}
          className="relative h-[4.5px] bg-primary/30 rounded-full cursor-pointer group"
          onMouseDown={handleMouseDown}
          onMouseMove={handleHover}
          onMouseLeave={handleHoverLeave}
        >
          <div
            ref={progressFillRef}
            className="absolute top-0 left-0 h-full bg-primary rounded-full origin-left will-change-transform"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                ref={thumbRef}
                className="absolute top-1/2 left-0 w-2.5 h-2.5 bg-primary rounded-full shadow-lg will-change-transform"
              />
            </TooltipTrigger>
            <TooltipContent side="top">
              {formatTime(hoverTime || 0)}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
