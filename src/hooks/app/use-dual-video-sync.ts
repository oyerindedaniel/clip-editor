import { useCallback, useEffect, useRef, useState } from "react";
import { useClock } from "@/hooks/app/use-clock";
import type { TrimData } from "@/types/app";
import { msToSeconds, secondsToMs } from "@/utils/video";
import logger from "@/utils/logger";
import { useStableHandler } from "../use-stable-handler";
import { normalizeError } from "@/utils/error-utils";
import { useLatestValue } from "../use-latest-value";

type UseDualVideoSyncArgs = {
  clock: ReturnType<typeof useClock>;
  primaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  primaryTrim: TrimData;
  secondaryTrim: TrimData;
  onRender?: (timelineMs: number) => void;
  enabled?: boolean;
};

/**
 * Keeps two trimmed videos in sync along a unified timeline.
 */
export function useDualVideoSync(args: UseDualVideoSyncArgs) {
  const {
    clock,
    primaryVideoRef,
    secondaryVideoRef,
    primaryTrim,
    secondaryTrim,
    onRender,
    enabled = false,
  } = args;

  const RESUME_DEBOUNCE_MS = 50; // Debounce delay for resume operations to prevent race conditions
  const WAITING_DEBOUNCE_MS = 300; // Only treat as stalled after 300ms of waiting

  type StalledState = { primary: boolean; secondary: boolean };

  const clockRef = useLatestValue(clock);

  const primaryMetaRef = useRef<VideoFrameCallbackMetadata | null>(null);
  const secondaryMetaRef = useRef<VideoFrameCallbackMetadata | null>(null);
  const primaryHandleRef = useRef<number | null>(null);
  const secondaryHandleRef = useRef<number | null>(null);
  const stalledRef = useRef<StalledState>({ primary: false, secondary: false });
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waitingTimerRef = useRef<{
    primary: NodeJS.Timeout | null;
    secondary: NodeJS.Timeout | null;
  }>({
    primary: null,
    secondary: null,
  });
  const isPlayingRef = useRef(false);
  const isSeekingRef = useRef(false);
  const lastClockSeekRef = useRef<number>(0);

  const lastFrameRef = useRef<number | null>(null);
  const fpsEstimateRef = useRef<number | null>(null);

  const [isBuffering, setIsBuffering] = useState(false);
  const isBufferingRef = useRef<StalledState>({
    primary: false,
    secondary: false,
  });
  const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [hasError, setHasError] = useState(false);

  const [primaryBuffered, setPrimaryBuffered] = useState<TimeRanges | null>(
    null
  );
  const [secondaryBuffered, setSecondaryBuffered] = useState<TimeRanges | null>(
    null
  );

  const setBufferingState = useCallback((shouldBuffer: boolean) => {
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
    }

    if (shouldBuffer) {
      setIsBuffering(true);
    } else {
      bufferingTimeoutRef.current = setTimeout(() => {
        setIsBuffering(false);
      }, 300);
    }
  }, []);

  /** Convert media time to unified timeline position (for either video) */
  const timelineFromMediaTime = useCallback(
    (mediaSec: number, trim: TrimData) =>
      Math.round(secondsToMs(mediaSec)) - trim.trimStart + trim.timelineOffset,
    []
  );

  /** Expected media time for secondary given timeline position */
  const expectedSecondaryMediaSecForTimeline = useCallback(
    (timelineMs: number): number =>
      msToSeconds(
        timelineMs - secondaryTrim.timelineOffset + secondaryTrim.trimStart
      ),
    [secondaryTrim.timelineOffset, secondaryTrim.trimStart]
  );

  /** Check if secondary video should be active on timeline */
  const isSecondaryActiveAtTimeline = useCallback(
    (timelineMs: number): boolean => {
      const start = secondaryTrim.timelineOffset;
      const end = secondaryEndTimelineMs();
      return timelineMs >= start && timelineMs <= end;
    },
    [
      secondaryTrim.timelineOffset,
      secondaryTrim.trimEnd,
      secondaryTrim.trimStart,
    ]
  );

  const primaryEndTimelineMs = useCallback(
    () =>
      primaryTrim.timelineOffset +
      (primaryTrim.trimEnd - primaryTrim.trimStart),
    [primaryTrim]
  );
  const secondaryEndTimelineMs = useCallback(
    () =>
      secondaryTrim.timelineOffset +
      (secondaryTrim.trimEnd - secondaryTrim.trimStart),
    [secondaryTrim]
  );

  /** Unified max end (timeline continues until both finished) */
  const maxEndTimelineMs = useCallback(
    () => Math.max(primaryEndTimelineMs(), secondaryEndTimelineMs()),
    [primaryEndTimelineMs, secondaryEndTimelineMs]
  );

  /** PerformSeek */
  const performSeek = useCallback(
    (targetMs: number) => {
      const clampedMs = Math.max(0, targetMs);

      isSeekingRef.current = true;
      lastClockSeekRef.current = clampedMs;
      clock.controls.seek(clampedMs);

      if (enabled) {
        const primary = primaryVideoRef.current;
        const secondary = secondaryVideoRef.current;

        if (primary) {
          const primaryTargetSec = msToSeconds(
            clampedMs - primaryTrim.timelineOffset + primaryTrim.trimStart
          );
          primary.currentTime = Math.max(
            0,
            Math.min(primaryTargetSec, msToSeconds(primaryTrim.trimEnd))
          );
        }

        if (secondary) {
          const secondaryTargetSec = msToSeconds(
            clampedMs - secondaryTrim.timelineOffset + secondaryTrim.trimStart
          );
          secondary.currentTime = Math.max(
            0,
            Math.min(secondaryTargetSec, msToSeconds(secondaryTrim.trimEnd))
          );
        }
      }

      requestAnimationFrame(() => {
        isSeekingRef.current = false;
      });
    },
    [enabled, clock, primaryTrim, secondaryTrim]
  );

  /** Pause all playback */
  const pauseAll = useCallback(() => {
    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;

    isPlayingRef.current = false;
    if (clock.status === "playing") {
      clock.controls.pause();
    }

    try {
      if (primary && !primary.paused) {
        primary.pause();
      }
    } catch (err) {
      logger.warn("Primary pause failed:", err);
    }
    try {
      if (secondary && !secondary.paused) {
        secondary.pause();
      }
    } catch (err) {
      logger.warn("Secondary pause failed:", err);
    }
  }, [clock]);

  const stablePauseAll = useStableHandler(pauseAll);

  const cleanup = useCallback(() => {
    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;

    if (primaryHandleRef.current && primary) {
      primary.cancelVideoFrameCallback(primaryHandleRef.current);
      primaryHandleRef.current = null;
    }
    if (secondaryHandleRef.current && secondary) {
      secondary.cancelVideoFrameCallback(secondaryHandleRef.current);
      secondaryHandleRef.current = null;
    }

    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }

    if (waitingTimerRef.current.primary) {
      clearTimeout(waitingTimerRef.current.primary);
      waitingTimerRef.current.primary = null;
    }
    if (waitingTimerRef.current.secondary) {
      clearTimeout(waitingTimerRef.current.secondary);
      waitingTimerRef.current.secondary = null;
    }

    primaryMetaRef.current = null;
    secondaryMetaRef.current = null;
    stalledRef.current = { primary: false, secondary: false };
    isPlayingRef.current = false;
    isSeekingRef.current = false;
    lastFrameRef.current = null;
    fpsEstimateRef.current = null;

    logger.info("Dual sync cleaned up");
  }, []);

  /**
   * Render frame if both videos are properly aligned.
   */
  const renderIfAligned = useCallback(
    (
      primaryMeta: VideoFrameCallbackMetadata | null,
      secondaryMeta: VideoFrameCallbackMetadata | null,
      fromSecondary = false
    ) => {
      if (!enabled) return;

      const primary = primaryVideoRef.current;
      const secondary = secondaryVideoRef.current;
      if (!primary || !secondary) return;

      const primaryEnded =
        timelineFromMediaTime(primaryMeta?.mediaTime ?? 0, primaryTrim) >=
        primaryEndTimelineMs();

      const secondaryEnded =
        timelineFromMediaTime(secondaryMeta?.mediaTime ?? 0, secondaryTrim) >=
        secondaryEndTimelineMs();

      if (fromSecondary && !primaryEnded) return;
      if (!fromSecondary && primaryEnded && !secondaryEnded) return;

      const drivingMeta = primaryEnded ? secondaryMeta : primaryMeta;
      const drivingTrim = primaryEnded ? secondaryTrim : primaryTrim;
      if (!drivingMeta) return;

      // ---- FPS Estimation ----
      const now = drivingMeta.mediaTime;
      const last = lastFrameRef.current ?? now;
      const delta = now - last;
      lastFrameRef.current = now;

      const prevFps = fpsEstimateRef.current ?? 30;
      if (delta > 0 && delta < 1) {
        const instantaneous = 1 / delta;
        const clamped = Math.min(Math.max(instantaneous, 1), 120);
        fpsEstimateRef.current = prevFps * 0.9 + clamped * 0.1;
      }
      const fps = fpsEstimateRef.current ?? 30;

      const frameMs = 1000 / fps;

      // ---- Sync tuning constants ----
      const SYNC_TOLERANCE_MS = frameMs * 1.5; // ~1–2 frames drift allowed
      const CLOCK_CORRECTION_THRESHOLD_MS = frameMs * 4; // correct only if >4-frame drift
      const CLOCK_CORRECTION_LERP = 0.2; // 20% smooth clock correction

      const timelineMs = timelineFromMediaTime(
        drivingMeta.mediaTime,
        drivingTrim
      );
      const end = maxEndTimelineMs();

      // ---- If secondary not active in current segment ----
      const secondaryActive = isSecondaryActiveAtTimeline(timelineMs);
      if (!secondaryActive) {
        if (
          Math.abs(clock.time - timelineMs) > CLOCK_CORRECTION_THRESHOLD_MS &&
          !isSeekingRef.current
        ) {
          isSeekingRef.current = true;
          lastClockSeekRef.current = timelineMs;
          clock.controls.seek(timelineMs);
          requestAnimationFrame(() => {
            isSeekingRef.current = false;
          });
        }
        onRender?.(timelineMs);
        return;
      }

      if (!secondaryMeta) return;

      // ---- Sync validation ----
      const expectedSec = expectedSecondaryMediaSecForTimeline(timelineMs);
      const actualSec = secondaryMeta.mediaTime;
      const driftMs = Math.abs((actualSec - expectedSec) * 1000);

      if (driftMs <= SYNC_TOLERANCE_MS) {
        // In sync → render normally
        onRender?.(timelineMs);
      } else if (driftMs > CLOCK_CORRECTION_THRESHOLD_MS) {
        // Smooth correction toward expected timeline (no hard jumps)
        const corrected =
          clock.time + (timelineMs - clock.time) * CLOCK_CORRECTION_LERP;
        clock.controls.seek(corrected);
        onRender?.(timelineMs);
      }
    },
    [
      enabled,
      timelineFromMediaTime,
      isSecondaryActiveAtTimeline,
      expectedSecondaryMediaSecForTimeline,
      onRender,
      clock,
      primaryTrim,
      secondaryTrim,
      primaryEndTimelineMs,
      secondaryEndTimelineMs,
      maxEndTimelineMs,
      pauseAll,
    ]
  );

  /** Attempt to resume playback after both videos are ready */
  const attemptResume = useCallback(() => {
    if (!enabled) return;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);

    resumeTimerRef.current = setTimeout(() => {
      const primary = primaryVideoRef.current;
      const secondary = secondaryVideoRef.current;
      if (
        !primary ||
        !secondary ||
        stalledRef.current.primary ||
        stalledRef.current.secondary
      )
        return;

      const now = clock.time;
      const end = maxEndTimelineMs();
      if (now >= end) {
        clock.controls.seek(end);
        clock.controls.pause();
        return;
      }

      isPlayingRef.current = true;
      Promise.all([
        primary
          .play()
          .catch((err: unknown) =>
            logger.warn("Primary play failed:", normalizeError(err).message)
          ),
        secondary
          .play()
          .catch((err: unknown) =>
            logger.warn("Secondary play failed:", normalizeError(err).message)
          ),
      ]).then(() => {
        if (clock.status !== "playing") clock.controls.play();
      });
    }, RESUME_DEBOUNCE_MS);
  }, [enabled, clock, maxEndTimelineMs]);

  const stableAttemptResume = useStableHandler(attemptResume);

  useEffect(() => {
    if (!enabled) return;

    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;
    if (!primary || !secondary) return;

    const onWaitPrimary = () => {
      if (waitingTimerRef.current.primary) {
        clearTimeout(waitingTimerRef.current.primary);
      }

      waitingTimerRef.current.primary = setTimeout(() => {
        if (primary && !primary.paused && primary.readyState < 3) {
          stalledRef.current.primary = true;
          stablePauseAll();
          isBufferingRef.current.primary = true;
          setBufferingState(true);
        }
      }, WAITING_DEBOUNCE_MS);
    };

    const onWaitSecondary = () => {
      if (waitingTimerRef.current.secondary) {
        clearTimeout(waitingTimerRef.current.secondary);
      }

      waitingTimerRef.current.secondary = setTimeout(() => {
        if (secondary && !secondary.paused && secondary.readyState < 3) {
          stalledRef.current.secondary = true;
          stablePauseAll();
        }
      }, WAITING_DEBOUNCE_MS);
      setBufferingState(true);
    };

    const onPlayPrimary = () => {
      if (waitingTimerRef.current.primary) {
        clearTimeout(waitingTimerRef.current.primary);
        waitingTimerRef.current.primary = null;
      }
      stalledRef.current.primary = false;
      if (!stalledRef.current.secondary) stableAttemptResume();
    };

    const onPlaySecondary = () => {
      if (waitingTimerRef.current.secondary) {
        clearTimeout(waitingTimerRef.current.secondary);
        waitingTimerRef.current.secondary = null;
      }
      stalledRef.current.secondary = false;
      if (!stalledRef.current.primary) stableAttemptResume();
    };

    const onCanPlayPrimary = () => {
      if (waitingTimerRef.current.primary) {
        clearTimeout(waitingTimerRef.current.primary);
        waitingTimerRef.current.primary = null;
      }
      stalledRef.current.primary = false;
      if (!isBufferingRef.current.secondary) {
        setBufferingState(false);
      }
    };

    const onCanPlaySecondary = () => {
      if (waitingTimerRef.current.secondary) {
        clearTimeout(waitingTimerRef.current.secondary);
        waitingTimerRef.current.secondary = null;
      }
      stalledRef.current.secondary = false;
      isBufferingRef.current.secondary = false;
      if (!isBufferingRef.current.primary) {
        setBufferingState(false);
      }
    };

    const onError = () => {
      setHasError(true);
      setBufferingState(false);
    };

    const onCanPlayThroughPrimary = () => {
      isBufferingRef.current.primary = false;
      setBufferingState(false);
    };

    const onCanPlayThroughSecondary = () => {
      isBufferingRef.current.secondary = false;
      setBufferingState(false);
    };

    const onStalledPrimary = () => {
      isBufferingRef.current.primary = false;
      setBufferingState(true);
    };

    const onStalledSecondary = () => {
      isBufferingRef.current.secondary = false;
      setBufferingState(true);
    };

    const onProgressPrimary = () => {
      setPrimaryBuffered(primary.buffered);
    };

    const onProgressSecondary = () => {
      setSecondaryBuffered(secondary.buffered);
    };

    const handleTimeUpdate = () => {
      if (!isPlayingRef.current) return;

      const primaryTimelineMs = timelineFromMediaTime(
        primary.currentTime,
        primaryTrim
      );
      const secondaryTimelineMs = timelineFromMediaTime(
        secondary.currentTime,
        secondaryTrim
      );
      const end = maxEndTimelineMs();

      const primaryEndMs = primaryEndTimelineMs();
      const secondaryEndMs = secondaryEndTimelineMs();

      // console.log({
      //   primaryTimelineMs,
      //   secondaryEndTimelineMs,
      //   primaryEndMs,
      //   secondaryEndMs,
      //   repeat: clockRef.current.repeat,
      // });

      if (
        primaryTimelineMs >= primaryEndMs &&
        secondaryTimelineMs < secondaryEndMs
      ) {
        primary.pause();
      }
      if (
        secondaryTimelineMs >= secondaryEndMs &&
        primaryTimelineMs < primaryEndMs
      ) {
        secondary.pause();
      }

      const currentTimelineMs = Math.max(
        primaryTimelineMs,
        secondaryTimelineMs
      );
      if (currentTimelineMs >= end) {
        isPlayingRef.current = false;

        if (primaryHandleRef.current) {
          primary.cancelVideoFrameCallback(primaryHandleRef.current);
          primaryHandleRef.current = null;
        }
        if (secondaryHandleRef.current) {
          secondary.cancelVideoFrameCallback(secondaryHandleRef.current);
          secondaryHandleRef.current = null;
        }

        onRender?.(end);

        if (clockRef.current.repeat) {
          if (!isSeekingRef.current) {
            performSeek(0);
          }
        } else {
          if (!isSeekingRef.current) {
            performSeek(0);
          }

          clockRef.current.controls.setStatus("ended");
          pauseAll();
        }
      }
    };

    primary.addEventListener("waiting", onWaitPrimary);
    secondary.addEventListener("waiting", onWaitSecondary);
    primary.addEventListener("playing", onPlayPrimary);
    secondary.addEventListener("playing", onPlaySecondary);
    primary.addEventListener("canplay", onCanPlayPrimary);
    secondary.addEventListener("canplay", onCanPlaySecondary);
    primary.addEventListener("error", onError);
    secondary.addEventListener("error", onError);
    primary.addEventListener("canplaythrough", onCanPlayThroughPrimary);
    secondary.addEventListener("canplaythrough", onCanPlayThroughSecondary);
    primary.addEventListener("stalled", onStalledPrimary);
    secondary.addEventListener("stalled", onStalledSecondary);
    primary.addEventListener("progress", onProgressPrimary);
    secondary.addEventListener("progress", onProgressSecondary);
    primary.addEventListener("timeupdate", handleTimeUpdate);
    secondary.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      cleanup();

      primary.removeEventListener("waiting", onWaitPrimary);
      secondary.removeEventListener("waiting", onWaitSecondary);
      primary.removeEventListener("playing", onPlayPrimary);
      secondary.removeEventListener("playing", onPlaySecondary);
      primary.removeEventListener("canplay", onCanPlayPrimary);
      secondary.removeEventListener("canplay", onCanPlaySecondary);
      primary.removeEventListener("error", onError);
      secondary.removeEventListener("error", onError);
      primary.removeEventListener("canplaythrough", onCanPlayPrimary);
      secondary.removeEventListener("canplaythrough", onCanPlaySecondary);
      primary.removeEventListener("stalled", onStalledPrimary);
      secondary.removeEventListener("stalled", onStalledSecondary);
      primary.removeEventListener("timeupdate", handleTimeUpdate);
      secondary.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [enabled, stablePauseAll, stableAttemptResume, cleanup]);

  useEffect(() => {
    if (!enabled) return;

    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;
    if (!primary || !secondary) return;

    const timelineMs = clock.time;
    const end = maxEndTimelineMs();

    if (timelineMs >= end) {
      clock.controls.seek(end);
      pauseAll();
      return;
    }

    const primaryTargetSec = msToSeconds(
      timelineMs - primaryTrim.timelineOffset + primaryTrim.trimStart
    );
    const secondaryTargetSec = msToSeconds(
      timelineMs - secondaryTrim.timelineOffset + secondaryTrim.trimStart
    );

    const primaryClamped = Math.max(
      0,
      Math.min(primaryTargetSec, msToSeconds(primaryTrim.trimEnd))
    );
    const secondaryClamped = Math.max(
      0,
      Math.min(secondaryTargetSec, msToSeconds(secondaryTrim.trimEnd))
    );

    primary.currentTime = primaryClamped;
    secondary.currentTime = secondaryClamped;
  }, [enabled]);

  const play = useCallback(() => {
    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;
    if (!primary || !secondary) return;

    isPlayingRef.current = true;
    Promise.all([primary.play(), secondary.play()]).catch(() => {});

    const primaryFrameCallback = (
      _: number,
      meta: VideoFrameCallbackMetadata
    ) => {
      primaryMetaRef.current = meta;
      stalledRef.current.primary = false;
      renderIfAligned(meta, secondaryMetaRef.current);

      if (primaryHandleRef.current)
        primary.cancelVideoFrameCallback(primaryHandleRef.current);
      if (isPlayingRef.current && !primary.paused && !primary.ended) {
        primaryHandleRef.current =
          primary.requestVideoFrameCallback(primaryFrameCallback);
      } else {
        primaryHandleRef.current = null;
      }
    };

    const secondaryFrameCallback = (
      _: number,
      meta: VideoFrameCallbackMetadata
    ) => {
      secondaryMetaRef.current = meta;
      stalledRef.current.secondary = false;
      renderIfAligned(primaryMetaRef.current, meta, true);

      if (secondaryHandleRef.current)
        secondary.cancelVideoFrameCallback(secondaryHandleRef.current);
      if (isPlayingRef.current && !secondary.paused && !secondary.ended) {
        secondaryHandleRef.current = secondary.requestVideoFrameCallback(
          secondaryFrameCallback
        );
      } else {
        secondaryHandleRef.current = null;
      }
    };

    try {
      primaryHandleRef.current =
        primary.requestVideoFrameCallback(primaryFrameCallback);
    } catch {}
    try {
      secondaryHandleRef.current = secondary.requestVideoFrameCallback(
        secondaryFrameCallback
      );
    } catch {}
  }, [renderIfAligned]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    pauseAll();
  }, [pauseAll]);

  const controls = {
    play: () => {
      if (!enabled) {
        logger.warn("Dual sync not enabled");
        return;
      }
      clock.controls.play();
      play();
    },

    pause: () => {
      clock.controls.pause();
      pause();
    },

    seek: (targetMs: number) => {
      performSeek(targetMs);
    },

    togglePlay: () => {
      if (!enabled) {
        logger.warn("Dual sync not enabled");
        return;
      }

      if (isPlayingRef.current) {
        clock.controls.pause();
        pause();
      } else {
        clock.controls.play();
        play();
      }
    },

    toggleRepeat: () => {
      clock.controls.toggleRepeat();
    },

    setPlayback: (rate: number) => {
      if (rate <= 0) {
        logger.warn("Playback rate must be positive");
        return;
      }

      const primary = primaryVideoRef.current;
      const secondary = secondaryVideoRef.current;

      if (primary) primary.playbackRate = rate;
      if (secondary) secondary.playbackRate = rate;

      clock.controls.setSpeed(rate);
      logger.info(`Playback rate set to ${rate}x`);
    },
  };

  return {
    controls,
    enabled,
    isBuffering,
    primaryBuffered,
    secondaryBuffered,
    hasError,
  };
}
