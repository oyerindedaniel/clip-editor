"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import type { S3ClipData as ClipData } from "@/types/app";
import Link from "next/link";
import { LoaderIcon } from "@/icons/loader";

interface ClipGridProps {
  initialClips: ClipData[];
}

export default function ClipGrid({ initialClips }: ClipGridProps) {
  const router = useRouter();
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(
    new Set()
  );
  const processedThumbnailsRef = useRef<Set<string>>(new Set());

  const generateThumbnail = useCallback(
    (videoUrl: string, canvas: HTMLCanvasElement, clipId: string) => {
      if (processedThumbnailsRef.current.has(clipId)) return;

      processedThumbnailsRef.current.add(clipId);
      setLoadingThumbnails((prev) => new Set(prev).add(clipId));

      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      video.preload = "metadata";

      const container = canvas.parentElement;
      if (!container) {
        setLoadingThumbnails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(clipId);
          return newSet;
        });
        return;
      }

      const { width, height } = container.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setLoadingThumbnails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(clipId);
          return newSet;
        });
        return;
      }

      const cleanup = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("loadeddata", onLoadedData);
        video.removeEventListener("error", onError);
        video.pause();
        video.src = "";
        video.load();
      };

      const onSeeked = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (error) {
          console.warn(`Failed to draw thumbnail for ${clipId}:`, error);
        }

        setLoadingThumbnails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(clipId);
          return newSet;
        });
        cleanup();
      };

      const onError = () => {
        console.warn(`Failed to load video for thumbnail: ${clipId}`);
        processedThumbnailsRef.current.delete(clipId);
        setLoadingThumbnails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(clipId);
          return newSet;
        });
        cleanup();
      };

      const onLoadedData = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.addEventListener("loadeddata", onLoadedData);
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);

      video.load();
    },
    []
  );

  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const setCanvasRef = useCallback(
    (clipId: string, videoUrl: string) => {
      return (el: HTMLCanvasElement | null) => {
        if (el && !canvasRefs.current.has(clipId)) {
          canvasRefs.current.set(clipId, el);
          generateThumbnail(videoUrl, el, clipId);
        }
      };
    },
    [generateThumbnail]
  );

  if (initialClips.length === 0) {
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialClips.map((clip) => (
          <Link
            href={`/edit/${clip.metadata.clipId}`}
            key={clip.metadata.clipId}
          >
            <div className="p-4 bg-surface-secondary rounded-lg">
              <div className="bg-surface-secondary rounded-lg overflow-hidden border border-gray-700/50 hover:border-primary/50 transition-colors cursor-pointer group">
                <div className="aspect-video bg-gray-800 relative overflow-hidden">
                  <canvas
                    ref={setCanvasRef(clip.metadata.clipId, clip.url)}
                    className="w-full h-full object-cover"
                  />
                  {loadingThumbnails.has(clip.metadata.clipId) && (
                    <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center">
                      <LoaderIcon className="text-white" size={32} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/edit/${clip.metadata.clipId}`);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-foreground-default truncate text-lg font-sans tracking-wide">
                  {clip.metadata.clipId}
                </h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-foreground-subtle font-sans tracking-wide">
                    {clip.metadata.streamerName}
                  </p>
                  <p
                    className="text-sm text-foreground-subtle font-sans tracking-wide"
                    suppressHydrationWarning
                  >
                    {clip.metadata.streamStartTime
                      ? new Date(clip.metadata.streamStartTime).toLocaleString()
                      : "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
