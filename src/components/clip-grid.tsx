"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Edit, X } from "lucide-react";
import type { ClipData } from "@/types/app";
import { isManualClip } from "@/types/app";
import Link from "next/link";
import { LoaderIcon } from "@/icons/loader";
import logger from "@/utils/logger";
import UploadVideoItem from "./upload-video-item";
import { useManualClips } from "@/hooks/app/use-manual-clips";
import { toast } from "sonner";
import { useClientOnly } from "@/hooks/use-client-only";
import { useIsoLayoutEffect } from "@/hooks/use-Isomorphic-layout-effect";

interface ClipGridProps {
  initialClips: ClipData[];
}

export default function ClipGrid({
  initialClips: initialServerClips,
}: ClipGridProps) {
  const isClient = useClientOnly();
  const { manualClips, addManualClip, removeManualClip } = useManualClips();
  const [isUploading, setIsUploading] = useState(false);

  const serverClips = useMemo(
    () => initialServerClips.filter((clip) => !isManualClip(clip)),
    [initialServerClips]
  );

  const allClips = useMemo(
    () => [...serverClips, ...manualClips],
    [serverClips, manualClips]
  );

  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(
    () => new Set(initialServerClips.map((clip) => clip.metadata.clipId))
  );
  const processedThumbnailsRef = useRef<Set<string>>(new Set());
  const dimensionRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const handleVideoUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const manualClip = await addManualClip(file);
        toast.success(
          `Video uploaded successfully: ${manualClip.metadata.originalFilename}`
        );
      } catch (error) {
        logger.error("Failed to upload video:", error);
        toast.error("Failed to upload video. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [addManualClip]
  );

  const handleRemoveManualClip = useCallback(
    (e: React.MouseEvent, clipId: string) => {
      e.preventDefault();
      e.stopPropagation();

      removeManualClip(clipId);
      toast.success("Video removed successfully");
    },
    [removeManualClip]
  );

  useIsoLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width && rect.height) {
        dimensionRef.current = { width: rect.width, height: rect.height };
        setReady(true);
      }
    }
  }, []);

  const generateThumbnail = useCallback(
    (videoUrl: string, canvas: HTMLCanvasElement, clipId: string) => {
      if (processedThumbnailsRef.current.has(clipId)) return;

      const { width, height } = dimensionRef.current;
      if (!width || !height) {
        logger.warn("Tried to generate thumbnail before ready:", clipId);
        return;
      }

      processedThumbnailsRef.current.add(clipId);

      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      video.preload = "auto";
      video.muted = true;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = width;
      canvas.height = height;

      let isCleaningUp = false;

      const cleanup = () => {
        if (isCleaningUp) return;
        isCleaningUp = true;

        video.removeEventListener("seeked", drawFrame);
        video.removeEventListener("error", onError);
        video.removeEventListener("loadeddata", onLoadedData);

        video.pause();
        video.removeAttribute("src");
        video.load();
        video.remove();

        setLoadingThumbnails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(clipId);
          return newSet;
        });
      };

      const drawFrame = () => {
        try {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) throw new Error("Invalid video dimensions");

          const videoAspect = vw / vh;
          const canvasAspect = width / height;

          let dw = width;
          let dh = height;
          let dx = 0;
          let dy = 0;

          if (videoAspect > canvasAspect) {
            dw = height * videoAspect;
            dx = (width - dw) / 2;
          } else {
            dh = width / videoAspect;
            dy = (height - dh) / 2;
          }

          ctx.drawImage(video, dx, dy, dw, dh);
        } catch (err) {
          logger.warn("Draw failed", clipId, err);
        } finally {
          cleanup();
        }
      };

      const onError = (e: unknown) => {
        if (!isCleaningUp) {
          logger.warn("Video error", clipId, e);
        }
        cleanup();
      };

      const onLoadedData = () => {
        if (video.readyState >= 2) {
          video.currentTime = Math.min(video.duration * 0.1, 1);
        }
      };

      video.addEventListener("loadeddata", onLoadedData);
      video.addEventListener("seeked", drawFrame);
      video.addEventListener("error", onError);
      video.load();

      return cleanup;
    },
    []
  );

  useEffect(() => {
    if (!ready) return;
    const cleanups: (() => void)[] = [];

    for (const [clipId, canvas] of canvasRefs.current.entries()) {
      const clip = allClips.find((clip) => clip.metadata.clipId === clipId);
      if (clip && canvas) {
        const cleanup = generateThumbnail(clip.url, canvas, clipId);
        if (cleanup) cleanups.push(() => cleanup());
      }
    }

    return () => {
      cleanups.forEach((fn, index) => {
        const clipId = Array.from(canvasRefs.current.keys())[index];
        if (loadingThumbnails.has(clipId)) return;
        fn();
      });
    };
  }, [ready, generateThumbnail, allClips, loadingThumbnails]);

  const setCanvasRef = useCallback((clipId: string) => {
    return (el: HTMLCanvasElement | null) => {
      if (el && !canvasRefs.current.has(clipId)) {
        canvasRefs.current.set(clipId, el);
      }
    };
  }, []);

  if (initialServerClips.length === 0 && !isUploading) {
    return (
      <div>
        <h2 className="text-3xl font-semibold absolute left-2/4 top-2/4 -translate-y-2/4 -translate-x-2/4 text-foreground-subtle mb-4 font-sans tracking-tight">
          No clips found.
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground-subtle font-sans tracking-tight">
          💽 Clips
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        <UploadVideoItem
          onVideoUpload={handleVideoUpload}
          isUploading={isUploading}
          className="group"
        />

        {serverClips.map((clip, index) => (
          <ClipCard
            key={clip.metadata.clipId}
            clip={clip}
            setCanvasRef={setCanvasRef}
            containerRef={index === 0 ? containerRef : undefined}
            loadingThumbnails={loadingThumbnails}
            handleRemove={handleRemoveManualClip}
          />
        ))}

        {isClient && (
          <ManualClipCards
            manualClips={manualClips}
            setCanvasRef={setCanvasRef}
            handleRemove={handleRemoveManualClip}
          />
        )}
      </div>
    </div>
  );
}

interface ClipCardProps {
  clip: ClipData;
  setCanvasRef: (clipId: string) => (el: HTMLCanvasElement | null) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  loadingThumbnails?: Set<string>;
  handleRemove: (e: React.MouseEvent, clipId: string) => void;
}

function ClipCard({
  clip,
  setCanvasRef,
  containerRef,
  loadingThumbnails,
  handleRemove,
}: ClipCardProps) {
  const router = useRouter();
  return (
    <Link
      href={
        isManualClip(clip)
          ? `/edit/manual/${clip.metadata.clipId}`
          : `/edit/${clip.metadata.clipId}`
      }
    >
      <div
        ref={containerRef}
        className="p-4 bg-surface-secondary rounded-3xl aspect-[4/3] w-full group"
      >
        <div className="bg-surface-secondary rounded-2xl overflow-hidden border border-subtle hover:border-primary transition-colors cursor-pointer group">
          <div className="bg-surface-tertiary relative overflow-hidden">
            <canvas
              ref={setCanvasRef(clip.metadata.clipId)}
              className="aspect-[4/3] w-full object-cover group-hover:scale-110 duration-250"
            />
            {loadingThumbnails?.has(clip.metadata.clipId) && (
              <div className="absolute inset-0 bg-surface-primary/80 flex items-center justify-center">
                <LoaderIcon className="text-foreground-default" size={32} />
              </div>
            )}
            <div className="absolute inset-0 bg-surface-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex space-x-2">
                <Button
                  size="icon"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    const href = isManualClip(clip)
                      ? `/edit/manual/${clip.metadata.clipId}`
                      : `/edit/${clip.metadata.clipId}`;
                    router.push(href);
                  }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                {isManualClip(clip) && (
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={(e) => handleRemove(e, clip.metadata.clipId)}
                    className="bg-error hover:bg-error/90"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <h3 className="font-semibold text-foreground-default truncate text-lg font-sans tracking-wide max-w-[80%]">
            {isManualClip(clip)
              ? clip.metadata.originalFilename
              : clip.metadata.clipId}
          </h3>
          <div className="mt-2 space-y-1">
            <p className="text-sm text-foreground-subtle font-sans tracking-wide">
              {isManualClip(clip)
                ? "Uploaded by you"
                : clip.metadata.streamerName || "Unknown Streamer"}
            </p>
            <p
              className="text-sm text-foreground-subtle font-sans tracking-wide"
              suppressHydrationWarning
            >
              {isManualClip(clip)
                ? new Date(clip.metadata.uploadTimestamp).toLocaleString()
                : clip.metadata.streamStartTime
                ? new Date(clip.metadata.streamStartTime).toLocaleString()
                : "Unknown"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ManualClipCards({
  manualClips,
  setCanvasRef,
  handleRemove,
}: Pick<ClipCardProps, "setCanvasRef" | "handleRemove"> & {
  manualClips: ClipData[];
}) {
  if (manualClips.length === 0) return null;
  return (
    <>
      {manualClips.map((clip: ClipData) => (
        <ClipCard
          key={clip.metadata.clipId}
          clip={clip}
          setCanvasRef={setCanvasRef}
          handleRemove={handleRemove}
        />
      ))}
    </>
  );
}
