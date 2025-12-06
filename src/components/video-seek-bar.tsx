"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { debounce } from "@/utils/app";
import type { TrimData } from "@/types/app";
import { useStableHandler } from "@/hooks/use-stable-handler";
import { HitArea } from "./hit-area";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { formatTime } from "@/utils/app";
import { useRAF, useRAFTrigger } from "@/hooks/use-raf";
import { generateVideoId, secondsToMs } from "@/utils/video";
import { RAF_IDS } from "@/constants/raf-ids";
import { globalRAF } from "@/lib/raf-manager";
import { useIsoLayoutEffect } from "@/hooks/use-Isomorphic-layout-effect";

interface SeekContextValue {
  primaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef?: React.RefObject<HTMLVideoElement | null>;
  primaryTrim: TrimData;
  secondaryTrim: TrimData | null;
  isPlaying: boolean;
  onSeek: (normalizedTimeMs: number) => void;
  primaryBuffered?: TimeRanges | null;
  secondaryBuffered?: TimeRanges | null;
  timelineDurationMs: number;
  progressRef: React.RefObject<number>;
  _bufferRef: React.RefObject<HTMLDivElement | null>;
  _progressRef: React.RefObject<HTMLDivElement | null>;
  _thumbRef: React.RefObject<HTMLDivElement | null>;
  currentTimeRef: React.RefObject<HTMLSpanElement | null>;
  _trackRef: React.RefObject<HTMLDivElement | null>;
  // Accessibility IDs
  seekSliderId: string;
  currentTimeId: string;
  durationId: string;

  rafId: string;
}

const SeekContext = React.createContext<SeekContextValue | null>(null);

function useSeekContext(): SeekContextValue {
  const context = React.useContext(SeekContext);
  if (!context) {
    throw new Error("Seek components must be used within <Seek.Root>");
  }
  return context;
}

interface SeekRootProps {
  primaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef?: React.RefObject<HTMLVideoElement | null>;
  primaryTrim: TrimData;
  secondaryTrim: TrimData | null;
  isPlaying: boolean;
  onSeek: (normalizedTimeMs: number) => void;
  primaryBuffered?: TimeRanges | null;
  secondaryBuffered?: TimeRanges | null;
  children: React.ReactNode;
  videoId?: string;
}

function SeekRoot({
  primaryVideoRef,
  secondaryVideoRef,
  primaryTrim,
  secondaryTrim,
  isPlaying,
  onSeek,
  primaryBuffered,
  secondaryBuffered,
  children,
  videoId,
}: SeekRootProps) {
  const progressRef = React.useRef(0);

  const _bufferRef = React.useRef<HTMLDivElement | null>(null);
  const _progressRef = React.useRef<HTMLDivElement | null>(null);
  const _thumbRef = React.useRef<HTMLDivElement | null>(null);
  const currentTimeRef = React.useRef<HTMLSpanElement | null>(null);
  const _trackRef = React.useRef<HTMLDivElement | null>(null);

  const seekSliderId = React.useId();
  const currentTimeId = React.useId();
  const durationId = React.useId();

  const calculateTimelineDuration = React.useCallback(() => {
    const primaryDuration = primaryTrim.trimEnd - primaryTrim.trimStart;

    if (!secondaryTrim) return primaryDuration;

    const secondaryDuration = secondaryTrim.trimEnd - secondaryTrim.trimStart;
    const secondaryOffset = secondaryTrim.timelineOffset || 0;
    const secondaryEnd = secondaryOffset + secondaryDuration;

    return Math.max(primaryDuration, secondaryEnd);
  }, [primaryTrim, secondaryTrim]);

  const timelineDurationMs = calculateTimelineDuration();

  const rafId = videoId
    ? RAF_IDS.seekProgress(videoId)
    : RAF_IDS.seekProgress(generateVideoId(5));

  const context = React.useMemo<SeekContextValue>(
    () => ({
      primaryVideoRef,
      secondaryVideoRef,
      primaryTrim,
      secondaryTrim,
      isPlaying,
      onSeek,
      primaryBuffered,
      secondaryBuffered,
      timelineDurationMs,

      progressRef,
      _bufferRef,
      _progressRef,
      _thumbRef,
      currentTimeRef,
      _trackRef,
      seekSliderId,
      currentTimeId,
      durationId,
      rafId,
    }),
    [
      primaryVideoRef,
      secondaryVideoRef,
      primaryTrim,
      secondaryTrim,
      isPlaying,
      onSeek,
      primaryBuffered,
      secondaryBuffered,
      timelineDurationMs,

      seekSliderId,
      currentTimeId,
      durationId,
      rafId,
    ]
  );

  return (
    <SeekContext.Provider value={context}>{children}</SeekContext.Provider>
  );
}

interface SeekContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const SeekContent = React.forwardRef<HTMLDivElement, SeekContentProps>(
  ({ children, className, ...props }, forwardedRef) => {
    return (
      <div
        ref={forwardedRef}
        className={cn("w-full pointer-events-auto", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SeekContent.displayName = "SeekContent";

interface SeekTimeDisplayProps extends React.HTMLAttributes<HTMLDivElement> {}

const SeekTimeDisplay = React.forwardRef<HTMLDivElement, SeekTimeDisplayProps>(
  ({ children, className, ...props }, forwardedRef) => {
    const { timelineDurationMs, currentTimeRef, currentTimeId, durationId } =
      useSeekContext();

    return (
      <div
        ref={forwardedRef}
        className={cn(
          "flex items-center gap-1.5 text-sm w-fit font-sans pointer-events-auto text-white !glass rounded-3xl px-3 h-8",
          className
        )}
        role="timer"
        aria-live="off"
        {...props}
      >
        <span ref={currentTimeRef} id={currentTimeId} aria-label="Current time">
          {children}
        </span>
        <span className="opacity-70" aria-hidden="true">
          /
        </span>
        <span id={durationId} aria-label="Duration">
          {formatTime(timelineDurationMs)}
        </span>
      </div>
    );
  }
);
SeekTimeDisplay.displayName = "SeekTimeDisplay";

interface SeekTrackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const SeekTrack = React.forwardRef<HTMLDivElement, SeekTrackProps>(
  ({ children, className, ...props }, forwardedRef) => {
    const {
      _trackRef,
      seekSliderId,
      currentTimeId,
      durationId,
      timelineDurationMs,
      progressRef,
      onSeek,
      rafId,
    } = useSeekContext();
    const composedRefs = useComposedRefs(forwardedRef, _trackRef);

    const stableOnSeek = useStableHandler(onSeek);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const currentProgress = progressRef.current ?? 0;
        const currentTimeMs = currentProgress * timelineDurationMs;
        let newTimeMs = currentTimeMs;

        // Step sizes (2% and 5% of total duration)
        const smallStep = timelineDurationMs * 0.02;
        const largeStep = timelineDurationMs * 0.05;

        switch (e.key) {
          case "ArrowRight":
          case "ArrowUp":
            e.preventDefault();
            newTimeMs = Math.min(timelineDurationMs, currentTimeMs + smallStep);
            break;
          case "ArrowLeft":
          case "ArrowDown":
            e.preventDefault();
            newTimeMs = Math.max(0, currentTimeMs - smallStep);
            break;
          case "PageUp":
            e.preventDefault();
            newTimeMs = Math.min(timelineDurationMs, currentTimeMs + largeStep);
            break;
          case "PageDown":
            e.preventDefault();
            newTimeMs = Math.max(0, currentTimeMs - largeStep);
            break;
          case "Home":
            e.preventDefault();
            newTimeMs = 0;
            break;
          case "End":
            e.preventDefault();
            newTimeMs = timelineDurationMs;
            break;
          default:
            return;
        }

        stableOnSeek(newTimeMs);
        globalRAF.trigger(rafId);
      },
      [timelineDurationMs, rafId]
    );

    const ariaValueNow = Math.round(progressRef.current * 100);
    const ariaValueText = `${formatTime(
      progressRef.current * timelineDurationMs
    )} of ${formatTime(timelineDurationMs)}`;

    return (
      <HitArea
        buffer={10}
        variant="y"
        className={cn(
          "group/track relative cursor-pointer pointer-events-auto touch-none rounded-full bg-primary/40 h-[5px]",
          className
        )}
        ref={composedRefs}
        role="slider"
        id={seekSliderId}
        aria-label="Seek video"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ariaValueNow}
        aria-valuetext={ariaValueText}
        aria-describedby={`${currentTimeId} ${durationId}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...props.style,
        }}
        {...props}
      >
        <div>{children}</div>
      </HitArea>
    );
  }
);
SeekTrack.displayName = "SeekTrack";

const SeekBuffer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, forwardedRef) => {
  const { _bufferRef } = useSeekContext();
  const composedRefs = useComposedRefs(forwardedRef, _bufferRef);

  return (
    <div
      ref={composedRefs}
      className={cn(
        "absolute inset-0 bg-primary/30 rounded-full origin-left will-change-transform pointer-events-none",
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
});
SeekBuffer.displayName = "SeekBuffer";

const SeekProgress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, forwardedRef) => {
  const { _progressRef } = useSeekContext();
  const composedRefs = useComposedRefs(forwardedRef, _progressRef);

  return (
    <div
      ref={composedRefs}
      className={cn(
        "absolute inset-0 bg-primary rounded-full origin-left will-change-transform pointer-events-auto",
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
});
SeekProgress.displayName = "SeekProgress";

interface SeekThumbProps extends React.HTMLAttributes<HTMLDivElement> {}

const SeekThumb = React.forwardRef<HTMLDivElement, SeekThumbProps>(
  ({ className, ...props }, forwardedRef) => {
    const { _thumbRef } = useSeekContext();
    const composedRefs = useComposedRefs(forwardedRef, _thumbRef);

    return (
      <HitArea buffer={8} variant="all">
        <div
          ref={composedRefs}
          className={cn(
            "absolute top-1/2 left-0 size-3 rounded-full bg-primary shadow-lg pointer-events-auto will-change-transform",
            "before:absolute before:inset-0 before:rounded-full before:bg-current before:opacity-0",
            "group-hover/track:before:opacity-30 before:transition-opacity before:duration-200 before:ease-out",
            className
          )}
          role="presentation"
          aria-hidden="true"
          onClick={(e) => e.stopPropagation()}
          {...props}
        />
      </HitArea>
    );
  }
);
SeekThumb.displayName = "SeekThumb";

function SeekAnimator() {
  const {
    rafId,
    primaryVideoRef,
    secondaryVideoRef,
    primaryTrim,
    secondaryTrim,
    primaryBuffered,
    secondaryBuffered,
    isPlaying,

    timelineDurationMs,
    onSeek,
    progressRef,
    _bufferRef,
    _progressRef,
    _thumbRef,
    currentTimeRef,
    _trackRef,
  } = useSeekContext();

  const visualUpdateRef = React.useRef<number>(0);
  const stableOnSeek = useStableHandler(onSeek);

  const [isDragging, setIsDragging] = React.useState(false);
  const isDraggingRef = React.useRef(false);

  /**
   * Calculate current normalized timeline position from video times
   */
  const getCurrentNormalizedTime = React.useCallback(() => {
    const primaryVideo = primaryVideoRef.current;
    const secondaryVideo = secondaryVideoRef?.current;
    if (!primaryVideo) return 0;

    const primaryCurrentMs = secondsToMs(primaryVideo.currentTime);
    const primaryRelativeMs = Math.max(
      0,
      primaryCurrentMs - primaryTrim.trimStart
    );

    if (!secondaryTrim || !secondaryVideo) return primaryRelativeMs;

    const secondaryCurrentMs = secondsToMs(secondaryVideo.currentTime);
    const secondaryRelativeMs = Math.max(
      0,
      secondaryCurrentMs - secondaryTrim.trimStart
    );
    const secondaryOffset = secondaryTrim.timelineOffset || 0;

    const primaryTimelinePos = primaryRelativeMs;
    const secondaryTimelinePos = secondaryOffset + secondaryRelativeMs;

    // If primary is at its end but secondary is still playing, use secondary position
    const primaryEnd = primaryTrim.trimEnd - primaryTrim.trimStart;
    const secondaryDuration = secondaryTrim.trimEnd - secondaryTrim.trimStart;
    const secondaryTimelineEnd = secondaryOffset + secondaryDuration;

    if (primaryTimelinePos >= primaryEnd && secondaryTimelineEnd > primaryEnd) {
      // Primary finished, secondary still going - use secondary position
      return secondaryTimelinePos;
    }

    return Math.max(primaryTimelinePos, secondaryTimelinePos);
  }, [primaryTrim, secondaryTrim]);

  /**
   * Update buffer display
   */
  const updateBufferDisplay = React.useCallback(() => {
    if (!_bufferRef.current) return;

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
    _bufferRef.current.style.transform = `scaleX(${bufferProgress})`;
  }, [primaryTrim, secondaryTrim, primaryBuffered, secondaryBuffered]);

  /**
   * Update all visual elements (progress, thumb, time display)
   */
  const updateVisualElements = React.useCallback(
    (progress: number) => {
      const clamped = Math.max(0, Math.min(1, progress));
      progressRef.current = clamped;

      if (_progressRef.current) {
        _progressRef.current.style.transform = `scaleX(${clamped})`;
      }

      if (_thumbRef.current && _trackRef.current) {
        const track = _trackRef.current;
        const thumb = _thumbRef.current;
        const barWidth = track.offsetWidth;
        const thumbWidth = thumb.offsetWidth;
        const x = clamped * barWidth - thumbWidth / 2;
        _thumbRef.current.style.transform = `translate3d(${x}px, -50%, 0)`;
      }

      if (currentTimeRef.current) {
        const currentTimeMs = clamped * timelineDurationMs;
        currentTimeRef.current.textContent = formatTime(currentTimeMs);
      }

      if (_trackRef.current) {
        const track = _trackRef.current;
        const ariaValueNow = Math.round(clamped * 100);
        const currentTimeMs = clamped * timelineDurationMs;
        const ariaValueText = `${formatTime(currentTimeMs)} of ${formatTime(
          timelineDurationMs
        )}`;
        track.setAttribute("aria-valuenow", ariaValueNow.toString());
        track.setAttribute("aria-valuetext", ariaValueText);
      }

      updateBufferDisplay();
    },
    [updateBufferDisplay, timelineDurationMs]
  );

  /**
   * Schedule visual update on next frame (used during dragging)
   */
  const scheduleVisualUpdate = useStableHandler((progress: number) => {
    if (visualUpdateRef.current) {
      cancelAnimationFrame(visualUpdateRef.current);
    }

    visualUpdateRef.current = requestAnimationFrame(() => {
      updateVisualElements(progress);
    });
  });

  /**
   * Update progress from current video time
   * This is called by global RAF when playing
   */
  const updateProgress = useStableHandler(() => {
    const normalizedTimeMs = getCurrentNormalizedTime();

    let newProgress = 0;

    if (timelineDurationMs > 0 && Number.isFinite(normalizedTimeMs)) {
      newProgress = Math.min(1, normalizedTimeMs / timelineDurationMs);
    }

    updateVisualElements(newProgress);
  });

  /**
   * Global RAF handles updates during playback
   * Only updates when playing AND not dragging
   */
  useRAF(() => updateProgress(), isPlaying && !isDragging, rafId);

  // Trigger handler - always available for manual triggers
  useRAFTrigger(rafId, () => updateProgress());

  /**
   * Update once when playback on mount
   */
  useIsoLayoutEffect(() => {
    updateProgress();
  }, []);

  /**
   * Cleanup scheduled visual updates on unmount
   */
  React.useEffect(() => {
    return () => {
      if (visualUpdateRef.current) {
        cancelAnimationFrame(visualUpdateRef.current);
      }
    };
  }, []);

  /**
   * Convert pointer position to timeline time
   */
  const getTimeFromPosition = React.useCallback(
    (clientX: number): number => {
      const trackElement = _trackRef.current;
      if (!trackElement) return 0;

      const rect = trackElement.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      return ratio * timelineDurationMs;
    },
    [timelineDurationMs]
  );

  /**
   * Debounced seek to avoid excessive calls during drag
   */
  const debouncedSeek = React.useMemo(
    () => debounce((timeMs: number) => stableOnSeek(timeMs), 100),
    []
  );

  /**
   * Pointer event handlers for seeking interaction
   */
  React.useEffect(() => {
    const trackElement = _trackRef.current;
    if (!trackElement) return;

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);

      trackElement.setPointerCapture(e.pointerId);

      const normalizedTimeMs = getTimeFromPosition(e.clientX);
      debouncedSeek(normalizedTimeMs);

      const newProgress = normalizedTimeMs / timelineDurationMs;
      scheduleVisualUpdate(newProgress);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      e.stopPropagation();

      const normalizedTimeMs = getTimeFromPosition(e.clientX);
      debouncedSeek(normalizedTimeMs);

      const newProgress = normalizedTimeMs / timelineDurationMs;
      scheduleVisualUpdate(newProgress);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      trackElement.releasePointerCapture(e.pointerId);

      isDraggingRef.current = false;
      setIsDragging(false);
    };

    trackElement.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      trackElement.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    timelineDurationMs,
    getTimeFromPosition,
    debouncedSeek,
    scheduleVisualUpdate,
  ]);

  return null;
}

export const Seek = {
  Root: SeekRoot,
  Content: SeekContent,
  TimeDisplay: SeekTimeDisplay,
  Track: SeekTrack,
  Buffer: SeekBuffer,
  Progress: SeekProgress,
  Thumb: SeekThumb,
  Animator: SeekAnimator,
};
