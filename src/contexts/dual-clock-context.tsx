import React, { createContext, useContext, useMemo } from "react";
import { type StoreApi, useContextStore } from "react-shallow-store";
import { useClock } from "@/hooks/app/use-clock";

interface DualClockContextValue extends ReturnType<typeof useClock> {}

const DualClockContext = createContext<StoreApi<DualClockContextValue> | null>(
  null
);

export function DualClockProvider({
  children,
  duration,
}: {
  duration: number;
  children: React.ReactNode;
}) {
  const contextValue = useClock(duration);

  const clockVideoStore = useContextStore(contextValue);

  return (
    <DualClockContext.Provider value={clockVideoStore}>
      {children}
    </DualClockContext.Provider>
  );
}

export function useClockContext() {
  const ctx = useContext(DualClockContext);
  if (!ctx)
    throw new Error("useTimelineContext must be used inside TimelineProvider");
  return ctx;
}
