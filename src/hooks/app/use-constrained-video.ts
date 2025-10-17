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
  const lastStatus = useRef<PlayingStatus>("idle");

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
          video.currentTime = trimStart;
          video.play().catch(() => {});
          updateStatus("playing");
        } else {
          video.pause();
          video.currentTime = trimStart;
          updateStatus("ended");
        }
      }
    };

    const handlePlay = () => updateStatus("playing");
    const handlePause = () => {
      const current = video.currentTime;
      const trimEnd = trimEndRef.current ?? video.duration ?? 0;
      if (current < trimEnd) updateStatus("paused");
    };

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
    };
  }, [updateStatus]);

  const controls = useBuildVideoControls({
    videoRef,
    trimStartRef,
    trimEndRef,
    repeatRef,
  });

  return useMemo(
    () => ({ status, controls, buffered }),
    [status, controls, buffered]
  );
}
