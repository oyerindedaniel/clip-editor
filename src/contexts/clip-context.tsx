"use client";
import {
  createContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
  RefObject,
} from "react";
import type {
  DualVideoClip,
  DualVideoSettings,
  ClipMetadata,
  TrimData,
} from "@/types/app";
import { type StoreApi, useContextStore } from "react-shallow-store";
import { DEFAULT_TRIM_DATA } from "@/constants/app";

type DualVideoContextValue = {
  secondaryClip: (DualVideoClip & ClipMetadata) | null;
  setSecondaryClip: React.Dispatch<
    React.SetStateAction<(DualVideoClip & ClipMetadata) | null>
  >;
  dualVideoSettings: DualVideoSettings;
  setDualVideoSettings: React.Dispatch<React.SetStateAction<DualVideoSettings>>;
  videoOffsetMs: number;
  setVideoOffsetMs: React.Dispatch<React.SetStateAction<number>>;
  primaryTrim: TrimData;
  setPrimaryTrim: React.Dispatch<React.SetStateAction<TrimData>>;
  secondaryTrim: TrimData;
  setSecondaryTrim: React.Dispatch<React.SetStateAction<TrimData>>;
};

export const ClipContext =
  createContext<StoreApi<DualVideoContextValue> | null>(null);

export const ClipProvider = ({ children }: { children: ReactNode }) => {
  const [secondaryClip, setSecondaryClip] = useState<
    (DualVideoClip & ClipMetadata) | null
  >(null);

  const [dualVideoSettings, setDualVideoSettings] = useState<DualVideoSettings>(
    {
      layout: "vertical-letterbox",
      outputOrientation: "vertical",
      primaryAudio: "primary",
      normalizeAudio: true,
      primaryVolume: 0.8,
      secondaryVolume: 0.6,
      pipPosition: "bottom-right",
      pipSize: 0.25,
      secondaryOffset: 0,
    }
  );

  const [primaryTrim, setPrimaryTrim] = useState<TrimData>(DEFAULT_TRIM_DATA);
  const [secondaryTrim, setSecondaryTrim] =
    useState<TrimData>(DEFAULT_TRIM_DATA);

  const [videoOffsetMs, setVideoOffsetMs] = useState<number>(0);

  const contextValue = {
    secondaryClip,
    setSecondaryClip,
    dualVideoSettings,
    setDualVideoSettings,
    videoOffsetMs,
    setVideoOffsetMs,
    primaryTrim,
    setPrimaryTrim,
    secondaryTrim,
    setSecondaryTrim,
  };

  const dualVideoStore = useContextStore(contextValue);

  return (
    <ClipContext.Provider value={dualVideoStore}>
      {children}
    </ClipContext.Provider>
  );
};
