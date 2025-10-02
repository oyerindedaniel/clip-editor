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
import { useStableHandler } from "@/hooks/use-stable-handler";
import { HitArea } from "./hit-area";

interface VideoSeekBarProps {
  primaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef?: React.RefObject<HTMLVideoElement | null>;
  primaryTrim: TrimData;
  secondaryTrim: TrimData | null;
  isPlaying: boolean;
  onSeek: (normalizedTimeMs: number) => void;
  className?: React.HTMLAttributes<HTMLDivElement>["className"];
  primaryBuffered?: TimeRanges | null;
  secondaryBuffered?: TimeRanges | null;
}

export const VideoSeekBar: React.FC<VideoSeekBarProps> = ({
  primaryVideoRef,
  secondaryVideoRef,
  primaryTrim,
  primaryBuffered,
  secondaryBuffered,
  secondaryTrim,
  isPlaying,
  onSeek,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const seekBarRef = useRef<HTMLDivElement | null>(null);
  const bufferFillRef = useRef<HTMLDivElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number>(0);
  const visualUpdateRef = useRef<number>(0);
  const progressRef = useRef(0);
  const currentTimeDisplayRef = useRef<HTMLSpanElement | null>(null);

  const stableOnSeek = useStableHandler(onSeek);

  const calculateTimelineDuration = useCallback(() => {
    const primaryDuration = primaryTrim.trimEnd - primaryTrim.trimStart;

    if (!secondaryTrim) return primaryDuration;

    const secondaryDuration = secondaryTrim.trimEnd - secondaryTrim.trimStart;
    const secondaryOffset = secondaryTrim.timelineOffset || 0;
    const secondaryEnd = secondaryOffset + secondaryDuration;

    return Math.max(primaryDuration, secondaryEnd);
  }, [primaryTrim, secondaryTrim]);

  const timelineDurationMs = calculateTimelineDuration();

  const getCurrentNormalizedTime = useCallback(() => {
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
  }, [primaryTrim, secondaryTrim]);

  const updateBufferDisplay = useCallback(() => {
    if (!bufferFillRef.current) return;

    const primary = primaryVideoRef.current;
    if (!primary) return;

    let primaryBufferedMs = 0;
    if (primaryBuffered) {
      const primaryCurrentSec = primary.currentTime;
      for (let i = 0; i < primaryBuffered.length; i++) {
        const start = primaryBuffered.start(i);
        const end = primaryBuffered.end(i);
        if (primaryCurrentSec >= start && primaryCurrentSec <= end) {
          const bufferedEndMs = end * 1000 - primaryTrim.trimStart;
          primaryBufferedMs = Math.max(0, bufferedEndMs);
          break;
        }
      }
    }

    let totalBufferedMs = primaryBufferedMs;

    if (secondaryTrim && secondaryBuffered) {
      const secondaryOffset = secondaryTrim.timelineOffset || 0;
      const secondaryDuration = secondaryTrim.trimEnd - secondaryTrim.trimStart;
      const secondaryEnd = secondaryOffset + secondaryDuration;

      if (secondaryEnd > primaryTrim.trimEnd - primaryTrim.trimStart) {
        const secondary = secondaryVideoRef?.current;
        if (secondary) {
          for (let i = 0; i < secondaryBuffered.length; i++) {
            const start = secondaryBuffered.start(i);
            const end = secondaryBuffered.end(i);
            const secondaryCurrentSec = secondary.currentTime;

            if (secondaryCurrentSec >= start && secondaryCurrentSec <= end) {
              const bufferedEndMs =
                end * 1000 - secondaryTrim.trimStart + secondaryOffset;
              totalBufferedMs = Math.max(totalBufferedMs, bufferedEndMs);
              break;
            }
          }
        }
      }
    }

    const bufferProgress = Math.min(1, totalBufferedMs / timelineDurationMs);
    bufferFillRef.current.style.transform = `scaleX(${bufferProgress})`;
  }, [
    primaryBuffered,
    secondaryBuffered,
    primaryTrim,
    secondaryTrim,
    timelineDurationMs,
  ]);

  const updateVisualElements = useCallback(
    (progress: number) => {
      const barEl = seekBarRef.current;
      if (!barEl) return;

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

      updateBufferDisplay();
    },
    [timelineDurationMs, updateBufferDisplay]
  );

  const scheduleVisualUpdate = useCallback(
    (progress: number) => {
      if (visualUpdateRef.current) {
        cancelAnimationFrame(visualUpdateRef.current);
      }

      visualUpdateRef.current = requestAnimationFrame(() => {
        updateVisualElements(progress);
      });
    },
    [updateVisualElements]
  );

  const updateProgress = useCallback(() => {
    const normalizedTimeMs = getCurrentNormalizedTime();
    let newProgress = 0;
    if (timelineDurationMs > 0 && Number.isFinite(normalizedTimeMs)) {
      newProgress = Math.min(1, normalizedTimeMs / timelineDurationMs);
    }

    updateVisualElements(newProgress);
  }, [getCurrentNormalizedTime, timelineDurationMs, updateVisualElements]);

  const stableUpdateProgress = useStableHandler(updateProgress);

  useEffect(() => {
    const animate = () => {
      if (!isDragging) {
        stableUpdateProgress();
      }
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      stableUpdateProgress();
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      cancelAnimationFrame(visualUpdateRef.current);
    };
  }, [isPlaying, isDragging, stableUpdateProgress]);

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
    () => throttle((timeMs: number) => stableOnSeek(timeMs), 100),
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const normalizedTimeMs = getTimeFromPosition(e.clientX);
      stableOnSeek(normalizedTimeMs);

      const newProgress = normalizedTimeMs / timelineDurationMs;
      scheduleVisualUpdate(newProgress);

      setHoverTime(normalizedTimeMs);
    },
    [getTimeFromPosition, timelineDurationMs, scheduleVisualUpdate]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
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

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);

      return () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const handleHover = useCallback(
    (e: React.PointerEvent) => {
      const seekBar = seekBarRef.current;
      if (!seekBar) return;

      const normalizedProgressMs = progressRef.current * timelineDurationMs;

      setIsHovered(true);
      setHoverTime(normalizedProgressMs);
    },
    [getTimeFromPosition, timelineDurationMs]
  );

  const handleHoverLeave = useCallback(() => {
    setIsHovered(false);
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
      <div className="flex justify-between text-xs text-white">
        <span ref={currentTimeDisplayRef} />
        <span>{formatTime(timelineDurationMs)}</span>
      </div>

      <HitArea
        buffer={10}
        variant="y"
        className="relative cursor-pointer rounded-full bg-primary/30 h-[4.5px] hover:h-[5px] transition-[height] duration-300"
        ref={seekBarRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handleHover}
        onPointerLeave={handleHoverLeave}
      >
        <div>
          <div
            ref={bufferFillRef}
            className="absolute inset-0 bg-primary/30 rounded-full origin-left will-change-transform"
          />

          <div
            ref={progressFillRef}
            className="absolute inset-0 bg-primary rounded-full origin-left will-change-transform"
          />

          <Tooltip open={isHovered}>
            <TooltipTrigger asChild className="z-10">
              <HitArea buffer={8} variant="all">
                <div
                  ref={thumbRef}
                  className="absolute top-1/2 left-0 w-2.5 h-2.5 rounded-full bg-primary shadow-lg will-change-transform"
                />
              </HitArea>
            </TooltipTrigger>
            <TooltipContent side="top">
              {formatTime(hoverTime || 0)}
            </TooltipContent>
          </Tooltip>
        </div>
      </HitArea>
    </div>
  );
};
