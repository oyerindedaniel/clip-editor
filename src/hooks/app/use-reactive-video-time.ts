import { useRef, useSyncExternalStore, useCallback, useState } from "react";
import { useRAF } from "@/hooks/use-raf";
import {
  useBuildVideoControls,
  type PlayingStatus,
} from "./use-video-controls-core";
import { useStableHandler } from "@/hooks/use-stable-handler";

export interface UseReactiveVideoTimeOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trimStartRef: React.RefObject<number>; // in secs
  trimEndRef: React.RefObject<number>; // in secs
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
  getVolume: () => number;
  setVolume: (volume: number) => void;
  getPlaybackRate: () => number;
  setPlaybackRate: (rate: number) => void;
}

export function useReactiveVideoTime(opts: UseReactiveVideoTimeOptions) {
  const {
    videoRef,
    trimStartRef,
    trimEndRef,
    repeatRef,
    playing: externalPlaying = false,
    onTimeChange,
    onPlayingChange,
  } = opts;

  const stableOnTimeChange = useStableHandler(onTimeChange!);
  const stableOnPlayingChange = useStableHandler(onPlayingChange!);

  // acts as our internal playing state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const isLoopingRef = useRef(false);

  const storeRef = useRef<{
    state: ReactiveVideoState;
    notify: () => void;
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
    bufferingTimeout: null,
  });

  const subscribe = useCallback((notify: () => void) => {
    storeRef.current.notify = notify;
    const video = videoRef.current;
    if (!video) return () => {};

    const updateState = (updates: Partial<ReactiveVideoState>) => {
      const prev = storeRef.current.state;
      const next = {
        time: updates.time ?? prev.time,
        status: updates.status ?? prev.status,
        isBuffering: updates.isBuffering ?? prev.isBuffering,
        hasError: updates.hasError ?? prev.hasError,
        buffered: updates.buffered ?? prev.buffered,
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

        if (updates.time !== undefined) {
          stableOnTimeChange?.(next.time);
        }
        if (updates.status !== undefined && prev.status !== next.status) {
          stableOnPlayingChange?.(next.status);
        }
      }
    };

    const setBufferingState = (shouldBuffer: boolean) => {
      if (storeRef.current.bufferingTimeout) {
        clearTimeout(storeRef.current.bufferingTimeout);
        storeRef.current.bufferingTimeout = null;
      }

      const isPlaying = video && !video.paused;

      if (shouldBuffer && isPlaying) {
        updateState({ isBuffering: true });
      } else if (!isPlaying) {
        updateState({ isBuffering: false });
      } else {
        storeRef.current.bufferingTimeout = setTimeout(() => {
          updateState({ isBuffering: false });
        }, 200);
      }
    };

    const handleProgress = () => updateState({ buffered: video.buffered });
    const handleWaiting = () => setBufferingState(true);
    const handleCanPlay = () => setBufferingState(false);
    const handleCanPlayThrough = () => setBufferingState(false);
    const handleStalled = () => setBufferingState(true);
    const handleError = () =>
      updateState({ hasError: true, isBuffering: false });

    const handlePlay = () => {
      isLoopingRef.current = false;
      setIsVideoPlaying(true);
    };

    const handlePause = () => {
      // Ignore pause events when we're intentionally looping
      if (isLoopingRef.current) {
        return;
      }

      setIsVideoPlaying(false);
    };

    const handleEnded = () => {
      setIsVideoPlaying(false);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
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

    video.currentTime = initialCurrent;

    let initialStatus: ReactiveVideoState["status"];
    if (video.paused && initialCurrent === 0) {
      initialStatus = "idle";
    } else if (video.ended) {
      initialStatus = "ended";
    } else {
      initialStatus = video.paused ? "paused" : "playing";
    }
    updateState({
      time: initialCurrent,
      status: initialStatus,
      buffered: video.buffered,
    });

    return () => {
      if (storeRef.current.bufferingTimeout) {
        clearTimeout(storeRef.current.bufferingTimeout);
        storeRef.current.bufferingTimeout = null;
      }

      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("canplaythrough", handleCanPlayThrough);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("error", handleError);
      video.removeEventListener("progress", handleProgress);
    };
  }, []);

  // Global RAF just polls video.currentTime for UI state
  // Canvas uses requestVideoFrameCallback for actual rendering
  const video = videoRef.current;
  const shouldPoll = externalPlaying && video && isVideoPlaying;

  useRAF(() => {
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
        isLoopingRef.current = true;
        video.currentTime = trimStart;
        current = trimStart;
        status = "playing";
      } else {
        isLoopingRef.current = false;
        video.pause();
        video.currentTime = trimStart;
        current = trimStart;
        status = "ended";
      }
    }

    const prev = storeRef.current.state;
    if (prev.time !== current || prev.status !== status) {
      storeRef.current.state = { ...prev, time: current, status };
      storeRef.current.notify();
      if (prev.time !== current) stableOnTimeChange?.(current);
      if (prev.status !== status) stableOnPlayingChange?.(status);
    }
  }, shouldPoll ?? false);

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
    notifyStore: () => storeRef.current.notify(),
    startLoop: () => {},
    onSeek: stableOnTimeChange,
  });

  return { ...state, controls };
}
