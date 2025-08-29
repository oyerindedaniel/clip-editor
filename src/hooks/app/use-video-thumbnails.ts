"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import logger from "@/utils/logger";

export function useVideoThumbnails(
  src: string | undefined,
  frameCount: number = 24,
  enabled: boolean = true
) {
  const [frames, setFrames] = useState<string[] | undefined>(undefined);
  const cancelRef = useRef(false);

  const sampleFramesFromUrl = useCallback(
    async (url: string, count: number): Promise<string[]> => {
      return new Promise(async (resolve) => {
        try {
          if (!url || url === "undefined" || url === "null") {
            logger.warn(
              "Invalid video URL provided to useVideoThumbnails:",
              url
            );
            return resolve([]);
          }

          const video = document.createElement("video");
          video.src = url;
          video.crossOrigin = "anonymous";
          video.muted = true;
          video.preload = "auto";

          const onError = (e: Event) => {
            logger.warn("Video load error in useVideoThumbnails:", e);
            resolve([]);
          };
          video.addEventListener("error", onError, { once: true });

          const timeout = setTimeout(() => {
            logger.warn("Video load timeout in useVideoThumbnails");
            resolve([]);
          }, 10000);

          await new Promise<void>((res) => {
            if (video.readyState >= 1) {
              clearTimeout(timeout);
              return res();
            }
            video.addEventListener(
              "loadedmetadata",
              () => {
                clearTimeout(timeout);
                res();
              },
              { once: true }
            );
          });

          const duration = Math.max(0.1, video.duration); // seconds
          const canvas = document.createElement("canvas");
          const targetW = 96;
          const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
          canvas.width = targetW;
          canvas.height = Math.max(1, Math.round(targetW / aspect));
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve([]);

          const thumbs: string[] = [];
          const captureAt = async (t: number) => {
            return new Promise<void>((res) => {
              const onSeek = () => {
                try {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  thumbs.push(canvas.toDataURL("image/webp", 0.7));
                } catch (e) {
                  logger.warn("Error capturing frame:", e);
                }
                video.removeEventListener("seeked", onSeek);
                res();
              };
              video.addEventListener("seeked", onSeek);
              video.currentTime = Math.min(
                Math.max(t, 0),
                Math.max(duration - 0.05, 0)
              );
            });
          };

          const step = duration / count;
          for (let i = 0; i < count; i++) {
            if (cancelRef.current) return resolve([]);
            const t = i * step;
            await new Promise((r) => requestAnimationFrame(r));
            // eslint-disable-next-line no-await-in-loop
            await captureAt(t);
          }

          resolve(thumbs);
        } catch (e) {
          logger.warn("Error in useVideoThumbnails:", e);
          resolve([]);
        }
      });
    },
    []
  );

  useEffect(() => {
    cancelRef.current = false;
    if (!enabled || !src) {
      setFrames(undefined);
      return;
    }

    logger.log("useVideoThumbnails: Starting thumbnail generation for:", src);
    let active = true;

    (async () => {
      try {
        const result = await sampleFramesFromUrl(src, frameCount);
        if (!cancelRef.current && active) {
          logger.log(
            "useVideoThumbnails: Generated",
            result.length,
            "thumbnails"
          );
          setFrames(result);
        }
      } catch (error) {
        logger.warn("useVideoThumbnails: Error generating thumbnails:", error);
        if (!cancelRef.current && active) {
          setFrames([]);
        }
      }
    })();

    return () => {
      cancelRef.current = true;
      active = false;
    };
  }, [src, frameCount, enabled, sampleFramesFromUrl]);

  return frames;
}

export default useVideoThumbnails;
