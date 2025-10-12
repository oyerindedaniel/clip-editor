"use client";

import { createContext, useMemo, useState, ReactNode } from "react";
import type { AspectRatio } from "@/utils/aspect-ratios";
import { type StoreApi, useContextStore } from "react-shallow-store";
import { useLatestValue } from "@/hooks/use-latest-value";
import type { Transform } from "@/utils/keyframe";

type KeyframeContextValue = {
  boundaryAspectRatio: AspectRatio | null;
  setBoundaryAspectRatio: React.Dispatch<
    React.SetStateAction<AspectRatio | null>
  >;

  boundaryVisible: boolean;
  setBoundaryVisible: React.Dispatch<React.SetStateAction<boolean>>;

  boundaryTransform: Transform | null;
  setBoundaryTransform: React.Dispatch<React.SetStateAction<Transform | null>>;

  boundaryTransformRef: React.RefObject<Transform | null>;
};

export const KeyframeContext =
  createContext<StoreApi<KeyframeContextValue> | null>(null);

export function KeyframeProvider({ children }: { children: ReactNode }) {
  const [boundaryAspectRatio, setBoundaryAspectRatio] =
    useState<AspectRatio | null>(null);
  const [boundaryVisible, setBoundaryVisible] = useState(false);
  const [boundaryTransform, setBoundaryTransform] = useState<Transform | null>(
    null
  );

  const boundaryTransformRef = useLatestValue(boundaryTransform);

  const value = useMemo(
    () => ({
      boundaryAspectRatio,
      setBoundaryAspectRatio,
      boundaryVisible,
      setBoundaryVisible,
      boundaryTransform,
      setBoundaryTransform,
      boundaryTransformRef,
    }),
    [
      boundaryAspectRatio,
      setBoundaryAspectRatio,
      boundaryVisible,
      setBoundaryVisible,
      boundaryTransform,
      setBoundaryTransform,
      boundaryTransformRef,
    ]
  );

  const store = useContextStore(value);

  return (
    <KeyframeContext.Provider value={store}>
      {children}
    </KeyframeContext.Provider>
  );
}
