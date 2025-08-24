"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { S3ClipData as ClipData } from "@/types/app";

interface ClipGridProps {
  initialClips: ClipData[];
}

export default function ClipGrid({ initialClips }: ClipGridProps) {
  const router = useRouter();

  const handleClipClick = (clipId: string) => {
    router.push(`/edit/${clipId}`);
  };

  console.log(initialClips);

  const generateThumbnail = (
    videoUrl: string,
    canvasRef: React.RefObject<HTMLCanvasElement>
  ) => {
    const video = document.createElement("video");
    const canvas = canvasRef.current;

    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    video.crossOrigin = "anonymous";
    video.src = videoUrl;

    video.addEventListener("loadeddata", () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      video.currentTime = 1;

      video.addEventListener("seeked", () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      });
    });

    video.load();
  };

  if (initialClips.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-3xl font-semibold text-foreground-default mb-4 font-sans tracking-tight">
          No clips found.
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground-default font-sans tracking-tight">
          💽 Clips
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialClips.map((clip) => (
          <div
            key={clip.metadata.clipId}
            className="p-4 bg-surface-secondary rounded-lg"
          >
            <div
              className="bg-surface-secondary rounded-lg overflow-hidden border border-gray-700/50 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => handleClipClick(clip.metadata.clipId)}
            >
              <div className="aspect-video bg-gray-800 relative overflow-hidden">
                <canvas
                  ref={(el) => {
                    if (el) {
                      generateThumbnail(clip.url, { current: el });
                    }
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClipClick(clip.metadata.clipId);
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
        ))}
      </div>
    </div>
  );
}
