"use client";

import {
  createContext,
  useMemo,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { AspectRatio } from "@/utils/aspect-ratios";
import { type StoreApi, useContextStore } from "react-shallow-store";
import { useLatestValue } from "@/hooks/use-latest-value";
import type { Transform, KeyframeData } from "@/utils/keyframe";

type BoundaryAspectOverrideTuple = [AspectRatio | null, AspectRatio | null];

type KeyframeContextValue = {
  boundaryAspectRatio: AspectRatio | null;
  setBoundaryAspectRatio: React.Dispatch<
    React.SetStateAction<AspectRatio | null>
  >;
  boundaryAspectOverride: BoundaryAspectOverrideTuple;
  setBoundaryAspectOverride: React.Dispatch<
    React.SetStateAction<BoundaryAspectOverrideTuple>
  >;

  primaryBoundaryAspectOverride: AspectRatio | null;
  secondaryBoundaryAspectOverride: AspectRatio | null;

  setPrimaryBoundaryAspectOverride: (
    value: React.SetStateAction<AspectRatio | null>
  ) => void;
  setSecondaryBoundaryAspectOverride: (
    value: React.SetStateAction<AspectRatio | null>
  ) => void;

  boundaryVisible: boolean;
  setBoundaryVisible: React.Dispatch<React.SetStateAction<boolean>>;

  boundaryTransform: Transform | null;
  setBoundaryTransform: React.Dispatch<React.SetStateAction<Transform | null>>;

  keyframes: KeyframeData[];
  setKeyframes: React.Dispatch<React.SetStateAction<KeyframeData[]>>;
  currentKeyframeId: string | null;
  setCurrentKeyframeId: React.Dispatch<React.SetStateAction<string | null>>;
};

export const KeyframeContext =
  createContext<StoreApi<KeyframeContextValue> | null>(null);

export function KeyframeProvider({ children }: { children: ReactNode }) {
  const [boundaryAspectRatio, setBoundaryAspectRatio] =
    useState<AspectRatio | null>(null);
  const [boundaryAspectOverride, setBoundaryAspectOverride] = useState<
    [AspectRatio | null, AspectRatio | null]
  >([null, null]);
  const [boundaryVisible, setBoundaryVisible] = useState(false);
  const [boundaryTransform, setBoundaryTransform] = useState<Transform | null>(
    null
  );

  const [keyframes, setKeyframes] = useState<KeyframeData[]>([]);
  const [currentKeyframeId, setCurrentKeyframeId] = useState<string | null>(
    null
  );

  const primaryBoundaryAspectOverride = boundaryAspectOverride[0];
  const secondaryBoundaryAspectOverride = boundaryAspectOverride[1];

  const setPrimaryBoundaryAspectOverride = useCallback(
    (value: React.SetStateAction<AspectRatio | null>) => {
      setBoundaryAspectOverride((prev) => {
        const newValue = typeof value === "function" ? value(prev[0]) : value;
        return [newValue, prev[1]];
      });
    },
    []
  );

  const setSecondaryBoundaryAspectOverride = useCallback(
    (value: React.SetStateAction<AspectRatio | null>) => {
      setBoundaryAspectOverride((prev) => {
        const newValue = typeof value === "function" ? value(prev[1]) : value;
        return [prev[0], newValue];
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      boundaryAspectRatio,
      setBoundaryAspectRatio,
      boundaryAspectOverride,
      setBoundaryAspectOverride,
      primaryBoundaryAspectOverride,
      secondaryBoundaryAspectOverride,
      setPrimaryBoundaryAspectOverride,
      setSecondaryBoundaryAspectOverride,
      boundaryVisible,
      setBoundaryVisible,
      boundaryTransform,
      setBoundaryTransform,
      keyframes,
      setKeyframes,
      currentKeyframeId,
      setCurrentKeyframeId,
    }),
    [
      boundaryAspectRatio,
      setBoundaryAspectRatio,
      boundaryAspectOverride,
      setBoundaryAspectOverride,
      primaryBoundaryAspectOverride,
      secondaryBoundaryAspectOverride,
      setPrimaryBoundaryAspectOverride,
      setSecondaryBoundaryAspectOverride,
      boundaryVisible,
      setBoundaryVisible,
      boundaryTransform,
      setBoundaryTransform,
      keyframes,
      setKeyframes,
      currentKeyframeId,
      setCurrentKeyframeId,
    ]
  );

  const store = useContextStore(value);

  return (
    <KeyframeContext.Provider value={store}>
      {children}
    </KeyframeContext.Provider>
  );
}
