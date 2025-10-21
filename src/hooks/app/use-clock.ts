import {
  useMemo,
  useRef,
  useLayoutEffect,
  useSyncExternalStore,
  useCallback,
} from "react";
import { type PlayingStatus } from "./use-video-controls-core";

type ControlAction =
  | "play"
  | "pause"
  | "reset"
  | "seek"
  | "setSpeed"
  | "stop"
  | "setRepeat"
  | "toggleRepeat"
  | "togglePlay";

export type ClockControl =
  | { action: Exclude<ControlAction, "seek" | "setSpeed" | "setRepeat"> }
  | { action: "seek"; time: number }
  | { action: "setSpeed"; speed: number }
  | { action: "setRepeat"; repeat: boolean };

type Subscriber = () => void;

class ClockStore {
  private duration: number;
  private status: PlayingStatus;
  private speed: number;
  private time: number;
  private rafId: number | null;
  private lastTimestamp: number | null;
  private repeat: boolean;
  private subscribers: Set<Subscriber>;
  private cachedSnapshot: {
    time: number;
    status: PlayingStatus;
    duration: number;
    repeat: boolean;
    speed: number;
  } | null;

  constructor(initialDuration: number) {
    this.duration = Math.max(0, initialDuration);
    this.status = "idle";
    this.speed = 1;
    this.time = 0;
    this.rafId = null;
    this.lastTimestamp = null;
    this.repeat = false;
    this.subscribers = new Set();
    this.cachedSnapshot = null;
  }

  getSnapshot(): {
    time: number;
    status: PlayingStatus;
    duration: number;
    repeat: boolean;
    speed: number;
  } {
    if (
      !this.cachedSnapshot ||
      this.cachedSnapshot.time !== this.time ||
      this.cachedSnapshot.status !== this.status ||
      this.cachedSnapshot.duration !== this.duration ||
      this.cachedSnapshot.repeat !== this.repeat ||
      this.cachedSnapshot.speed !== this.speed
    ) {
      this.cachedSnapshot = {
        time: this.time,
        status: this.status,
        duration: this.duration,
        repeat: this.repeat,
        speed: this.speed, // ADD THIS
      };
    }
    return this.cachedSnapshot;
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private notify(): void {
    for (const s of this.subscribers) {
      try {
        s();
      } catch {}
    }
  }

  private clamp(t: number): number {
    return Math.min(Math.max(t, 0), this.duration);
  }

  private tick = (now: number): void => {
    if (this.lastTimestamp == null) this.lastTimestamp = now;
    const deltaMs = now - this.lastTimestamp;
    this.lastTimestamp = now;

    if (this.status === "playing") {
      const deltaSec = (deltaMs / 1000) * this.speed;
      this.time = this.clamp(this.time + deltaSec);

      if (this.time >= this.duration) {
        if (this.repeat) {
          this.time = 0;
        } else {
          this.status = "ended";
          this.stopRaf();
        }
      }

      this.notify();
    }

    if (this.rafId != null) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private startRaf(): void {
    if (this.rafId == null) {
      this.lastTimestamp = null;
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private stopRaf(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.lastTimestamp = null;
    }
  }

  dispatch(action: ClockControl): void {
    switch (action.action) {
      case "play":
        if (this.status === "ended") this.time = 0;
        this.status = "playing";
        this.startRaf();
        this.notify();
        break;

      case "pause":
        if (this.status === "playing") {
          this.status = "paused";
          this.stopRaf();
          this.notify();
        }
        break;

      case "togglePlay":
        if (this.status === "playing") {
          this.dispatch({ action: "pause" });
        } else {
          this.dispatch({ action: "play" });
        }
        break;

      case "reset":
        this.stopRaf();
        this.time = 0;
        this.status = "idle";
        this.notify();
        break;

      case "seek":
        this.time = this.clamp(action.time);
        if (this.time >= this.duration) {
          this.status = this.repeat ? "playing" : "ended";
          if (!this.repeat) this.stopRaf();
        }
        this.notify();
        break;

      case "setSpeed":
        if (action.speed > 0) {
          this.speed = action.speed;
          this.notify();
        }
        break;

      case "stop":
        this.stopRaf();
        this.time = this.duration;
        this.status = "ended";
        this.notify();
        break;

      case "setRepeat":
        this.repeat = action.repeat;
        this.notify();
        break;

      case "toggleRepeat":
        this.repeat = !this.repeat;
        this.notify();
        break;
    }
  }

  setDuration(newDuration: number): void {
    this.duration = Math.max(0, newDuration);
    if (this.time > this.duration) {
      this.time = this.duration;
      this.status = "ended";
      this.stopRaf();
    }
    this.notify();
  }

  setStatus(newStatus: PlayingStatus): void {
    if (this.status === newStatus) return;

    this.status = newStatus;

    if (newStatus === "playing") {
      this.startRaf();
    } else {
      this.stopRaf();
    }

    this.notify();
  }
}

export function useClock(duration: number) {
  const storeRef = useRef(new ClockStore(duration));

  useLayoutEffect(() => {
    storeRef.current.setDuration(duration);
  }, [duration]);

  const subscribe = useCallback(
    (fn: () => void) => storeRef.current.subscribe(fn),
    []
  );
  const getSnapshot = useCallback(() => storeRef.current.getSnapshot(), []);
  const serverSnapshot = useCallback(
    () => ({
      time: 0,
      status: "idle" as PlayingStatus,
      duration,
      repeat: false,
      speed: 1,
    }),
    [duration]
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const { time, status, repeat, speed } = state;

  const play = useCallback(
    () => storeRef.current.dispatch({ action: "play" }),
    []
  );
  const pause = useCallback(
    () => storeRef.current.dispatch({ action: "pause" }),
    []
  );
  const togglePlay = useCallback(
    () => storeRef.current.dispatch({ action: "togglePlay" }),
    []
  );
  const reset = useCallback(
    () => storeRef.current.dispatch({ action: "reset" }),
    []
  );
  const stop = useCallback(
    () => storeRef.current.dispatch({ action: "stop" }),
    []
  );
  const seek = useCallback(
    (t: number) => storeRef.current.dispatch({ action: "seek", time: t }),
    []
  );
  const setSpeed = useCallback(
    (s: number) => storeRef.current.dispatch({ action: "setSpeed", speed: s }),
    []
  );
  const toggleRepeat = useCallback(
    () => storeRef.current.dispatch({ action: "toggleRepeat" }),
    []
  );

  const setRepeat = useCallback(
    (r: boolean) =>
      storeRef.current.dispatch({ action: "setRepeat", repeat: r }),
    []
  );

  const setStatus = useCallback(
    (status: PlayingStatus) => storeRef.current.setStatus(status),
    []
  );

  const controls = useMemo(
    () => ({
      play,
      pause,
      togglePlay,
      reset,
      stop,
      seek,
      setSpeed,
      toggleRepeat,
      setRepeat,
      setStatus,
    }),
    [
      play,
      pause,
      togglePlay,
      reset,
      stop,
      seek,
      setSpeed,
      toggleRepeat,
      setRepeat,
      setStatus,
    ]
  );

  return useMemo(
    () => ({ time, status, duration: state.duration, repeat, speed, controls }),
    [time, status, state.duration, repeat, speed, controls]
  );
}
