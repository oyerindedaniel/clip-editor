import { useRef, useSyncExternalStore, useCallback } from "react";
import {
  useBuildVideoControls,
  type PlayingStatus,
} from "./use-video-controls-core";

export interface UseReactiveVideoTimeOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trimStartRef: React.RefObject<number>;
  trimEndRef: React.RefObject<number>;
  repeatRef?: React.RefObject<boolean>;
  playing?: boolean;
  onTimeChange?: (time: number) => void;
  onPlayingChange?: (status: PlayingStatus) => void;
}

interface ReactiveVideoState {
  time: number;
  status: PlayingStatus;
  isBuffering: boolean;
  hasError: boolean;
  buffered: TimeRanges | null;
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
    onTimeChange,
    onPlayingChange,
  } = opts;

  const storeRef = useRef<{
    state: ReactiveVideoState;
    notify: () => void;
    rafId: number | null;
    startLoop: () => void;
    bufferingTimeout: ReturnType<typeof setTimeout> | null;
  }>({
    state: {
      time: trimStartRef.current ?? 0,
      status: "idle",
      isBuffering: false,
      hasError: false,
      buffered: null,
    },
    notify: () => {},
    rafId: null,
    startLoop: () => {},
    bufferingTimeout: null,
  });

  const subscribe = useCallback(
    (notify: () => void) => {
      storeRef.current.notify = notify;
      const video = videoRef.current;
      if (!video) return () => {};

      let isSubscribed = true;

      const updateState = (
        current: number,
        status: ReactiveVideoState["status"],
        partial?: Partial<Omit<ReactiveVideoState, "time" | "status">>
      ) => {
        const prev = storeRef.current.state;
        const next = {
          time: current,
          status,
          isBuffering: partial?.isBuffering ?? prev.isBuffering,
          hasError: partial?.hasError ?? prev.hasError,
          buffered: partial?.buffered ?? prev.buffered,
        };

        if (
          prev.time !== next.time ||
          prev.status !== next.status ||
          prev.isBuffering !== next.isBuffering ||
          prev.hasError !== next.hasError ||
          prev.buffered !== next.buffered
        ) {
          storeRef.current.state = next;
          storeRef.current.notify();
          onTimeChange?.(current);
          if (prev.status !== status) onPlayingChange?.(status);
        }
      };

      const setBufferingState = (shouldBuffer: boolean) => {
        if (storeRef.current.bufferingTimeout) {
          clearTimeout(storeRef.current.bufferingTimeout);
          storeRef.current.bufferingTimeout = null;
        }

        const isPlaying = video && !video.paused;

        if (shouldBuffer && isPlaying) {
          updateState(
            storeRef.current.state.time,
            storeRef.current.state.status,
            {
              isBuffering: true,
            }
          );
        } else if (!isPlaying) {
          updateState(
            storeRef.current.state.time,
            storeRef.current.state.status,
            {
              isBuffering: false,
            }
          );
        } else {
          storeRef.current.bufferingTimeout = setTimeout(() => {
            updateState(
              storeRef.current.state.time,
              storeRef.current.state.status,
              {
                isBuffering: false,
              }
            );
          }, 200);
        }
      };

      const loop = () => {
        if (!isSubscribed) return;

        const video = videoRef.current;
        if (!video) return;

        const trimStart = trimStartRef.current ?? 0;
        const trimEnd = trimEndRef.current ?? video.duration ?? 0;
        const repeat = repeatRef?.current ?? false;

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

      const handleProgress = () => {
        updateState(
          storeRef.current.state.time,
          storeRef.current.state.status,
          {
            buffered: video.buffered,
          }
        );
      };

      const handleWaiting = () => setBufferingState(true);
      const handleCanPlay = () => setBufferingState(false);
      const handleCanPlayThrough = () => setBufferingState(false);
      const handleStalled = () => setBufferingState(true);

      const handleError = () => {
        updateState(
          storeRef.current.state.time,
          storeRef.current.state.status,
          {
            hasError: true,
            isBuffering: false,
          }
        );
      };

      video.addEventListener("waiting", handleWaiting);
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("canplaythrough", handleCanPlayThrough);
      video.addEventListener("stalled", handleStalled);
      video.addEventListener("error", handleError);
      video.addEventListener("progress", handleProgress);

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
      updateState(initialCurrent, initialStatus, { buffered: video.buffered });

      if (playing && !video.paused) {
        startLoop();
      }

      return () => {
        isSubscribed = false;
        if (storeRef.current.rafId !== null) {
          cancelAnimationFrame(storeRef.current.rafId);
          storeRef.current.rafId = null;
        }
        if (storeRef.current.bufferingTimeout) {
          clearTimeout(storeRef.current.bufferingTimeout);
          storeRef.current.bufferingTimeout = null;
        }
        video.removeEventListener("waiting", handleWaiting);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("canplaythrough", handleCanPlayThrough);
        video.removeEventListener("stalled", handleStalled);
        video.removeEventListener("error", handleError);
        video.removeEventListener("progress", handleProgress);
      };
    },
    [playing, onTimeChange, onPlayingChange]
  );

  const getSnapshot = () => storeRef.current.state;
  const getServerSnapshot = () => ({
    time: trimStartRef.current ?? 0,
    status: "idle" as const,
    isBuffering: false,
    hasError: false,
    buffered: null,
  });

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const controls = useBuildVideoControls({
    videoRef,
    trimStartRef,
    trimEndRef,
    updateStoreTime: (time) => {
      storeRef.current.state = { ...storeRef.current.state, time };
    },
    notifyStore: () => {
      storeRef.current.notify();
    },
    startLoop: () => {
      storeRef.current.startLoop();
    },
    onSeek: onTimeChange,
  });

  return { ...state, controls };
}
