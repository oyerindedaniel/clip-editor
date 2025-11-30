"use client";

import {
  createContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
  useRef,
} from "react";
import type {
  DualVideoClip,
  DualVideoSettings,
  ClipMetadata,
  TrimData,
  CropMode,
} from "@/types/app";
import { type StoreApi, useContextStore } from "react-shallow-store";
import { DEFAULT_TRIM_DATA, DEFAULT_CLIP_METADATA } from "@/constants/app";
import { useLatestValue } from "@/hooks/use-latest-value";
import { useVideoRefs } from "@/hooks/app/use-video-refs";
import { getStorageKey } from "@/utils/app";
import logger from "@/utils/logger";
import { msToSeconds, secondsToMs } from "@/utils/video";
import { DEFAULT_TRANSFORM } from "@/utils/transform";
import type { Color } from "@/components/color-palette";

type ClipContextValue = {
  videoId: string;
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
  primaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  primaryDualVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryDualVideoRef: React.RefObject<HTMLVideoElement | null>;
  primaryRendererVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryRendererVideoRef: React.RefObject<HTMLVideoElement | null>;
  pipVideoRef: React.RefObject<HTMLVideoElement | null>;
  clearTrimData: () => { primaryTrim: TrimData; secondaryTrim: TrimData };
  canClearTrim: boolean;
  cropMode: CropMode;
  setCropMode: React.Dispatch<React.SetStateAction<CropMode>>;
  padColor: Color;
  setPadColor: React.Dispatch<React.SetStateAction<Color>>;
};

type StoredTrimData = {
  primary?: TrimData;
  secondary?: TrimData;
};

type TrimUpdater = TrimData | ((prev: TrimData) => TrimData);

export const DEFAULT_DUAL_VIDEO_SETTINGS = {
  layout: "vertical-letterbox",
  primaryAudio: "primary",
  normalizeAudio: true,
  primaryVolume: 0.2,
  secondaryVolume: 0.6,
  pip: DEFAULT_TRANSFORM,
  pipAspectRatio: "16:9",
  backgroundMode: "pad-color",
  backgroundVideo: "primary",
  primaryPanelPercentage: 50,
  backgroundAlign: "center",
  backgroundOpacity: 0.3,
  backgroundBlur: 2,
} as const;

export const ClipContext = createContext<StoreApi<ClipContextValue> | null>(
  null
);

interface ClipProviderProps {
  children: ReactNode;
  videoId: string;
  isManual?: boolean;
}

export const ClipProvider = ({ children, videoId }: ClipProviderProps) => {
  const [secondaryClip, setSecondaryClip] = useState<
    (DualVideoClip & ClipMetadata) | null
  >(null);

  const [dualVideoSettings, setDualVideoSettings] = useState<DualVideoSettings>(
    DEFAULT_DUAL_VIDEO_SETTINGS
  );
  const [cropMode, setCropMode] = useState<CropMode>(
    DEFAULT_CLIP_METADATA.cropMode
  );

  const [padColor, setPadColor] = useState<Color>(
    DEFAULT_CLIP_METADATA.padColor
  );

  const dualVideoSettingsRef = useLatestValue(dualVideoSettings);
  const hasPersistedTrimDataRef = useRef(false);

  console.log({ videoId });

  const [primaryTrim, setPrimaryTrim] = useState<TrimData>(() => {
    if (!videoId || typeof window === "undefined") return DEFAULT_TRIM_DATA;

    try {
      const combinedKey = getStorageKey(`${videoId}:trim-data`);
      const saved = localStorage.getItem(combinedKey);

      if (saved) {
        const parsed = JSON.parse(saved) as StoredTrimData;
        if (parsed?.primary) {
          hasPersistedTrimDataRef.current = true;
          return parsed.primary;
        }
      }
    } catch {}

    return DEFAULT_TRIM_DATA;
  });

  const [secondaryTrim, setSecondaryTrim] = useState<TrimData>(() => {
    if (!videoId || typeof window === "undefined") return DEFAULT_TRIM_DATA;

    try {
      const combinedKey = getStorageKey(`${videoId}:trim-data`);
      const saved = localStorage.getItem(combinedKey);

      if (saved) {
        const parsed = JSON.parse(saved) as StoredTrimData;
        if (parsed?.secondary) {
          hasPersistedTrimDataRef.current = true;
          return parsed.secondary;
        }
      }
    } catch {}

    return DEFAULT_TRIM_DATA;
  });

  const primaryTrimRef = useLatestValue(primaryTrim);
  const secondaryTrimRef = useLatestValue(secondaryTrim);

  const {
    getVideoRef,
    primaryVideoRef,
    secondaryVideoRef,
    primaryDualVideoRef,
    secondaryDualVideoRef,
    primaryRendererVideoRef,
    secondaryRendererVideoRef,
    pipVideoRef,
  } = useVideoRefs();

  const saveTrimDataToStorage = (primary: TrimData, secondary: TrimData) => {
    if (!videoId) return;

    const combinedKey = getStorageKey(`${videoId}:trim-data`);
    if (!combinedKey) return;

    try {
      const payload = JSON.stringify({
        primary,
        secondary,
      });

      localStorage.setItem(combinedKey, payload);
    } catch {}
  };

  const handleSetPrimaryTrim = useCallback(
    (trim: TrimUpdater) => {
      const newTrim = typeof trim === "function" ? trim(primaryTrim) : trim;
      setPrimaryTrim(newTrim);

      if (hasPersistedTrimDataRef.current) {
        logger.info(
          "Skipped save: loaded persisted trim data already present."
        );
        hasPersistedTrimDataRef.current = false;
        return;
      }

      saveTrimDataToStorage(newTrim, secondaryTrimRef.current);
    },
    [primaryTrim, secondaryTrimRef]
  );

  const handleSetSecondaryTrim = useCallback(
    (trim: TrimUpdater) => {
      const newTrim = typeof trim === "function" ? trim(secondaryTrim) : trim;
      setSecondaryTrim(newTrim);

      if (hasPersistedTrimDataRef.current) {
        logger.info(
          "Skipped save: loaded persisted trim data already present."
        );
        hasPersistedTrimDataRef.current = false;
        return;
      }

      saveTrimDataToStorage(primaryTrimRef.current, newTrim);
    },
    [secondaryTrim, primaryTrimRef]
  );

  const isDefaultTrim = useCallback((trim: TrimData, duration?: number) => {
    const isTrimEndDefault =
      trim.trimEnd === 0 ||
      (duration !== undefined &&
        Math.abs(msToSeconds(trim.trimEnd) - duration) < 0.01);

    return (
      trim.trimStart === 0 && isTrimEndDefault && trim.timelineOffset === 0
    );
  }, []);

  const evaluateCanClearTrim = useCallback(() => {
    const primaryEl = primaryVideoRef.current;
    const secondaryEl = secondaryVideoRef.current;

    // no video loaded yet
    if (!primaryEl && !secondaryEl) return false;

    const primaryDuration = primaryEl?.duration ?? 0;
    const secondaryDuration = secondaryEl?.duration ?? 0;

    // no valid duration
    if (primaryDuration === 0 && secondaryDuration === 0) return false;

    const primaryDefault = isDefaultTrim(primaryTrim, primaryDuration);
    const secondaryDefault =
      secondaryEl && secondaryClip
        ? isDefaultTrim(secondaryTrim, secondaryDuration)
        : true;

    // only allow clear if something actually changed
    return !(primaryDefault && secondaryDefault);
  }, [primaryTrim, secondaryTrim, secondaryClip, isDefaultTrim]);

  const clearTrimData = useCallback(() => {
    const canClear = evaluateCanClearTrim();

    if (!canClear) {
      logger.info("Clear skipped: trims already default or no valid video.");
      return {
        primaryTrim: primaryTrimRef.current,
        secondaryTrim: secondaryTrimRef.current,
      };
    }

    if (!videoId) {
      return {
        primaryTrim: primaryTrimRef.current,
        secondaryTrim: secondaryTrimRef.current,
      };
    }

    const combinedKey = getStorageKey(`${videoId}:trim-data`);
    if (combinedKey) {
      localStorage.removeItem(combinedKey);
    }

    const primaryDuration = primaryVideoRef.current?.duration ?? 0;
    const secondaryDuration = secondaryVideoRef.current?.duration ?? 0;

    const newPrimaryTrim = {
      ...DEFAULT_TRIM_DATA,
      trimEnd: secondsToMs(primaryDuration) || 0,
    };
    const newSecondaryTrim = {
      ...DEFAULT_TRIM_DATA,
      trimEnd: secondsToMs(secondaryDuration) || 0,
    };

    setPrimaryTrim(newPrimaryTrim);
    setSecondaryTrim(newSecondaryTrim);

    return {
      primaryTrim: newPrimaryTrim,
      secondaryTrim: newSecondaryTrim,
    };
  }, [videoId, evaluateCanClearTrim]);

  const canClearTrim = useMemo(
    () => evaluateCanClearTrim(),
    [primaryTrim, secondaryTrim, evaluateCanClearTrim]
  );

  const contextValue = useMemo<ClipContextValue>(
    () => ({
      secondaryClip,
      setSecondaryClip,
      dualVideoSettings,
      setDualVideoSettings,
      dualVideoSettingsRef,
      primaryTrim,
      setPrimaryTrim: handleSetPrimaryTrim,
      secondaryTrim,
      setSecondaryTrim: handleSetSecondaryTrim,
      primaryTrimRef,
      secondaryTrimRef,
      getVideoRef,
      primaryVideoRef,
      secondaryVideoRef,
      primaryDualVideoRef,
      secondaryDualVideoRef,
      primaryRendererVideoRef,
      secondaryRendererVideoRef,
      pipVideoRef,
      clearTrimData,
      canClearTrim,
      cropMode,
      setCropMode,
      padColor,
      setPadColor,
      videoId,
    }),
    [
      secondaryClip,
      setSecondaryClip,
      dualVideoSettings,
      setDualVideoSettings,
      dualVideoSettingsRef,
      primaryTrim,
      handleSetPrimaryTrim,
      secondaryTrim,
      handleSetSecondaryTrim,
      getVideoRef,
      clearTrimData,
      canClearTrim,
      cropMode,
      setCropMode,
      padColor,
      setPadColor,
      videoId,
    ]
  );

  const clipVideoStore = useContextStore(contextValue);

  return (
    <ClipContext.Provider value={clipVideoStore}>
      {children}
    </ClipContext.Provider>
  );
};
