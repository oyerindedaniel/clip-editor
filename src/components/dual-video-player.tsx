"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { Expand, SquareStack } from "lucide-react";
import { cn } from "@/lib/utils";
import type { S3ClipData, DualVideoClip } from "@/types/app";
import { Badge } from "@/components/ui/badge";
import logger from "@/utils/logger";
import { Button } from "./ui/button";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";
import { ClipContext } from "@/contexts/clip-context";
import { PersistentOverlays } from "./persistent-overlays";

interface DualVideoPlayerProps {
  primaryClip: S3ClipData;
  duration: number;
  secondaryClip: DualVideoClip | null;
  currentTime?: number;
}

export const DualVideoPlayer: React.FC<DualVideoPlayerProps> = ({
  primaryClip,
  secondaryClip,
  duration,
  currentTime = 0,
}) => {
  const [displayMode, setDisplayMode] = useState<"split" | "stretch">("split");

  const [isSeekingPrimary, setIsSeekingPrimary] = useState(false);
  const lastSyncTimeRef = useRef<number>(0);

  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);

  const { setDualVideoRef, secondaryContainerRef } = useShallowSelector(
    OverlaysContext,
    (state) => ({
      setDualVideoRef: state.setDualVideoRef,
      secondaryContainerRef: state.secondaryContainerRef,
    })
  );

  const { videoOffsetMs } = useShallowSelector(ClipContext, (state) => ({
    videoOffsetMs: state.videoOffsetMs,
  }));

  useEffect(() => {
    setDualVideoRef(primaryVideoRef);
  }, []);

  const toggleDisplayMode = () => {
    setDisplayMode((prev) => (prev === "split" ? "stretch" : "split"));
  };

  const syncVideos = useCallback(() => {
    const primaryVideo = primaryVideoRef.current;
    const secondaryVideo = secondaryVideoRef.current;

    if (!primaryVideo || !secondaryVideo || isSeekingPrimary) return;

    const primaryTime = primaryVideo.currentTime;
    const secondaryTargetTime = Math.max(0, primaryTime - videoOffsetMs / 1000);
    const currentSecondaryTime = secondaryVideo.currentTime;
    const timeDiff = Math.abs(currentSecondaryTime - secondaryTargetTime);

    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;

    if (timeDiff > 0.2 && timeSinceLastSync > 100) {
      logger.log("Syncing secondary video:", {
        primaryTime,
        secondaryTargetTime,
        currentSecondaryTime,
        timeDiff,
        videoOffsetMs,
      });

      secondaryVideo.currentTime = secondaryTargetTime;
      lastSyncTimeRef.current = now;
    }
  }, [videoOffsetMs, isSeekingPrimary]);

  const handlePrimaryTimeUpdate = useCallback(() => {
    if (!isSeekingPrimary) {
      syncVideos();
    }
  }, [syncVideos, isSeekingPrimary]);

  const handlePrimarySeeking = useCallback(() => {
    setIsSeekingPrimary(true);
  }, []);

  const handlePrimarySeeked = useCallback(() => {
    setIsSeekingPrimary(false);
    setTimeout(() => {
      syncVideos();
    }, 50);
  }, [syncVideos]);

  const handlePrimaryPlay = useCallback(() => {
    const primaryVideo = primaryVideoRef.current;
    const secondaryVideo = secondaryVideoRef.current;

    if (!primaryVideo || !secondaryVideo) return;

    const primaryTime = primaryVideo.currentTime;
    const secondaryTargetTime = Math.max(0, primaryTime - videoOffsetMs / 1000);

    if (secondaryTargetTime >= 0) {
      secondaryVideo.currentTime = secondaryTargetTime;
      secondaryVideo.play().catch((error) => {
        logger.warn("Failed to play secondary video:", error);
      });
    }
  }, [videoOffsetMs]);

  const handlePrimaryPause = useCallback(() => {
    const secondaryVideo = secondaryVideoRef.current;
    if (secondaryVideo && !secondaryVideo.paused) {
      secondaryVideo.pause();
    }
  }, []);

  useEffect(() => {
    const primaryVideo = primaryVideoRef.current;
    if (!primaryVideo) return;

    primaryVideo.addEventListener("play", handlePrimaryPlay);
    primaryVideo.addEventListener("pause", handlePrimaryPause);
    primaryVideo.addEventListener("timeupdate", handlePrimaryTimeUpdate);
    primaryVideo.addEventListener("seeking", handlePrimarySeeking);
    primaryVideo.addEventListener("seeked", handlePrimarySeeked);

    return () => {
      primaryVideo.removeEventListener("play", handlePrimaryPlay);
      primaryVideo.removeEventListener("pause", handlePrimaryPause);
      primaryVideo.removeEventListener("timeupdate", handlePrimaryTimeUpdate);
      primaryVideo.removeEventListener("seeking", handlePrimarySeeking);
      primaryVideo.removeEventListener("seeked", handlePrimarySeeked);
    };
  }, [
    handlePrimaryPlay,
    handlePrimaryPause,
    handlePrimaryTimeUpdate,
    handlePrimarySeeking,
    handlePrimarySeeked,
  ]);

  useEffect(() => {
    if (primaryVideoRef.current && secondaryVideoRef.current) {
      syncVideos();
    }
  }, [videoOffsetMs, syncVideos]);

  console.log("--offset--", videoOffsetMs);

  return (
    <div className="flex flex-col gap-4 items-center">
      {/* 9:16 dual preview */}
      <div
        data-container-context="dual"
        ref={secondaryContainerRef}
        className="relative flex flex-col items-center aspect-[9/16] w-[260px] justify-center overflow-hidden rounded-lg bg-surhface-secondary shadow-md"
      >
        {/* Primary */}
        <div
          className={cn(
            "relative overflow-hidden h-1/2 w-full flex",
            displayMode === "split" && !secondaryClip && "items-center",
            displayMode === "split" && secondaryClip && "items-end"
            // displayMode === "stretch" && "scale-150"
          )}
        >
          <video
            ref={primaryVideoRef}
            src={primaryClip.url}
            poster={"/thumbnails/video-thumb-2.webp"}
            muted={false}
            playsInline
            preload="metadata"
            className={cn(
              "rounded-none",
              displayMode === "split" &&
                !secondaryClip &&
                "object-contain w-full h-full",
              displayMode === "split" && secondaryClip && "object-contain",
              displayMode === "stretch" && "object-cover w-full h-full"
            )}
          />
          {/* <Badge
            variant="secondary"
            className="absolute top-2 left-2 text-[10px] uppercase font-mono"
          >
            Primary
          </Badge> */}
        </div>

        {/* Secondary */}
        {secondaryClip && (
          <div
            className={cn(
              "relative overflow-hidden h-1/2 w-full flex",
              displayMode === "split" && "items-start"
              // displayMode === "stretch" && "scale-150"
            )}
          >
            <video
              ref={secondaryVideoRef}
              src={secondaryClip.url}
              poster={"/thumbnails/video-thumb-2.webp"}
              muted
              playsInline
              preload="metadata"
              className={cn(
                "rounded-none",
                displayMode === "split" && "object-contain",
                displayMode === "stretch" && "object-cover w-full h-full"
              )}
            />
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 text-[10px] uppercase font-mono"
            >
              Secondary
            </Badge>
          </div>
        )}

        {secondaryClip && (
          <div className="absolute top-1/2 left-0 right-0 h-px bg-red-600 transform -translate-y-px" />
        )}
      </div>

      <Button size="sm" variant="outline" onClick={toggleDisplayMode}>
        {displayMode === "split" ? (
          <span className="flex items-center gap-1">
            <Expand className="w-4 h-4" />
            Stretch
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <SquareStack className="w-4 h-4" />
            Stack
          </span>
        )}
      </Button>

      <PersistentOverlays duration={duration} isDualVideo />
    </div>
  );
};

export default DualVideoPlayer;
