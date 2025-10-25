import { useCallback, useEffect, useRef, useState } from "react";
import type { TrimData } from "@/types/app";
import { msToSeconds, secondsToMs } from "@/utils/video";
import logger from "@/utils/logger";
import { useStableHandler } from "../use-stable-handler";
import { normalizeError } from "@/utils/error-utils";
import { PlayingStatus } from "./use-video-controls-core";

type UseDualVideoSyncArgs = {
  primaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  primaryTrim: TrimData;
  secondaryTrim: TrimData;
  onTimeUpdate?: (timelineMs: number) => void;
  enabled?: boolean;
};

/**
 * Keeps two trimmed videos in sync along a unified timeline.
 * Uses requestVideoFrameCallback for frame-perfect synchronization.
 */
export function useDualVideoSync(args: UseDualVideoSyncArgs) {
  const {
    primaryVideoRef,
    secondaryVideoRef,
    primaryTrim,
    secondaryTrim,
    onTimeUpdate,
    enabled = false,
  } = args;

  const RESUME_DEBOUNCE_MS = 50; // Debounce delay for resume operations to prevent race conditions
  const WAITING_DEBOUNCE_MS = 300; // Only treat as stalled after 300ms of waiting

  type StalledState = { primary: boolean; secondary: boolean };

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
  const repeatRef = useRef(false);
  const playbackRateRef = useRef(1);

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
  const [status, setStatus] = useState<PlayingStatus>("idle");
  const [currentTimelineMs, setCurrentTimelineMs] = useState(0);

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

  /** Perform seek operation on both videos */
  const performSeek = useCallback(
    (targetMs: number) => {
      const clampedMs = Math.max(0, Math.min(targetMs, maxEndTimelineMs()));

      isSeekingRef.current = true;
      setCurrentTimelineMs(clampedMs);

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
    [enabled, primaryTrim, secondaryTrim, maxEndTimelineMs]
  );

  /** Pause all playback */
  const pauseAll = useCallback(() => {
    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;

    isPlayingRef.current = false;
    setStatus("paused");

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
  }, []);

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
   * This is called from requestVideoFrameCallback and handles the core synchronization logic.
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

      // When secondary video's frame callback fires, only process if primary has already finished its segment.
      // This prevents secondary from driving the timeline while primary is still the active video.
      if (fromSecondary && !primaryEnded) return;

      // When primary video's frame callback fires and primary has finished, only continue if secondary is still playing.
      // This transfers timeline control to secondary video so it can finish its remaining segment.
      if (!fromSecondary && primaryEnded && !secondaryEnded) return;

      // When both videos have completed their respective trimmed segments, no synchronization is needed.
      // Exit early to avoid false drift detection between videos that are legitimately at different timeline positions.
      if (primaryEnded && secondaryEnded) return;

      // Determine which video is driving the timeline
      const drivingMeta = primaryEnded ? secondaryMeta : primaryMeta;
      const drivingTrim = primaryEnded ? secondaryTrim : primaryTrim;
      if (!drivingMeta) return;

      // ---- FPS Estimation ----
      // Track frame delta to estimate actual playback frame rate
      const now = drivingMeta.mediaTime;
      const last = lastFrameRef.current ?? now;
      const delta = now - last;
      lastFrameRef.current = now;

      const prevFps = fpsEstimateRef.current ?? 30;
      if (delta > 0 && delta < 1) {
        const instantaneous = 1 / delta;
        const clamped = Math.min(Math.max(instantaneous, 1), 120);
        // Exponential moving average for smooth FPS estimate
        fpsEstimateRef.current = prevFps * 0.9 + clamped * 0.1;
      }
      const fps = fpsEstimateRef.current ?? 30;

      const frameMs = 1000 / fps;

      // ---- Sync tuning constants ----
      const RESYNC_THRESHOLD_MS = frameMs * 4; // Force resync if >4-frame drift

      const timelineMs = timelineFromMediaTime(
        drivingMeta.mediaTime,
        drivingTrim
      );

      setCurrentTimelineMs(timelineMs);
      onTimeUpdate?.(timelineMs);

      // ---- If secondary not active in current segment ----
      // Only primary is playing, no sync needed
      const secondaryActive = isSecondaryActiveAtTimeline(timelineMs);
      if (!secondaryActive) {
        return;
      }

      if (!secondaryMeta) return;

      // ---- Sync validation ----
      // Check if secondary video is where it should be relative to primary
      const expectedSec = expectedSecondaryMediaSecForTimeline(timelineMs);
      const actualSec = secondaryMeta.mediaTime;
      const driftMs = Math.abs((actualSec - expectedSec) * 1000);

      if (driftMs > RESYNC_THRESHOLD_MS) {
        logger.warn(
          `Video drift detected: ${driftMs.toFixed(1)}ms, resyncing...`
        );
        stablePauseAll();
        performSeek(timelineMs);
      }
    },
    [
      enabled,
      timelineFromMediaTime,
      isSecondaryActiveAtTimeline,
      expectedSecondaryMediaSecForTimeline,
      onTimeUpdate,
      primaryTrim,
      secondaryTrim,
      primaryEndTimelineMs,
      secondaryEndTimelineMs,
      performSeek,
      stablePauseAll,
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

      const end = maxEndTimelineMs();
      if (currentTimelineMs >= end) {
        performSeek(end);
        setStatus("ended");
        return;
      }

      isPlayingRef.current = true;
      setStatus("playing");

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
      ]);
    }, RESUME_DEBOUNCE_MS);
  }, [enabled, currentTimelineMs, maxEndTimelineMs, performSeek]);

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
          isBufferingRef.current.secondary = true;
          setBufferingState(true);
        }
      }, WAITING_DEBOUNCE_MS);
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
      isBufferingRef.current.primary = false;
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
      if (!isBufferingRef.current.secondary) {
        setBufferingState(false);
      }
    };

    const onCanPlayThroughSecondary = () => {
      isBufferingRef.current.secondary = false;
      if (!isBufferingRef.current.primary) {
        setBufferingState(false);
      }
    };

    const onStalledPrimary = () => {
      isBufferingRef.current.primary = true;
      setBufferingState(true);
    };

    const onStalledSecondary = () => {
      isBufferingRef.current.secondary = true;
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

      // Pause individual videos when they reach their segment end
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

      // Check if both videos have finished
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

        setCurrentTimelineMs(end);
        onTimeUpdate?.(end);

        // Handle repeat or end
        if (repeatRef.current) {
          if (!isSeekingRef.current) {
            performSeek(0);
            // Auto-restart playback
            setTimeout(() => {
              controls.play();
            }, 50);
          }
        } else {
          if (!isSeekingRef.current) {
            performSeek(0);
          }
          setStatus("ended");
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
      primary.removeEventListener("canplaythrough", onCanPlayThroughPrimary);
      secondary.removeEventListener(
        "canplaythrough",
        onCanPlayThroughSecondary
      );
      primary.removeEventListener("stalled", onStalledPrimary);
      secondary.removeEventListener("stalled", onStalledSecondary);
      primary.removeEventListener("progress", onProgressPrimary);
      secondary.removeEventListener("progress", onProgressSecondary);
      primary.removeEventListener("timeupdate", handleTimeUpdate);
      secondary.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [
    enabled,
    stablePauseAll,
    stableAttemptResume,
    cleanup,
    performSeek,
    pauseAll,
    onTimeUpdate,
    primaryTrim,
    secondaryTrim,
    maxEndTimelineMs,
    primaryEndTimelineMs,
    secondaryEndTimelineMs,
    timelineFromMediaTime,
  ]);

  // Initialize video positions when enabled
  useEffect(() => {
    if (!enabled) return;

    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;
    if (!primary || !secondary) return;

    const timelineMs = currentTimelineMs;
    const end = maxEndTimelineMs();

    if (timelineMs >= end) {
      performSeek(end);
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
    setStatus("playing");

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
      play();
    },

    pause: () => {
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
        pause();
      } else {
        play();
      }
    },

    toggleRepeat: () => {
      repeatRef.current = !repeatRef.current;
      logger.info(`Repeat ${repeatRef.current ? "enabled" : "disabled"}`);
    },

    setRepeat: (repeat: boolean) => {
      repeatRef.current = repeat;
      logger.info(`Repeat ${repeat ? "enabled" : "disabled"}`);
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

      playbackRateRef.current = rate;
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
    status,
    currentTimelineMs,
    duration: maxEndTimelineMs(),
    repeat: repeatRef.current,
    playbackRate: playbackRateRef.current,
  };
}
