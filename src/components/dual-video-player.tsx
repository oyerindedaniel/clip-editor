"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { S3ClipData, DualVideoClip } from "@/types/app";
import * as MediaPlayer from "@/components/ui/media-player";
import { Badge } from "@/components/ui/badge";
import logger from "@/utils/logger";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";

interface DualVideoPlayerProps {
  primaryClip: S3ClipData;
  secondaryClip: DualVideoClip | null;
  offsetMs: number;
  className?: string;
  primarySrc?: string;
  primaryVideoRef?: React.RefObject<HTMLVideoElement> | null;
  currentTime?: number;
}

export const DualVideoPlayer: React.FC<DualVideoPlayerProps> = ({
  primaryClip,
  secondaryClip,
  offsetMs,
  className,
  primarySrc,
  primaryVideoRef,
  currentTime = 0,
}) => {
  const internalPrimaryRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const primaryRef = useComposedRefs(internalPrimaryRef, primaryVideoRef);

  const { setDualVideoRef, getTimeBasedOverlays } = useShallowSelector(
    OverlaysContext,
    (state) => ({
      setDualVideoRef: state.setDualVideoRef,
      getTimeBasedOverlays: state.getTimeBasedOverlays,
    })
  );

  useEffect(() => {
    setDualVideoRef(internalPrimaryRef);
  }, [setDualVideoRef, primaryRef]);

  // const { textOverlays, imageOverlays } = getTimeBasedOverlays(currentTime);

  // Sync secondary video with primary video based on offset
  const syncVideos = useCallback(() => {
    const primaryVideo = internalPrimaryRef.current;
    const secondaryVideo = secondaryVideoRef.current;

    if (!primaryVideo || !secondaryVideo) return;

    const primaryTime = primaryVideo.currentTime;
    const secondaryTime = primaryTime - offsetMs / 1000;

    // Only update secondary if the time difference is significant (> 0.1s)
    if (Math.abs(secondaryVideo.currentTime - secondaryTime) > 0.1) {
      secondaryVideo.currentTime = Math.max(0, secondaryTime);
    }
  }, [offsetMs]);

  const handlePrimaryTimeUpdate = useCallback(() => {
    syncVideos();
  }, [syncVideos]);

  // Handle primary video seeking
  const handlePrimarySeeked = useCallback(() => {
    syncVideos();
  }, [syncVideos]);

  const handlePrimaryPlay = useCallback(() => {
    const secondaryVideo = secondaryVideoRef.current;
    if (secondaryVideo) {
      secondaryVideo.play().catch(logger.warn);
    }
  }, []);

  const handlePrimaryPause = useCallback(() => {
    const secondaryVideo = secondaryVideoRef.current;
    if (secondaryVideo && !secondaryVideo.paused) {
      secondaryVideo.pause();
    }
  }, []);

  useEffect(() => {
    const primaryVideo = internalPrimaryRef.current;
    if (!primaryVideo) return;

    primaryVideo.addEventListener("play", handlePrimaryPlay);
    primaryVideo.addEventListener("pause", handlePrimaryPause);
    primaryVideo.addEventListener("timeupdate", handlePrimaryTimeUpdate);
    primaryVideo.addEventListener("seeked", handlePrimarySeeked);

    return () => {
      primaryVideo.removeEventListener("play", handlePrimaryPlay);
      primaryVideo.removeEventListener("pause", handlePrimaryPause);
      primaryVideo.removeEventListener("timeupdate", handlePrimaryTimeUpdate);
      primaryVideo.removeEventListener("seeked", handlePrimarySeeked);
    };
  }, [
    handlePrimaryPlay,
    handlePrimaryPause,
    handlePrimaryTimeUpdate,
    handlePrimarySeeked,
  ]);

  return (
    <div
      className={cn(
        "relative bg-black rounded-lg overflow-hidden aspect-[9/16] flex flex-col justify-center w-full",
        className
      )}
    >
      <div className="relative">
        <MediaPlayer.Root className="rounded-none">
          <MediaPlayer.Video
            ref={primaryRef}
            src={primarySrc || primaryClip.url}
            className="w-full h-full object-cover"
            muted={false}
            playsInline
            preload="metadata"
          />
          <MediaPlayer.Loading />
          <MediaPlayer.Error />
          <MediaPlayer.VolumeIndicator />
        </MediaPlayer.Root>
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 text-[10px] uppercase font-mono"
        >
          Primary
        </Badge>
      </div>

      {secondaryClip && (
        <div className="relative">
          <MediaPlayer.Root className="rounded-none">
            <MediaPlayer.Video
              ref={secondaryVideoRef}
              src={secondaryClip.url}
              className="w-full h-full object-cover rounded-none"
              muted={true}
              playsInline
              preload="metadata"
            />
            <MediaPlayer.Loading />
            <MediaPlayer.Error />
            <MediaPlayer.VolumeIndicator />
          </MediaPlayer.Root>
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 text-[10px] uppercase font-mono"
          >
            Secondary
          </Badge>
        </div>
      )}

      {secondaryClip && (
        <div className="absolute top-1/2 left-0 right-0 h-px bg-red-600" />
      )}
    </div>
  );
};

export default DualVideoPlayer;
