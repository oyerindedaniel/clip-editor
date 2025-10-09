import { useEffect, useRef, useCallback } from "react";
import { useControllableState } from "../use-controllable-state";

export interface UsePlaybackClockOptions {
  externalTime?: number | null;
  defaultTime?: number;
  externalPlaying?: boolean | null;
  defaultPlaying?: boolean;
  playbackRate?: number;
  duration?: number | null;
  loop?: boolean;
  onTimeChange?: (t: number) => void;
  onPlayingChange?: (p: boolean) => void;
}

export function usePlaybackClock(opts: UsePlaybackClockOptions) {
  const {
    externalTime = null,
    defaultTime = 0,
    externalPlaying = null,
    defaultPlaying = false,
    playbackRate = 1,
    duration = null,
    loop = false,
    onTimeChange,
    onPlayingChange,
  } = opts;

  const [time, setTime] = useControllableState({
    controlled: externalTime ?? undefined,
    defaultValue: defaultTime,
    onChange: onTimeChange,
  });

  const [playing, setPlaying] = useControllableState({
    controlled: externalPlaying ?? undefined,
    defaultValue: defaultPlaying,
    onChange: onPlayingChange,
  });

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    const isTimeControlled =
      externalTime !== null && externalTime !== undefined;

    if (!playing || isTimeControlled) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastRef.current = null;
      }
      return;
    }

    const tick = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const deltaMs = now - lastRef.current;
      lastRef.current = now;
      const deltaSec = (deltaMs / 1000) * playbackRate;

      setTime((prev) => {
        let next = prev + deltaSec;
        if (duration != null && duration > 0) {
          if (loop) {
            next = next % duration;
            if (next < 0) next += duration;
          } else {
            next = Math.min(next, duration);
          }
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastRef.current = null;
    };
  }, [playing, playbackRate, setTime, externalTime, duration, loop]);

  const play = useCallback(() => setPlaying(true), [setPlaying]);
  const pause = useCallback(() => setPlaying(false), [setPlaying]);
  const toggle = useCallback(
    () => setPlaying((p: boolean) => !p),
    [setPlaying]
  );

  return {
    time,
    setTime,
    playing,
    setPlaying,
    play,
    pause,
    toggle,
  };
}
