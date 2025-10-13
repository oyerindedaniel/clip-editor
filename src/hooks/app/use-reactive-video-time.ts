import { useRef, useSyncExternalStore, useCallback, useMemo } from "react";

export type PlayingStatus = "idle" | "playing" | "paused" | "ended";

interface UseReactiveVideoTimeOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trimStartRef: React.RefObject<number>;
  trimEndRef: React.RefObject<number>;
  repeatRef?: React.RefObject<boolean>;
  playing?: boolean;
  playbackRateRef?: React.RefObject<number>;
  onTimeChange?: (time: number) => void;
  onPlayingChange?: (status: PlayingStatus) => void;
}

interface ReactiveVideoState {
  time: number;
  status: PlayingStatus;
}

export interface ReactiveVideoControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
}

export function useReactiveVideoTime(opts: UseReactiveVideoTimeOptions) {
  const {
    videoRef,
    trimStartRef,
    trimEndRef,
    repeatRef,
    playing,
    playbackRateRef,
    onTimeChange,
    onPlayingChange,
  } = opts;

  const storeRef = useRef<{
    state: ReactiveVideoState;
    notify: () => void;
    rafId: number | null;
    startLoop: () => void;
  }>({
    state: { time: trimStartRef.current ?? 0, status: "idle" },
    notify: () => {},
    rafId: null,
    startLoop: () => {},
  });

  const subscribe = useCallback(
    (notify: () => void) => {
      storeRef.current.notify = notify;
      const video = videoRef.current;
      if (!video) return () => {};

      let isSubscribed = true;

      const updateState = (
        current: number,
        status: ReactiveVideoState["status"]
      ) => {
        const prev = storeRef.current.state;
        if (prev.time !== current || prev.status !== status) {
          storeRef.current.state = { time: current, status };
          storeRef.current.notify();
          onTimeChange?.(current);
          if (prev.status !== status) onPlayingChange?.(status);
        }
      };

      const loop = () => {
        if (!isSubscribed) return;

        const video = videoRef.current;
        if (!video) return;

        const trimStart = trimStartRef.current ?? 0;
        const trimEnd = trimEndRef.current ?? video.duration ?? 0;
        const repeat = repeatRef?.current ?? false;
        const playbackRate = playbackRateRef?.current ?? 1;

        if (video.playbackRate !== playbackRate) {
          video.playbackRate = playbackRate;
        }

        let current = video.currentTime;
        let status: ReactiveVideoState["status"];

        if (video.paused && current === 0) {
          status = "idle";
        } else if (video.ended) {
          status = "ended";
        } else {
          status = video.paused ? "paused" : "playing";
        }

        if (current < trimStart) {
          video.currentTime = trimStart;
          current = trimStart;
        } else if (current > trimEnd) {
          if (repeat) {
            video.currentTime = trimStart;
            current = trimStart;
          } else {
            video.pause();
            video.currentTime = trimStart;
            current = trimStart;
            status = "ended";
          }
        }

        updateState(current, status);

        if (playing && !video.paused) {
          storeRef.current.rafId = requestAnimationFrame(loop);
        } else {
          storeRef.current.rafId = null;
        }
      };

      const startLoop = () => {
        if (storeRef.current.rafId !== null) return;
        storeRef.current.rafId = requestAnimationFrame(loop);
      };

      storeRef.current.startLoop = startLoop;

      const initialCurrent = Math.max(
        video.currentTime,
        trimStartRef.current ?? 0
      );
      let initialStatus: ReactiveVideoState["status"];
      if (video.paused && initialCurrent === 0) {
        initialStatus = "idle";
      } else if (video.ended) {
        initialStatus = "ended";
      } else {
        initialStatus = video.paused ? "paused" : "playing";
      }
      updateState(initialCurrent, initialStatus);

      if (playing && !video.paused) {
        startLoop();
      }

      return () => {
        isSubscribed = false;
        if (storeRef.current.rafId !== null) {
          cancelAnimationFrame(storeRef.current.rafId);
          storeRef.current.rafId = null;
        }
      };
    },
    [playing, onTimeChange, onPlayingChange]
  );

  const getSnapshot = () => storeRef.current.state;
  const getServerSnapshot = () => ({
    time: trimStartRef.current ?? 0,
    status: "idle" as const,
  });

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const controls: ReactiveVideoControls = useMemo(() => {
    return {
      play: () => {
        const video = videoRef.current;
        if (!video) return;
        const trimStart = trimStartRef.current ?? 0;
        if (video.currentTime < trimStart) {
          video.currentTime = trimStart;
        }
        video.play().catch(() => {});
        storeRef.current.startLoop();
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
          const trimStart = trimStartRef.current ?? 0;
          if (video.currentTime < trimStart) {
            video.currentTime = trimStart;
          }
          video.play().catch(() => {});
          storeRef.current.startLoop();
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
        storeRef.current.state = { ...storeRef.current.state, time: clamped };
        storeRef.current.notify();
        onTimeChange?.(clamped);
        if (!video.paused) {
          storeRef.current.startLoop();
        }
      },
    };
  }, [onTimeChange]);

  return { ...state, controls };
}

export const getPlayingState = (status: PlayingStatus) => ({
  isPlaying: status === "playing",
  isPaused: status === "paused",
  isIdle: status === "idle",
  isEnded: status === "ended",
  isActive: status === "playing" || status === "paused",
  showPauseIcon: status === "playing",
  showPlayIcon: status !== "playing",
});
