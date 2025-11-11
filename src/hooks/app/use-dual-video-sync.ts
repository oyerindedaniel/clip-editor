import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrimData } from "@/types/app";
import { msToSeconds, secondsToMs } from "@/utils/video";
import logger from "@/utils/logger";
import { useStableHandler } from "../use-stable-handler";
import { normalizeError } from "@/utils/error-utils";
import { PlayingStatus } from "./use-video-controls-core";
import { useLatestValue } from "../use-latest-value";

import { globalRAF } from "@/lib/raf-manager";

type UseDualVideoSyncArgs = {
  primaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  primaryTrim: TrimData;
  secondaryTrim: TrimData;
  onTimeUpdate?: (timelineMs: number) => void;
  enabled?: boolean;
  defaultRepeat?: boolean;
  seekProgressRafId?: string;
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
    defaultRepeat = false,
    seekProgressRafId,
  } = args;

  const SEEK_COOLDOWN_MS = 200; // Cooldown period after seek before drift detection
  const BUFFERING_CLEAR_DEBOUNCE_MS = 300; // Keep buffering state longer to avoid flicker
  const RESUME_DEBOUNCE_MS = 300; // Minimum time between resume attempts

  type State = { primary: boolean; secondary: boolean };

  const primaryMetaRef = useRef<VideoFrameCallbackMetadata | null>(null);
  const secondaryMetaRef = useRef<VideoFrameCallbackMetadata | null>(null);
  const primaryHandleRef = useRef<number | null>(null);
  const secondaryHandleRef = useRef<number | null>(null);

  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPlayingRef = useRef(false);
  const isSeekingRef = useRef(false);
  const lastSeekTimeRef = useRef<number>(0);
  const repeatRef = useRef(defaultRepeat);
  const playbackRateRef = useRef(1);

  const lastFrameRef = useRef<number | null>(null);
  const fpsEstimateRef = useRef<number | null>(null);

  const [isBuffering, setIsBuffering] = useState(false);
  const isBufferingRef = useRef<State>({
    primary: false,
    secondary: false,
  });

  const waitingForRecoveryRef = useRef(false);
  const isResettingRef = useRef(false);

  const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [hasError, setHasError] = useState(false);
  const [status, setStatus] = useState<PlayingStatus>("idle");
  const currentTimelineMsRef = useRef(0);

  const [primaryBuffered, setPrimaryBuffered] = useState<TimeRanges | null>(
    null
  );
  const [secondaryBuffered, setSecondaryBuffered] = useState<TimeRanges | null>(
    null
  );

  const primaryTrimRef = useLatestValue(primaryTrim);
  const secondaryTrimRef = useLatestValue(secondaryTrim);

  const primaryReadyRef = useRef(false);
  const secondaryReadyRef = useRef(false);

  const setBufferingState = useCallback(
    (shouldBuffer: boolean, immediate = false) => {
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
      }

      if (shouldBuffer) {
        setIsBuffering(true);
      } else {
        if (immediate) {
          setIsBuffering(false);
        } else {
          bufferingTimeoutRef.current = setTimeout(() => {
            setIsBuffering(false);
          }, BUFFERING_CLEAR_DEBOUNCE_MS);
        }
      }
    },
    []
  );

  /** Convert media time to unified timeline position (for either video) */
  const timelineFromMediaTime = useStableHandler(
    (mediaSec: number, trim: TrimData) =>
      Math.round(secondsToMs(mediaSec)) - trim.trimStart + trim.timelineOffset
  );

  /** Expected media time for secondary given timeline position */
  const expectedSecondaryMediaSecForTimeline = useStableHandler(
    (timelineMs: number): number =>
      msToSeconds(
        timelineMs - secondaryTrim.timelineOffset + secondaryTrim.trimStart
      )
  );

  /** Check if primary video should be active at timeline position */
  const isPrimaryActiveAtTimeline = useStableHandler(
    (timelineMs: number): boolean => {
      const end = primaryEndTimelineMs();
      return timelineMs < end;
    }
  );

  /** Check if secondary video should be active on timeline */
  const isSecondaryActiveAtTimeline = useStableHandler(
    (timelineMs: number): boolean => {
      const start = secondaryTrim.timelineOffset;
      const end = secondaryEndTimelineMs();
      return timelineMs >= start && timelineMs <= end;
    }
  );

  const getActiveVideosAtTimeline = useStableHandler(
    (timelineMs: number): { primary: boolean; secondary: boolean } => {
      return {
        primary: isPrimaryActiveAtTimeline(timelineMs),
        secondary: isSecondaryActiveAtTimeline(timelineMs),
      };
    }
  );

  const primaryEndTimelineMs = useStableHandler(
    () =>
      primaryTrim.timelineOffset + (primaryTrim.trimEnd - primaryTrim.trimStart)
  );

  const secondaryEndTimelineMs = useStableHandler(
    () =>
      secondaryTrim.timelineOffset +
      (secondaryTrim.trimEnd - secondaryTrim.trimStart)
  );

  /** Unified max end (timeline continues until both finished) */
  const maxEndTimelineMs = useStableHandler(() =>
    Math.max(primaryEndTimelineMs(), secondaryEndTimelineMs())
  );

  /** Perform seek operation on both videos */
  const performSeek = useStableHandler((targetMs: number, isReset = false) => {
    const clampedMs = Math.max(0, Math.min(targetMs, maxEndTimelineMs()));

    logger.log("performSeek", clampedMs);

    const wasPlaying = isPlayingRef.current;

    isSeekingRef.current = true;
    lastSeekTimeRef.current = Date.now();

    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;

    if (isReset) {
      isResettingRef.current = true;
      currentTimelineMsRef.current = clampedMs;
      if (primaryHandleRef.current && primary) {
        primary.cancelVideoFrameCallback(primaryHandleRef.current);
        primaryHandleRef.current = null;
      }
      if (secondaryHandleRef.current && secondary) {
        secondary.cancelVideoFrameCallback(secondaryHandleRef.current);
        secondaryHandleRef.current = null;
      }
    }

    if (enabled) {
      const primary = primaryVideoRef.current;
      const secondary = secondaryVideoRef.current;

      if (primary) {
        const primaryTargetSec = msToSeconds(
          clampedMs - primaryTrim.timelineOffset + primaryTrim.trimStart
        );
        const clampedPrimarySec = Math.max(
          msToSeconds(primaryTrim.trimStart),
          Math.min(primaryTargetSec, msToSeconds(primaryTrim.trimEnd))
        );

        const withinTimeline = targetMs <= primaryEndTimelineMs();

        if (withinTimeline) {
          primary.currentTime = clampedPrimarySec;
        }
      }

      if (secondary) {
        const secondaryTargetSec = msToSeconds(
          clampedMs - secondaryTrim.timelineOffset + secondaryTrim.trimStart
        );
        const clampedSecondarySec = Math.max(
          msToSeconds(secondaryTrim.trimStart),
          Math.min(secondaryTargetSec, msToSeconds(secondaryTrim.trimEnd))
        );

        const withinTimeline = targetMs <= secondaryEndTimelineMs();

        if (withinTimeline) {
          secondary.currentTime = clampedSecondarySec;
        }
      }

      requestAnimationFrame(() => {
        if (!isReset) {
          currentTimelineMsRef.current = clampedMs;
        }
        isSeekingRef.current = false;

        // Clear reset flag after one frame
        if (isReset) {
          requestAnimationFrame(() => {
            isResettingRef.current = false;
          });
        }

        if (wasPlaying) {
          play();
        }
      });
    }
  });

  /** Pause all playback */
  const pauseAll = useStableHandler(() => {
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
  });

  /** Pause both videos without changing playing state - used during buffering */
  const pauseAllPartial = useStableHandler(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }

    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;

    try {
      if (primary && !primary.paused) {
        primary.pause();
      }
    } catch (err) {
      logger.warn("Primary pause for buffering failed:", err);
    }
    try {
      if (secondary && !secondary.paused) {
        secondary.pause();
      }
    } catch (err) {
      logger.warn("Secondary pause for buffering failed:", err);
    }
  });

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

    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }

    primaryMetaRef.current = null;
    secondaryMetaRef.current = null;
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
  const renderIfAligned = useStableHandler(
    (
      primaryMeta: VideoFrameCallbackMetadata | null,
      secondaryMeta: VideoFrameCallbackMetadata | null,
      fromSecondary = false
    ) => {
      if (!enabled) return;

      const primary = primaryVideoRef.current;
      const secondary = secondaryVideoRef.current;
      if (!primary || !secondary) return;

      if (isResettingRef.current) return;

      if (isSeekingRef.current) return;

      const currentMs = currentTimelineMsRef.current;
      const activeVideos = getActiveVideosAtTimeline(currentMs);

      // Buffer in ms to account for frame callback stopping slightly before video end
      const VIDEO_END_BUFFER_MS = 100;

      const primaryMetaEnded =
        timelineFromMediaTime(primaryMeta?.mediaTime ?? 0, primaryTrim) >=
        primaryEndTimelineMs() - VIDEO_END_BUFFER_MS;

      const primaryEnded = primaryMetaEnded || !activeVideos.primary;

      const secondaryMetaEnded =
        timelineFromMediaTime(secondaryMeta?.mediaTime ?? 0, secondaryTrim) >=
        secondaryEndTimelineMs() - VIDEO_END_BUFFER_MS;

      const secondaryEnded = secondaryMetaEnded || !activeVideos.secondary;

      // Pause primary when it finishes
      if (primaryEnded && !primary.paused) {
        primary.pause();
      }

      // Pause secondary when it finishes
      if (secondaryEnded && !secondary.paused) {
        secondary.pause();
      }

      // If primary callback fired but primary shouldn't be active
      if (!fromSecondary && !activeVideos.primary) return;

      // If secondary callback fired but secondary shouldn't be active
      if (fromSecondary && !activeVideos.secondary) return;

      // When secondary video's frame callback fires, only process if primary has already finished its segment.
      // This prevents secondary from driving the timeline while primary is still the active video.
      if (fromSecondary && !primaryEnded) return;

      // When primary video's frame callback fires and primary has finished, only continue if secondary is still playing.
      // This transfers timeline control to secondary video so it can finish its remaining segment.
      if (!fromSecondary && primaryEnded && !secondaryEnded) return;

      // Determine which video is driving the timeline
      const drivingMeta = primaryEnded ? secondaryMeta : primaryMeta;
      const drivingTrim = primaryEnded ? secondaryTrim : primaryTrim;

      if (!drivingMeta) return;

      // ---- FPS Estimation ----

      const MIN_FPS = 1;
      const MAX_FPS = 120;
      const DEFAULT_FPS = 30;
      const SMOOTHING_FACTOR = 0.1; // 10% of new value, 90% of previous

      // Track frame delta to estimate actual playback frame rate
      const now = drivingMeta.mediaTime;
      const last = lastFrameRef.current ?? now;
      const delta = now - last;
      lastFrameRef.current = now;

      const prevFps = fpsEstimateRef.current ?? DEFAULT_FPS;

      if (delta > 0 && delta < 1) {
        const instantaneous = 1 / delta;
        const clamped = Math.min(Math.max(instantaneous, MIN_FPS), MAX_FPS);
        // Exponential moving average for smooth FPS estimate
        fpsEstimateRef.current =
          prevFps * (1 - SMOOTHING_FACTOR) + clamped * SMOOTHING_FACTOR;
      }

      const fps = fpsEstimateRef.current ?? DEFAULT_FPS;
      const frameMs = 1000 / fps;

      // ---- Sync tuning constants ----
      const RESYNC_THRESHOLD_MS = frameMs * 4; // Force resync if >4-frame drift

      const timelineMs = timelineFromMediaTime(
        drivingMeta.mediaTime,
        drivingTrim
      );

      // Can occur due to stale requestframecallback after both video ends then seek
      if (timelineMs < 0) {
        logger.warn(
          `Negative timeline detected: ${timelineMs}ms, skipping frame`
        );
        return;
      }

      // console.log("----timeline", {
      //   timelineMs,
      //   primaryEnded,
      //   secondaryEnded,
      //   primaryMax: primaryEndTimelineMs(),
      //   secondaryMax: secondaryEndTimelineMs(),
      //   fromSecondary,
      // });

      currentTimelineMsRef.current = timelineMs;

      onTimeUpdate?.(timelineMs);

      const end = maxEndTimelineMs();

      if (timelineMs >= end || (primaryEnded && secondaryEnded)) {
        logger.log("timeupdate: both segments complete");

        if (repeatRef.current) {
          if (!isSeekingRef.current) {
            performSeek(0, true);
          }
        } else {
          if (primaryHandleRef.current) {
            primary.cancelVideoFrameCallback(primaryHandleRef.current);
            primaryHandleRef.current = null;
          }
          if (secondaryHandleRef.current) {
            secondary.cancelVideoFrameCallback(secondaryHandleRef.current);
            secondaryHandleRef.current = null;
          }

          waitingForRecoveryRef.current = false;
          pauseAll();
          if (!isSeekingRef.current) {
            performSeek(0, true);
          }
          setStatus("ended");
        }
      }

      if (primaryEnded) return;

      // ---- If secondary not active in current segment ----
      // Only primary is playing, no sync needed
      const secondaryActive = isSecondaryActiveAtTimeline(timelineMs);
      if (!secondaryActive) {
        return;
      }

      if (!secondaryMeta) return;

      const timeSinceSeek = Date.now() - lastSeekTimeRef.current;
      const inSeekCooldown = timeSinceSeek < SEEK_COOLDOWN_MS;

      const bothVideosActive = activeVideos.primary && activeVideos.secondary;

      // Guard conditions - skip drift check if:
      // 1. Currently seeking
      // 2. Within cooldown period after a seek
      // 3. Already in recovery mode
      // 4. Both videos aren't active (e.g., seeking to position where one video doesn't exist)
      // 5. Near segment boundaries (primaryEnded or secondaryEnded)
      const shouldSkipDriftCheck =
        isSeekingRef.current ||
        inSeekCooldown ||
        waitingForRecoveryRef.current ||
        !bothVideosActive ||
        primaryEnded ||
        secondaryEnded;

      if (shouldSkipDriftCheck) {
        return;
      }

      // Sync validation - only performed when both videos should be in sync
      const expectedSec = expectedSecondaryMediaSecForTimeline(timelineMs);
      const actualSec = secondaryMeta.mediaTime;
      const driftMs = Math.abs((actualSec - expectedSec) * 1000);

      if (driftMs > RESYNC_THRESHOLD_MS) {
        logger.warn(
          `Video drift detected: ${driftMs.toFixed(
            1
          )}ms at timeline ${timelineMs}ms, resyncing...`
        );
        logger.info(
          `Expected secondary: ${expectedSec.toFixed(
            3
          )}s, Actual: ${actualSec.toFixed(3)}s`
        );

        waitingForRecoveryRef.current = true;
        pauseAllPartial();
        performSeek(timelineMs);
      }
    }
  );

  /** Attempt to resume playback after both videos are ready */
  const attemptResume = useStableHandler(() => {
    if (!enabled) return;

    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;
    if (!primary || !secondary || waitingForRecoveryRef.current) return;

    const end = maxEndTimelineMs();
    if (currentTimelineMsRef.current >= end) {
      performSeek(end);
      setStatus("ended");
      return;
    }

    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }

    resumeTimeoutRef.current = setTimeout(() => {
      isBufferingRef.current.primary = false;
      isBufferingRef.current.secondary = false;
      setBufferingState(false, true);

      play();
      resumeTimeoutRef.current = null;
    }, RESUME_DEBOUNCE_MS);
  });

  useEffect(() => {
    if (!enabled) return;

    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;

    if (!primary || !secondary) return;

    const onPlayPrimary = () => {};

    const onPlaySecondary = () => {};

    const onError = () => {
      pauseAll();
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

    const onCanPlayPrimary = () => {
      isBufferingRef.current.primary = false;

      // Only attempt resume if:
      // 1. We're waiting for recovery
      // 2. Secondary is also ready
      // 3. Not at the end
      // 4. User intended to be playing
      if (
        waitingForRecoveryRef.current &&
        !isBufferingRef.current.secondary &&
        currentTimelineMsRef.current < maxEndTimelineMs() &&
        isPlayingRef.current
      ) {
        waitingForRecoveryRef.current = false;
        attemptResume();
        return;
      }

      if (!isBufferingRef.current.secondary) {
        setBufferingState(false);
      }
    };

    const onCanPlaySecondary = () => {
      isBufferingRef.current.secondary = false;

      if (
        waitingForRecoveryRef.current &&
        !isBufferingRef.current.primary &&
        currentTimelineMsRef.current < maxEndTimelineMs() &&
        isPlayingRef.current
      ) {
        waitingForRecoveryRef.current = false;
        attemptResume();
        return;
      }

      if (!isBufferingRef.current.primary) {
        setBufferingState(false);
      }
    };

    const onWaitPrimary = () => {
      const isPrimaryActive = isPrimaryActiveAtTimeline(
        currentTimelineMsRef.current
      );

      if (!isPrimaryActive) {
        isBufferingRef.current.primary = false;
        return;
      }

      isBufferingRef.current.primary = true;
      setBufferingState(true);
      pauseAllPartial();
      waitingForRecoveryRef.current = true;
    };

    const onWaitSecondary = () => {
      const isSecondaryActive = isSecondaryActiveAtTimeline(
        currentTimelineMsRef.current
      );

      if (!isSecondaryActive) {
        isBufferingRef.current.secondary = false;
        return;
      }

      isBufferingRef.current.secondary = true;
      setBufferingState(true);
      pauseAllPartial();
      waitingForRecoveryRef.current = true;
    };

    const onStalledPrimary = () => {
      const isPrimaryActive = isPrimaryActiveAtTimeline(
        currentTimelineMsRef.current
      );

      if (!isPrimaryActive) {
        isBufferingRef.current.primary = false;
        return;
      }

      isBufferingRef.current.primary = true;
      setBufferingState(true);
      pauseAllPartial();
      waitingForRecoveryRef.current = true;
    };

    const onStalledSecondary = () => {
      const isSecondaryActive = isSecondaryActiveAtTimeline(
        currentTimelineMsRef.current
      );

      if (!isSecondaryActive) {
        isBufferingRef.current.secondary = false;
        return;
      }

      isBufferingRef.current.secondary = true;
      setBufferingState(true);
      pauseAllPartial();
      waitingForRecoveryRef.current = true;
    };

    const onProgressPrimary = () => {
      setPrimaryBuffered(primary.buffered);
    };

    const onProgressSecondary = () => {
      setSecondaryBuffered(secondary.buffered);
    };

    const onReadyPrimary = () => {
      const timelineMs = currentTimelineMsRef.current;

      const target = msToSeconds(
        timelineMs -
          primaryTrimRef.current?.timelineOffset +
          primaryTrimRef.current?.trimStart
      );

      const clamped = Math.max(
        msToSeconds(primaryTrimRef.current?.trimStart ?? 0),
        Math.min(target, msToSeconds(primaryTrimRef.current?.trimEnd ?? 0))
      );

      primary.currentTime = clamped;
      primaryReadyRef.current = true;

      if (
        seekProgressRafId &&
        primaryReadyRef.current &&
        secondaryReadyRef.current
      ) {
        globalRAF.trigger(seekProgressRafId);
      }
    };

    const onReadySecondary = () => {
      const timelineMs = currentTimelineMsRef.current;

      const target = msToSeconds(
        timelineMs -
          secondaryTrimRef.current?.timelineOffset +
          secondaryTrimRef.current?.trimStart
      );

      const clamped = Math.max(
        msToSeconds(secondaryTrimRef.current?.trimStart ?? 0),
        Math.min(target, msToSeconds(secondaryTrimRef.current?.trimEnd ?? 0))
      );

      secondary.currentTime = clamped;
      secondaryReadyRef.current = true;

      if (
        seekProgressRafId &&
        primaryReadyRef.current &&
        secondaryReadyRef.current
      ) {
        globalRAF.trigger(seekProgressRafId);
      }
    };

    primaryReadyRef.current = false;
    secondaryReadyRef.current = false;

    if (primary.readyState >= 2) {
      onReadyPrimary();
    }

    if (secondary.readyState >= 2) {
      onReadySecondary();
    }

    primary.addEventListener("loadeddata", onReadyPrimary);
    secondary.addEventListener("loadeddata", onReadySecondary);
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

    return () => {
      cleanup();

      primaryReadyRef.current = false;
      secondaryReadyRef.current = false;
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
      primary.removeEventListener("loadeddata", onReadyPrimary);
      secondary.removeEventListener("loadeddata", onReadySecondary);
    };
  }, [enabled, cleanup]);

  const play = useCallback(() => {
    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;

    if (!primary || !secondary) {
      logger.warn("Cannot play: video elements not available");
      return;
    }

    console.log({
      primary: primary.currentTime,
      secondary: secondary.currentTime,
    });

    isBufferingRef.current.primary = false;
    isBufferingRef.current.secondary = false;

    const currentMs = currentTimelineMsRef.current;
    const activeVideos = getActiveVideosAtTimeline(currentMs);

    isPlayingRef.current = true;
    setStatus("playing");

    const playPromises: Promise<void>[] = [];

    if (activeVideos.primary) {
      const expectedPrimaryTime = msToSeconds(
        currentMs - primaryTrim.timelineOffset + primaryTrim.trimStart
      );
      const clampedPrimaryTime = Math.max(
        msToSeconds(primaryTrim.trimStart),
        Math.min(expectedPrimaryTime, msToSeconds(primaryTrim.trimEnd))
      );

      if (Math.abs(primary.currentTime - clampedPrimaryTime) > 0.1) {
        primary.currentTime = clampedPrimaryTime;
      }
    }

    if (activeVideos.secondary) {
      const expectedSecondaryTime = msToSeconds(
        currentMs - secondaryTrim.timelineOffset + secondaryTrim.trimStart
      );
      const clampedSecondaryTime = Math.max(
        msToSeconds(secondaryTrim.trimStart),
        Math.min(expectedSecondaryTime, msToSeconds(secondaryTrim.trimEnd))
      );

      if (Math.abs(secondary.currentTime - clampedSecondaryTime) > 0.1) {
        secondary.currentTime = clampedSecondaryTime;
      }
    }

    if (activeVideos.primary && primary.paused) {
      playPromises.push(
        primary.play().catch((err) => {
          logger.warn("Primary play failed:", normalizeError(err).message);
        })
      );
    }

    if (activeVideos.secondary && secondary.paused) {
      playPromises.push(
        secondary.play().catch((err) => {
          logger.warn("Secondary play failed:", normalizeError(err).message);
        })
      );
    }

    Promise.all(playPromises);

    const primaryFrameCallback = (
      _: number,
      meta: VideoFrameCallbackMetadata
    ) => {
      primaryMetaRef.current = meta;
      renderIfAligned(meta, secondaryMetaRef.current);

      if (primaryHandleRef.current)
        primary.cancelVideoFrameCallback(primaryHandleRef.current);

      primaryHandleRef.current =
        primary.requestVideoFrameCallback(primaryFrameCallback);
    };

    const secondaryFrameCallback = (
      _: number,
      meta: VideoFrameCallbackMetadata
    ) => {
      secondaryMetaRef.current = meta;
      renderIfAligned(primaryMetaRef.current, meta, true);

      if (secondaryHandleRef.current)
        secondary.cancelVideoFrameCallback(secondaryHandleRef.current);

      secondaryHandleRef.current = secondary.requestVideoFrameCallback(
        secondaryFrameCallback
      );
    };

    if (activeVideos.primary) {
      if (primaryHandleRef.current) {
        primary.cancelVideoFrameCallback(primaryHandleRef.current);
        primaryHandleRef.current = null;
      }
      try {
        primaryHandleRef.current =
          primary.requestVideoFrameCallback(primaryFrameCallback);
      } catch (err) {
        logger.warn(
          "Failed to start primary frame callback:",
          normalizeError(err).message
        );
      }
    }

    if (activeVideos.secondary) {
      if (secondaryHandleRef.current) {
        secondary.cancelVideoFrameCallback(secondaryHandleRef.current);
        secondaryHandleRef.current = null;
      }
      try {
        secondaryHandleRef.current = secondary.requestVideoFrameCallback(
          secondaryFrameCallback
        );
      } catch (err) {
        logger.warn(
          "Failed to start secondary frame callback:",
          normalizeError(err).message
        );
      }
    }
  }, []);

  const controls = {
    play: () => {
      waitingForRecoveryRef.current = false;
      play();
    },

    pause: () => {
      waitingForRecoveryRef.current = false;
      pauseAll();
    },

    seek: (targetMs: number) => {
      waitingForRecoveryRef.current = false;
      performSeek(targetMs);
    },

    togglePlay: () => {
      if (!enabled) {
        logger.warn("Dual sync not enabled");
        return;
      }

      if (isPlayingRef.current) {
        waitingForRecoveryRef.current = false;
        pauseAll();
      } else {
        waitingForRecoveryRef.current = false;
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

    setPrimaryVolume: (volume: number) => {
      const video = primaryVideoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(volume, 1));
      if (video.volume !== clamped) {
        video.volume = clamped;
      }
    },

    getPrimaryVolume: (defaultValue = 0.8) => {
      const video = primaryVideoRef.current;
      if (!video) return defaultValue;
      const clamped = Math.max(0, Math.min(video.volume, 1));
      if (video.volume !== clamped) {
        video.volume = clamped;
      }
      return clamped;
    },

    setSecondaryVolume: (volume: number) => {
      const video = secondaryVideoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(volume, 1));
      if (video.volume !== clamped) {
        video.volume = clamped;
      }
    },

    getSecondaryVolume: (defaultValue = 0.8) => {
      const video = secondaryVideoRef.current;
      if (!video) return defaultValue;
      const clamped = Math.max(0, Math.min(video.volume, 1));
      if (video.volume !== clamped) {
        video.volume = clamped;
      }
      return clamped;
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
    currentTimelineMs: currentTimelineMsRef.current,
    duration: maxEndTimelineMs(),
    repeat: repeatRef.current,
    playbackRate: playbackRateRef.current,
  };
}
