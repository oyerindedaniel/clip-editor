"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ManualClipData } from "@/types/app";
import logger from "@/utils/logger";
import { secondsToMs } from "@/utils/video";
import { useLatestValue } from "../use-latest-value";

export function useManualClips() {
  const [manualClips, setManualClips] = useState<ManualClipData[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("manual-clips");
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  });
  const manualClipsRef = useLatestValue(manualClips);

  const addManualClip = useCallback((file: File) => {
    return new Promise<ManualClipData>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      const handleLoadedMetadata = () => {
        const duration = secondsToMs(video.duration);
        const clipId = `manual-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`;

        const url = URL.createObjectURL(file);

        const manualClip: ManualClipData = {
          url,
          file,
          metadata: {
            clipId,
            clipDurationMs: duration,
            clipStartTime: 0,
            clipEndTime: duration,
            originalFilename: file.name,
            uploadTimestamp: new Date().toISOString(),
            isManual: true,
          },
        };

        setManualClips((prev) => {
          const newClips = [...prev, manualClip];

          try {
            localStorage.setItem("manual-clips", JSON.stringify(newClips));
          } catch (error) {
            logger.warn("Failed to store manual clips in localStorage:", error);
          }

          return newClips;
        });

        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("error", handleError);
        video.remove();

        logger.log("Manual clip added:", manualClip);
        resolve(manualClip);
      };

      const handleError = (error: Event) => {
        logger.error("Failed to load video metadata:", error);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("error", handleError);
        video.remove();
        reject(new Error("Failed to load video file"));
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("error", handleError);
      video.src = URL.createObjectURL(file);
    });
  }, []);

  const removeManualClip = useCallback((clipId: string) => {
    const newClips = manualClipsRef.current.filter(
      (clip) => clip.metadata.clipId !== clipId
    );
    localStorage.setItem("manual-clips", JSON.stringify(newClips));
    setManualClips(newClips);
  }, []);

  const cleanupAllManualClips = useCallback(() => {
    manualClipsRef.current.forEach((clip) => {
      URL.revokeObjectURL(clip.url);
    });
    setManualClips([]);
    logger.log("All manual clips cleaned up");
  }, []);

  useEffect(() => {
    return () => {
      cleanupAllManualClips();
    };
  }, [cleanupAllManualClips]);

  return {
    manualClips,
    addManualClip,
    removeManualClip,
    cleanupAllManualClips,
  };
}
