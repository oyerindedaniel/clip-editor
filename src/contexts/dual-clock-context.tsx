import React, { createContext, useContext } from "react";
import { type StoreApi, useContextStore } from "react-shallow-store";

type VideoRef = React.RefObject<HTMLVideoElement | null>;

interface DualClockContextValue {
  primaryVideoRef: VideoRef;
  secondaryVideoRef: VideoRef;
  // clock: ReturnType<typeof useClock>;
}

export const DualClockContext =
  createContext<StoreApi<DualClockContextValue> | null>(null);

export function DualClockProvider({
  children,
  duration,
  primaryVideoRef,
  secondaryVideoRef,
}: {
  duration?: number;
  children: React.ReactNode;
  primaryVideoRef: VideoRef;
  secondaryVideoRef: VideoRef;
}) {
  // const clock = useClock(duration);

  const clockVideoStore = useContextStore({
    primaryVideoRef,
    secondaryVideoRef,
    // clock,
  });

  return (
    <DualClockContext.Provider value={clockVideoStore}>
      {children}
    </DualClockContext.Provider>
  );
}

export function useClockContext() {
  const ctx = useContext(DualClockContext);
  if (!ctx)
    throw new Error("useClockContext must be used inside DualClockProvider");
  return ctx;
}
