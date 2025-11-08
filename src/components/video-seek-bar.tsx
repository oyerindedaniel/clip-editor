"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { debounce } from "@/utils/app";
import type { TrimData } from "@/types/app";
import { useStableHandler } from "@/hooks/use-stable-handler";
import { HitArea } from "./hit-area";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { formatTime } from "@/utils/app";
import { useLatestValue } from "@/hooks/use-latest-value";
import { useRAF } from "@/hooks/use-raf";
import { secondsToMs } from "@/utils/video";

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
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  hoverTime: number | null;
  setHoverTime: (v: number | null) => void;
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
}: SeekRootProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
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

  const context = React.useMemo(
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
      isDragging,
      setIsDragging,
      hoverTime,
      setHoverTime,
      progressRef,
      _bufferRef,
      _progressRef,
      _thumbRef,
      currentTimeRef,
      _trackRef,
      seekSliderId,
      currentTimeId,
      durationId,
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
      isDragging,
      hoverTime,
      seekSliderId,
      currentTimeId,
      durationId,
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
    } = useSeekContext();
    const composedRefs = useComposedRefs(forwardedRef, _trackRef);

    const stableOnSeek = useStableHandler(onSeek);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const currentProgress = progressRef.current;
        const currentTimeMs = currentProgress * timelineDurationMs;
        let newTimeMs = currentTimeMs;

        // Arrow keys: 5 second increments
        // Page Up/Down: 10 second increments
        // Home/End: Jump to start/end
        switch (e.key) {
          case "ArrowRight":
          case "ArrowUp":
            e.preventDefault();
            newTimeMs = Math.min(timelineDurationMs, currentTimeMs + 5000);
            break;
          case "ArrowLeft":
          case "ArrowDown":
            e.preventDefault();
            newTimeMs = Math.max(0, currentTimeMs - 5000);
            break;
          case "PageUp":
            e.preventDefault();
            newTimeMs = Math.min(timelineDurationMs, currentTimeMs + 10000);
            break;
          case "PageDown":
            e.preventDefault();
            newTimeMs = Math.max(0, currentTimeMs - 10000);
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
      },
      [timelineDurationMs]
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
          "relative cursor-pointer pointer-events-auto rounded-full bg-primary/40 h-[5px]",
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
            className
          )}
          role="presentation"
          aria-hidden="true"
          {...props}
        />
      </HitArea>
    );
  }
);
SeekThumb.displayName = "SeekThumb";

function SeekAnimator() {
  const {
    primaryVideoRef,
    secondaryVideoRef,
    primaryTrim,
    secondaryTrim,
    primaryBuffered,
    secondaryBuffered,
    isPlaying,
    isDragging,
    timelineDurationMs,
    onSeek,
    progressRef,
    _bufferRef,
    _progressRef,
    _thumbRef,
    currentTimeRef,
    _trackRef,
    setIsDragging,
    setHoverTime,
  } = useSeekContext();

  const isDraggingRef = useLatestValue(isDragging);
  const visualUpdateRef = React.useRef<number>(0);
  const stableOnSeek = useStableHandler(onSeek);

  /**
   * Calculate current normalized timeline position from video times
   */
  const getCurrentNormalizedTime = useStableHandler(() => {
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
  });

  /**
   * Update buffer display
   */
  const updateBufferDisplay = useStableHandler(() => {
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
  });

  /**
   * Update all visual elements (progress, thumb, time display)
   */
  const updateVisualElements = useStableHandler((progress: number) => {
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
  });

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
  useRAF(() => {
    if (!isDraggingRef.current) {
      updateProgress();
    }
  }, isPlaying);

  /**
   * Update once when playback stops (not handled by RAF when !isPlaying)
   */
  React.useEffect(() => {
    if (!isPlaying && !isDragging) {
      updateProgress();
    }
  }, [isPlaying, isDragging]);

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
    [timelineDurationMs, _trackRef]
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
      setIsDragging(true);

      trackElement.setPointerCapture(e.pointerId);

      const normalizedTimeMs = getTimeFromPosition(e.clientX);
      stableOnSeek(normalizedTimeMs);

      const newProgress = normalizedTimeMs / timelineDurationMs;
      scheduleVisualUpdate(newProgress);

      setHoverTime(normalizedTimeMs);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;

      const normalizedTimeMs = getTimeFromPosition(e.clientX);
      debouncedSeek(normalizedTimeMs);

      const newProgress = normalizedTimeMs / timelineDurationMs;
      scheduleVisualUpdate(newProgress);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      trackElement.releasePointerCapture(e.pointerId);
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
    isDragging,
    timelineDurationMs,
    getTimeFromPosition,
    debouncedSeek,
    scheduleVisualUpdate,
    setIsDragging,
    setHoverTime,
    _trackRef,
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
