"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  Expand,
  Maximize,
  Pause,
  Play,
  SquareStack,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { S3ClipData, DualVideoClip } from "@/types/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";
import { ClipContext } from "@/contexts/clip-context";
import { PersistentOverlays } from "./persistent-overlays";
import logger from "@/utils/logger";
import { useLatestValue } from "@/hooks/use-latest-value";
import { VideoSeekBar } from "./video-seek-bar";

interface DualVideoPlayerProps {
  primaryClip: S3ClipData;
  duration: number;
  secondaryClip: DualVideoClip | null;
}

type DisplayMode = "split" | "stretch" | "stretch-full";

export const DualVideoPlayer: React.FC<DualVideoPlayerProps> = ({
  primaryClip,
  secondaryClip,
  duration,
}) => {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("split");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeekingPrimary, setIsSeekingPrimary] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);

  const { setDualVideoRef, secondaryContainerRef } = useShallowSelector(
    OverlaysContext,
    (state) => ({
      setDualVideoRef: state.setDualVideoRef,
      secondaryContainerRef: state.secondaryContainerRef,
    })
  );

  const { primaryTrim, secondaryTrim } = useShallowSelector(
    ClipContext,
    (state) => ({
      primaryTrim: state.primaryTrim,
      secondaryTrim: state.secondaryTrim,
    })
  );

  const secondaryTrimRef = useLatestValue(secondaryTrim);
  const primaryTrimRef = useLatestValue(primaryTrim);
  const isPlayingRef = useLatestValue(isPlaying);
  const isRepeatRef = useLatestValue(isRepeat);
  const isSeekingPrimaryRef = useLatestValue(isSeekingPrimary);

  useEffect(() => {
    setDualVideoRef(primaryVideoRef);
  }, [setDualVideoRef, primaryVideoRef]);

  const calculateSecondaryTime = useCallback(
    (primaryCurrentTime: number): number | null => {
      const secondaryTrim = secondaryTrimRef.current;
      if (!secondaryTrim) return null;

      const primaryTimelinePos =
        primaryCurrentTime * 1000 - (primaryTrimRef.current?.trimStart ?? 0);

      const secondaryTimelineOffset = secondaryTrim.timelineOffset || 0;
      if (primaryTimelinePos < secondaryTimelineOffset) {
        return null; // Secondary shouldn't play yet (black screen)
      }

      const secondaryElapsed = primaryTimelinePos - secondaryTimelineOffset;
      const secondaryTime = (secondaryTrim.trimStart + secondaryElapsed) / 1000;

      const secondaryEndTime = secondaryTrim.trimEnd / 1000;
      if (secondaryTime > secondaryEndTime) {
        return secondaryEndTime;
      }

      const secondaryStartTime = secondaryTrim.trimStart / 1000;
      return Math.max(secondaryTime, secondaryStartTime);
    },
    []
  );

  const alignSecondary = useCallback(
    (primaryCurrentTime: number, shouldPlay: boolean = false) => {
      const secondary = secondaryVideoRef.current;
      const secondaryTrim = secondaryTrimRef.current;
      if (!secondary || !secondaryTrim) return;

      const expectedTime = calculateSecondaryTime(primaryCurrentTime);
      const trimStart = secondaryTrim.trimStart / 1000;
      const trimEnd = secondaryTrim.trimEnd / 1000;

      // Secondary shouldn't play yet - pause and position at start
      if (expectedTime === null) {
        if (!secondary.paused) secondary.pause();
        if (
          secondary.currentTime < trimStart ||
          secondary.currentTime >= trimEnd
        ) {
          secondary.currentTime = trimStart;
        }
        return;
      }

      // Secondary has reached its end - pause and position at end
      if (expectedTime >= trimEnd) {
        if (!secondary.paused) secondary.pause();
        if (Math.abs(secondary.currentTime - trimEnd) > 0.1) {
          secondary.currentTime = trimEnd;
        }
        return;
      }

      secondary.currentTime = expectedTime;

      // Handle play/pause state
      if (shouldPlay && secondary.paused) {
        secondary
          .play()
          .catch((err) => logger.warn("Failed to play secondary:", err));
      } else if (!shouldPlay && !secondary.paused) {
        secondary.pause();
      }
    },
    [calculateSecondaryTime]
  );

  const togglePlay = useCallback(
    async (forcePlay?: boolean) => {
      const primary = primaryVideoRef.current;
      if (!primary) return;

      const shouldPlay = forcePlay ?? !isPlaying;

      if (shouldPlay) {
        const trimStart = primaryTrim.trimStart / 1000;
        const trimEnd = primaryTrim.trimEnd / 1000;

        // Reset primary if outside valid trim range
        if (primary.currentTime < trimStart || primary.currentTime >= trimEnd) {
          primary.currentTime = trimStart;
        }

        try {
          await primary.play();
          if (secondaryTrim) {
            alignSecondary(primary.currentTime, true);
          }
          setIsPlaying(true);
        } catch (err) {
          logger.warn("Failed to play primary:", err);
          setIsPlaying(false);
        }
      } else {
        primary.pause();
        if (secondaryTrim) {
          alignSecondary(primary.currentTime, false);
        }
        setIsPlaying(false);
      }
    },
    [isPlaying, primaryTrim, secondaryTrim, alignSecondary]
  );

  const handleSync = useCallback(() => {
    if (isSeekingPrimaryRef.current || !isPlayingRef.current) return;

    const primary = primaryVideoRef.current;
    const primaryTrim = primaryTrimRef.current;
    const secondaryTrim = secondaryTrimRef.current;

    if (!primary || !primaryTrim) return;

    const currentTime = primary.currentTime;
    const trimStart = primaryTrim.trimStart / 1000;
    const primaryEnd = primaryTrim.trimEnd / 1000;

    let actualTimelineEnd = primaryEnd;
    if (secondaryTrim) {
      const secondaryDuration =
        (secondaryTrim.trimEnd - secondaryTrim.trimStart) / 1000;
      const secondaryOffset = (secondaryTrim.timelineOffset || 0) / 1000;
      const secondaryEnd = secondaryOffset + secondaryDuration;
      actualTimelineEnd = Math.max(primaryEnd, trimStart + secondaryEnd);
    }

    // Handle live trimming - stop if current position is outside trim bounds
    if (
      (currentTime < trimStart || currentTime >= actualTimelineEnd) &&
      !isRepeatRef.current
    ) {
      primary.pause();
      primary.currentTime = trimStart;
      setIsPlaying(false);
      if (secondaryTrim) {
        alignSecondary(trimStart, false);
      }
      return;
    }

    // Handle end of video
    if (currentTime >= actualTimelineEnd) {
      primary.pause();
      // Repeat: reset to start and continue playing
      if (isRepeatRef.current) {
        primary.currentTime = trimStart;
        if (secondaryTrim) {
          alignSecondary(trimStart, false);
        }

        setTimeout(() => {
          primary
            .play()
            .then(() => {
              if (secondaryTrim) {
                alignSecondary(trimStart, true);
              }
            })
            .catch((err) => {
              logger.warn("Failed to restart:", err);
              setIsPlaying(false);
            });
        }, 25);
      }
    }
  }, [alignSecondary]);

  const handleSeek = useCallback(
    (normalizedTimeMs: number) => {
      const primary = primaryVideoRef.current;
      if (!primary) return;

      // Convert normalized timeline position back to primary video time
      const primaryTimeMs = primaryTrim.trimStart + normalizedTimeMs;
      const primaryTimeSec = primaryTimeMs / 1000;

      primary.currentTime = primaryTimeSec;

      if (secondaryTrim) {
        alignSecondary(primaryTimeSec, isPlaying);
      }
    },
    [primaryTrim, secondaryTrim, alignSecondary, isPlaying]
  );

  useEffect(() => {
    const primary = primaryVideoRef.current;
    if (!primary) return;

    const onSeeking = () => setIsSeekingPrimary(true);

    const onSeeked = () => {
      setIsSeekingPrimary(false);
      if (secondaryTrim) {
        alignSecondary(primary.currentTime, isPlaying);
      }
    };

    const onTimeUpdate = () => {
      handleSync();
    };

    primary.addEventListener("seeking", onSeeking);
    primary.addEventListener("seeked", onSeeked);
    primary.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      primary.removeEventListener("seeking", onSeeking);
      primary.removeEventListener("seeked", onSeeked);
      primary.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [primaryClip.url, secondaryClip?.url, alignSecondary, handleSync]);

  useEffect(() => {
    if (secondaryClip && displayMode === "stretch-full") {
      setDisplayMode("split");
    }
  }, [secondaryClip, displayMode]);

  const toggleDisplayMode = () => {
    setDisplayMode((prev) => {
      if (!secondaryClip) {
        if (prev === "split") return "stretch";
        if (prev === "stretch") return "stretch-full";
        return "split";
      }
      return prev === "split" ? "stretch" : "split";
    });
  };

  const getButtonContent = () => {
    if (!secondaryClip) {
      if (displayMode === "split") {
        return (
          <span className="flex items-center gap-1">
            <Expand className="w-4 h-4" />
            Stretch
          </span>
        );
      }
      if (displayMode === "stretch") {
        return (
          <span className="flex items-center gap-1">
            <Maximize className="w-4 h-4" />
            Full
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1">
          <SquareStack className="w-4 h-4" />
          Stack
        </span>
      );
    }

    return displayMode === "split" ? (
      <span className="flex items-center gap-1">
        <Expand className="w-4 h-4" />
        Stretch
      </span>
    ) : (
      <span className="flex items-center gap-1">
        <SquareStack className="w-4 h-4" />
        Stack
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4 items-center relative">
      <div
        data-container-context="dual"
        ref={secondaryContainerRef}
        className="relative flex flex-col items-center aspect-[9/16] w-[260px] justify-center overflow-hidden rounded-lg bg-surface-secondary shadow-md"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={cn(
            "relative overflow-hidden w-full flex h-1/2",
            displayMode === "split" && !secondaryClip && "items-center h-1/2",
            displayMode === "split" && secondaryClip && "items-end h-1/2",
            displayMode === "stretch-full" && !secondaryClip && "!h-full"
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
              displayMode === "stretch" && "object-cover w-full h-full",
              displayMode === "stretch-full" && "object-cover w-full h-full"
            )}
          />
        </div>

        {secondaryClip && (
          <div
            className={cn(
              "relative overflow-hidden h-1/2 w-full flex",
              displayMode === "split" && "items-start"
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

        <div
          data-hovered={isHovered}
          className={cn(
            "absolute bottom-0 left-0 right-0 transition-all duration-300 ease-out",
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-sm">
            <div className="px-4 py-3 space-y-3">
              <VideoSeekBar
                primaryVideoRef={primaryVideoRef}
                primaryTrim={primaryTrim}
                secondaryTrim={secondaryClip ? secondaryTrim : null}
                isPlaying={isPlaying}
                onSeek={handleSeek}
                className="w-full"
              />

              <div className="flex items-center justify-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => togglePlay()}
                      className="h-8 w-8 bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white transition-all duration-200 hover:scale-105 shadow-sm"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-surface-primary border-surface-tertiary text-foreground-default font-medium"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setIsRepeat((r) => !r)}
                      className={cn(
                        "h-8 w-8 border-white/30 text-white transition-all duration-200 hover:scale-105 shadow-sm",
                        isRepeat
                          ? "bg-primary/90 hover:bg-primary text-primary-foreground border-primary/50"
                          : "bg-white/10 hover:bg-white/20"
                      )}
                    >
                      <Repeat className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-surface-primary border-surface-tertiary text-foreground-default font-medium"
                  >
                    {isRepeat ? "Repeat On" : "Repeat Off"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent transition-opacity duration-200 ease-out",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      <div className="flex gap-2 items-center">
        <Button size="sm" variant="outline" onClick={toggleDisplayMode}>
          {getButtonContent()}
        </Button>
      </div>

      <PersistentOverlays duration={duration} isDualVideo />
    </div>
  );
};

export default DualVideoPlayer;
