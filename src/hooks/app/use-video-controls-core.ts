import { useMemo } from "react";

export interface BuildVideoControlsOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trimStartRef: React.RefObject<number>;
  trimEndRef: React.RefObject<number>;
  repeatRef?: React.RefObject<boolean>;
  playbackRateRef?: React.RefObject<number>;
  // For reactive hooks that need to update store state
  updateStoreTime?: (time: number) => void;
  notifyStore?: () => void;
  startLoop?: () => void;
  // General callbacks
  onSeek?: (time: number) => void;
}

export interface VideoControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
}

export function useBuildVideoControls(
  opts: BuildVideoControlsOptions
): VideoControls {
  const {
    videoRef,
    trimStartRef,
    trimEndRef,
    repeatRef,
    playbackRateRef,
    updateStoreTime,
    notifyStore,
    startLoop,
    onSeek,
  } = opts;

  return useMemo<VideoControls>(() => {
    const ensureTrimStart = () => {
      const video = videoRef.current;
      if (!video) return;
      const trimStart = trimStartRef.current ?? 0;
      if (video.currentTime < trimStart) {
        video.currentTime = trimStart;
      }
    };

    return {
      play: () => {
        const video = videoRef.current;
        if (!video) return;
        ensureTrimStart();
        video.play().catch(() => {});
        startLoop?.();
      },

      pause: () => {
        const video = videoRef.current;
        if (!video) return;
        video.pause();
      },

      toggle: () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
          ensureTrimStart();
          video.play().catch(() => {});
          startLoop?.();
        } else {
          video.pause();
        }
      },

      seek: (time: number) => {
        const video = videoRef.current;
        if (!video) return;

        const trimStart = trimStartRef.current ?? 0;
        const trimEnd = trimEndRef.current ?? video.duration ?? 0;
        const clamped = Math.min(Math.max(time, trimStart), trimEnd);

        video.currentTime = clamped;

        if (updateStoreTime && notifyStore) {
          updateStoreTime(clamped);
          notifyStore();
        }

        onSeek?.(clamped);

        if (!video.paused) {
          startLoop?.();
        }
      },
    };
  }, [
    videoRef,
    trimStartRef,
    trimEndRef,
    repeatRef,
    playbackRateRef,
    updateStoreTime,
    notifyStore,
    startLoop,
    onSeek,
  ]);
}

export function getPlayingState(status: PlayingStatus) {
  return {
    isPlaying: status === "playing",
    isPaused: status === "paused",
    isIdle: status === "idle",
    isEnded: status === "ended",
    isActive: status === "playing" || status === "paused",
    showPauseIcon: status === "playing",
    showPlayIcon: status !== "playing",
  } as const;
}

export type PlayingStatus = "idle" | "playing" | "paused" | "ended";
