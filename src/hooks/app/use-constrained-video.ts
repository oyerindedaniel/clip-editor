import { useState, useEffect, useCallback, useRef } from "react";
import {
  useBuildVideoControls,
  type PlayingStatus,
} from "./use-video-controls-core";

export interface UseConstrainedVideoOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trimStartRef: React.RefObject<number>;
  trimEndRef: React.RefObject<number>;
  repeatRef?: React.RefObject<boolean>;
  playbackRateRef?: React.RefObject<number>;
  onStatusChange?: (status: PlayingStatus) => void;
}

export interface ConstrainedVideoControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
}

export function useConstrainedVideo(opts: UseConstrainedVideoOptions) {
  const {
    videoRef,
    trimStartRef,
    trimEndRef,
    repeatRef,
    playbackRateRef,
    onStatusChange,
  } = opts;

  const [status, setStatus] = useState<PlayingStatus>("idle");
  const lastStatus = useRef<PlayingStatus>("idle");

  const updateStatus = useCallback(
    (next: PlayingStatus) => {
      if (lastStatus.current !== next) {
        lastStatus.current = next;
        setStatus(next);
        onStatusChange?.(next);
      }
    },
    [onStatusChange]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
      if (current < trimEnd) {
        updateStatus("paused");
      }
    };

    const playbackRate = playbackRateRef?.current ?? 1;
    if (video.playbackRate !== playbackRate) {
      video.playbackRate = playbackRate;
    }

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    const isInitiallyPlaying = !video.paused;
    updateStatus(isInitiallyPlaying ? "playing" : "idle");

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [
    videoRef,
    trimStartRef,
    trimEndRef,
    repeatRef,
    playbackRateRef,
    updateStatus,
  ]);

  const controls = useBuildVideoControls({
    videoRef,
    trimStartRef,
    trimEndRef,
    repeatRef,
    playbackRateRef,
  });

  return { status, controls };
}
