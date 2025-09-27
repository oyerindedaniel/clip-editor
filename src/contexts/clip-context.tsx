"use client";
import { createContext, useState, ReactNode } from "react";
import type {
  DualVideoClip,
  DualVideoSettings,
  ClipMetadata,
  TrimData,
} from "@/types/app";
import { type StoreApi, useContextStore } from "react-shallow-store";
import { DEFAULT_TRIM_DATA } from "@/constants/app";
import { useLatestValue } from "@/hooks/use-latest-value";

type DualVideoContextValue = {
  secondaryClip: (DualVideoClip & ClipMetadata) | null;
  setSecondaryClip: React.Dispatch<
    React.SetStateAction<(DualVideoClip & ClipMetadata) | null>
  >;
  dualVideoSettings: DualVideoSettings;
  setDualVideoSettings: React.Dispatch<React.SetStateAction<DualVideoSettings>>;
  primaryTrim: TrimData;
  setPrimaryTrim: React.Dispatch<React.SetStateAction<TrimData>>;
  primaryTrimRef: React.RefObject<TrimData>;

  secondaryTrim: TrimData;
  setSecondaryTrim: React.Dispatch<React.SetStateAction<TrimData>>;
  secondaryTrimRef: React.RefObject<TrimData>;
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

  const primaryTrimRef = useLatestValue(primaryTrim);
  const secondaryTrimRef = useLatestValue(secondaryTrim);

  const contextValue = {
    secondaryClip,
    setSecondaryClip,
    dualVideoSettings,
    setDualVideoSettings,
    primaryTrim,
    setPrimaryTrim,
    secondaryTrim,
    setSecondaryTrim,
    primaryTrimRef,
    secondaryTrimRef,
  };

  const dualVideoStore = useContextStore(contextValue);

  return (
    <ClipContext.Provider value={dualVideoStore}>
      {children}
    </ClipContext.Provider>
  );
};
