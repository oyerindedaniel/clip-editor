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
} from "@/types/app";
import { type StoreApi, useContextStore } from "react-shallow-store";
import { DEFAULT_TRIM_DATA } from "@/constants/app";
import { useLatestValue } from "@/hooks/use-latest-value";
import { useVideoRefs } from "@/hooks/app/use-video-refs";
import { getStorageKey } from "@/utils/app";
import logger from "@/utils/logger";
import { msToSeconds, secondsToMs } from "@/utils/video";

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
  clearTrimData: () => void;
  canClearTrim: boolean;
};

type StoredTrimData = {
  primary?: TrimData;
  secondary?: TrimData;
};

type TrimUpdater = TrimData | ((prev: TrimData) => TrimData);

export const ClipContext =
  createContext<StoreApi<DualVideoContextValue> | null>(null);

interface ClipProviderProps {
  children: ReactNode;
  videoId?: string;
}

export const ClipProvider = ({ children, videoId }: ClipProviderProps) => {
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

  const hasPersistedTrimDataRef = useRef(false);

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

  const { getVideoRef, primaryVideoRef, secondaryVideoRef } = useVideoRefs();

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
    const secondaryDefault = isDefaultTrim(secondaryTrim, secondaryDuration);

    // only allow clear if something actually changed
    return !(primaryDefault && secondaryDefault);
  }, [primaryTrim, secondaryTrim, isDefaultTrim]);

  const clearTrimData = useCallback(() => {
    const canClear = evaluateCanClearTrim();

    if (!canClear) {
      logger.info("Clear skipped: trims already default or no valid video.");
      return;
    }

    if (!videoId) return;

    const combinedKey = getStorageKey(`${videoId}:trim-data`);
    if (combinedKey) {
      localStorage.removeItem(combinedKey);
    }

    const primaryDuration = primaryVideoRef.current?.duration ?? 0;
    const secondaryDuration = secondaryVideoRef.current?.duration ?? 0;

    setPrimaryTrim({
      ...DEFAULT_TRIM_DATA,
      trimEnd: secondsToMs(primaryDuration) || 0,
    });
    setSecondaryTrim({
      ...DEFAULT_TRIM_DATA,
      trimEnd: secondsToMs(secondaryDuration) || 0,
    });
  }, [videoId, evaluateCanClearTrim]);

  const canClearTrim = useMemo(
    () => evaluateCanClearTrim(),
    [primaryTrim, secondaryTrim, evaluateCanClearTrim]
  );

  const contextValue = useMemo<DualVideoContextValue>(
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
      clearTrimData,
      canClearTrim,
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
      primaryTrimRef,
      secondaryTrimRef,
      getVideoRef,
      primaryVideoRef,
      secondaryVideoRef,
      clearTrimData,
      canClearTrim,
    ]
  );

  const dualVideoStore = useContextStore(contextValue);

  return (
    <ClipContext.Provider value={dualVideoStore}>
      {children}
    </ClipContext.Provider>
  );
};
