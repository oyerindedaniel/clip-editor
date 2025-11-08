"use client";

import { useState, useCallback, useEffect } from "react";
import type { ManualClipData } from "@/types/app";
import logger from "@/utils/logger";
import { secondsToMs } from "@/utils/video";
import { useLatestValue } from "../use-latest-value";
import {
  idbDeleteManualClip,
  idbGetAllManualClipRecords,
  idbSaveManualClipRecord,
} from "@/utils/idb";

export function useManualClips() {
  const [manualClips, setManualClips] = useState<ManualClipData[]>([]);
  const manualClipsRef = useLatestValue(manualClips);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const records = await idbGetAllManualClipRecords();
      if (cancelled) return;

      const restored: ManualClipData[] = records.map((rec) => ({
        url: URL.createObjectURL(rec.file),
        file: rec.file as File,
        metadata: rec.metadata,
      }));

      setManualClips(restored);
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

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

        setManualClips((prev) => [...prev, manualClip]);

        idbSaveManualClipRecord({
          clipId,
          file,
          metadata: manualClip.metadata,
        }).catch((e) =>
          logger.warn("Failed to persist manual clip in IDB", clipId, e)
        );

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
    setManualClips(newClips);
    idbDeleteManualClip(clipId).catch((e) =>
      logger.warn("Failed to delete manual clip from IDB", clipId, e)
    );
    const removed = manualClipsRef.current.find(
      (c) => c.metadata.clipId === clipId
    );
    if (removed?.url) URL.revokeObjectURL(removed.url);
  }, []);

  const cleanupAllManualClips = useCallback(() => {
    manualClipsRef.current.forEach((clip) => {
      URL.revokeObjectURL(clip.url);
    });
    setManualClips([]);
    logger.log("All manual clips cleaned up");
  }, []);

  return {
    manualClips,
    addManualClip,
    removeManualClip,
    cleanupAllManualClips,
  };
}
