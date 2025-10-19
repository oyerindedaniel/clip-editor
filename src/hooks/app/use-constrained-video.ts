import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  useBuildVideoControls,
  type PlayingStatus,
} from "./use-video-controls-core";
import { useStableHandler } from "../use-stable-handler";

export interface UseConstrainedVideoOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trimStartRef: React.RefObject<number>;
  trimEndRef: React.RefObject<number>;
  repeatRef?: React.RefObject<boolean>;
  onStatusChange?: (status: PlayingStatus) => void;
}

export type VideoState = ReturnType<typeof useConstrainedVideo>;

export interface ConstrainedVideoControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
}

export function useConstrainedVideo(opts: UseConstrainedVideoOptions) {
  const { videoRef, trimStartRef, trimEndRef, repeatRef, onStatusChange } =
    opts;

  const [status, setStatus] = useState<PlayingStatus>("idle");
  const [buffered, setBuffered] = useState<TimeRanges | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [hasError, setHasError] = useState(false);
  const lastStatus = useRef<PlayingStatus>("idle");
  const isLoopingRef = useRef(false);

  const setBufferingState = useCallback((shouldBuffer: boolean) => {
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
    }

    const video = videoRef.current;
    const isPlaying = video && !video.paused;

    if (shouldBuffer && isPlaying) {
      setIsBuffering(true);
    } else if (!isPlaying) {
      setIsBuffering(false);
    } else {
      bufferingTimeoutRef.current = setTimeout(() => {
        setIsBuffering(false);
      }, 200);
    }
  }, []);

  const stableOnStatusChange = useStableHandler(onStatusChange!);

  const updateStatus = useCallback((next: PlayingStatus) => {
    if (lastStatus.current !== next) {
      lastStatus.current = next;
      setStatus(next);
      stableOnStatusChange?.(next);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleProgress = () => {
      setBuffered(video.buffered);
    };

    const handleTimeUpdate = () => {
      const trimStart = trimStartRef.current ?? 0;
      const trimEnd = trimEndRef.current ?? video.duration ?? 0;
      const repeat = repeatRef?.current ?? false;
      const current = video.currentTime;

      if (current < trimStart) {
        video.currentTime = trimStart;
        return;
      }

      if (current >= trimEnd) {
        if (repeat) {
          isLoopingRef.current = true;
          video.currentTime = trimStart;
          video.play().catch(() => {});
          updateStatus("playing");
        } else {
          isLoopingRef.current = false;
          video.pause();
          video.currentTime = trimStart;
          updateStatus("ended");
        }
      }
    };

    const handlePlay = () => {
      isLoopingRef.current = false;
      updateStatus("playing");
    };

    const handlePause = () => {
      // Ignore pause events when we're intentionally looping
      if (isLoopingRef.current) {
        return;
      }

      const current = video.currentTime;
      const trimEnd = trimEndRef.current ?? video.duration ?? 0;
      if (current < trimEnd && lastStatus.current !== "ended") {
        updateStatus("paused");
      }
    };

    const handleWaiting = () => {
      setBufferingState(true);
    };

    const handleCanPlay = () => {
      setBufferingState(false);
    };

    const handleCanPlayThrough = () => {
      setBufferingState(false);
    };

    const handleStalled = () => {
      setBufferingState(true);
    };
    const handleError = () => {
      setHasError(true);
      setBufferingState(false);
    };

    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("canplaythrough", handleCanPlayThrough);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("error", handleError);
    video.addEventListener("progress", handleProgress);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    handleProgress();
    const isInitiallyPlaying = !video.paused;
    updateStatus(isInitiallyPlaying ? "playing" : "idle");

    return () => {
      video.removeEventListener("progress", handleProgress);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);

      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
      }
    };
  }, [updateStatus]);

  const controls = useBuildVideoControls({
    videoRef,
    trimStartRef,
    trimEndRef,
  });

  return useMemo(
    () => ({ status, controls, buffered, isBuffering, hasError }),
    [status, controls, buffered, isBuffering, hasError]
  );
}
