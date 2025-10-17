"use client";
import { createContext, useState, ReactNode, useMemo } from "react";
import type {
  DualVideoClip,
  DualVideoSettings,
  ClipMetadata,
  TrimData,
} from "@/types/app";
import { type StoreApi, useContextStore } from "react-shallow-store";
import { DEFAULT_TRIM_DATA } from "@/constants/app";
import { useLatestValue } from "@/hooks/use-latest-value";
import { useVideoRefs } from "@/hooks/app/use-video-refs";
import { useConstrainedVideo } from "@/hooks/app/use-constrained-video";

type VideoState = ReturnType<typeof useConstrainedVideo>;

type DualVideoContextValue = {
  secondaryClip: (DualVideoClip & ClipMetadata) | null;
  setSecondaryClip: React.Dispatch<
    React.SetStateAction<(DualVideoClip & ClipMetadata) | null>
  >;
  dualVideoSettings: DualVideoSettings;
  setDualVideoSettings: React.Dispatch<React.SetStateAction<DualVideoSettings>>;
  dualVideoSettingsRef: React.RefObject<DualVideoSettings>;
  primaryTrim: TrimData;
  setPrimaryTrim: React.Dispatch<React.SetStateAction<TrimData>>;
  primaryTrimRef: React.RefObject<TrimData>;
  secondaryTrim: TrimData;
  setSecondaryTrim: React.Dispatch<React.SetStateAction<TrimData>>;
  secondaryTrimRef: React.RefObject<TrimData>;
  getVideoRef: ReturnType<typeof useVideoRefs>["getVideoRef"];
  primaryVideoRef: ReturnType<typeof useVideoRefs>["primaryVideoRef"];
  secondaryVideoRef: ReturnType<typeof useVideoRefs>["secondaryVideoRef"];
  repeatPrimaryRef: ReturnType<typeof useVideoRefs>["repeatPrimaryRef"];
  repeatSecondaryRef: ReturnType<typeof useVideoRefs>["repeatSecondaryRef"];
  primaryStatus: VideoState["status"];
  primaryControls: VideoState["controls"];
  primaryBuffered: VideoState["buffered"];
  secondaryStatus: VideoState["status"];
  secondaryControls: VideoState["controls"];
  secondaryBuffered: VideoState["buffered"];
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
      primaryAudio: "primary",
      normalizeAudio: true,
      primaryVolume: 0.8,
      secondaryVolume: 0.6,
      pipPosition: "bottom-right",
      pipSize: 0.25,
      secondaryOffset: 0,
    }
  );

  const dualVideoSettingsRef = useLatestValue(dualVideoSettings);

  const [primaryTrim, setPrimaryTrim] = useState<TrimData>(DEFAULT_TRIM_DATA);
  const [secondaryTrim, setSecondaryTrim] =
    useState<TrimData>(DEFAULT_TRIM_DATA);

  const primaryTrimRef = useLatestValue(primaryTrim);
  const secondaryTrimRef = useLatestValue(secondaryTrim);

  const {
    getVideoRef,
    primaryVideoRef,
    secondaryVideoRef,
    repeatPrimaryRef,
    repeatSecondaryRef,
  } = useVideoRefs();

  const primaryVideoState = useConstrainedVideo({
    videoRef: primaryVideoRef,
    trimStartRef: useLatestValue(primaryTrimRef.current.trimStart ?? 0),
    trimEndRef: useLatestValue(primaryTrimRef.current.trimEnd ?? 0),
    repeatRef: repeatPrimaryRef,
  });

  const secondaryVideoState = useConstrainedVideo({
    videoRef: secondaryVideoRef,
    trimStartRef: useLatestValue(secondaryTrimRef.current.trimStart ?? 0),
    trimEndRef: useLatestValue(secondaryTrimRef.current.trimEnd ?? 0),
    repeatRef: repeatSecondaryRef,
  });

  const contextValue = useMemo<DualVideoContextValue>(
    () => ({
      secondaryClip,
      setSecondaryClip,
      dualVideoSettings,
      setDualVideoSettings,
      dualVideoSettingsRef,
      primaryTrim,
      setPrimaryTrim,
      secondaryTrim,
      setSecondaryTrim,
      primaryTrimRef,
      secondaryTrimRef,
      getVideoRef,
      primaryVideoRef,
      secondaryVideoRef,
      repeatPrimaryRef,
      repeatSecondaryRef,
      primaryStatus: primaryVideoState.status,
      primaryControls: primaryVideoState.controls,
      primaryBuffered: primaryVideoState.buffered,
      secondaryStatus: secondaryVideoState.status,
      secondaryControls: secondaryVideoState.controls,
      secondaryBuffered: secondaryVideoState.buffered,
    }),
    [
      secondaryClip,
      setSecondaryClip,
      dualVideoSettings,
      setDualVideoSettings,
      dualVideoSettingsRef,
      primaryTrim,
      setPrimaryTrim,
      secondaryTrim,
      setSecondaryTrim,
      primaryTrimRef,
      secondaryTrimRef,
      getVideoRef,
      primaryVideoRef,
      secondaryVideoRef,
      repeatPrimaryRef,
      repeatSecondaryRef,
      primaryVideoState,
      secondaryVideoState,
    ]
  );

  const dualVideoStore = useContextStore(contextValue);

  return (
    <ClipContext.Provider value={dualVideoStore}>
      {children}
    </ClipContext.Provider>
  );
};
