"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, Edit } from "lucide-react";

interface Clip {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  duration: number;
  streamerName: string;
}

interface ClipGridProps {
  initialClips: Clip[];
}

export default function ClipGrid({ initialClips }: ClipGridProps) {
  const router = useRouter();

  const handleClipClick = (clipId: string) => {
    router.push(`/edit/${clipId}`);
  };

  const handlePlayClip = (clip: Clip) => {
    window.open(clip.url, "_blank");
  };

  if (initialClips.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-3xl font-semibold text-foreground-default mb-4 font-sans tracking-tight">
          No clips found
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground-default font-sans tracking-tight">
          Clips
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialClips.map((clip) => (
          <div
            key={clip.id}
            className="bg-surface-secondary rounded-lg overflow-hidden border border-gray-700/50 hover:border-primary/50 transition-colors cursor-pointer group"
            onClick={() => handleClipClick(clip.id)}
          >
            <div className="aspect-video bg-gray-800 relative overflow-hidden">
              <video
                src={clip.url}
                className="w-full h-full object-cover"
                preload="metadata"
                muted
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayClip(clip);
                    }}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClipClick(clip.id);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4">
              <h3 className="font-semibold text-foreground-default truncate text-lg font-sans tracking-wide">
                {clip.name}
              </h3>
              <p className="text-sm text-foreground-subtle mt-2 font-sans tracking-wide">
                {new Date(clip.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
