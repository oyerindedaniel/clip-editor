"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  Expand,
  Maximize,
  Pause,
  Play,
  SquareStack,
  Repeat,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { S3ClipData, DualVideoClip } from "@/types/app";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";
import { ClipContext } from "@/contexts/clip-context";
import { PersistentOverlays } from "./persistent-overlays";
import logger from "@/utils/logger";
import { useLatestValue } from "@/hooks/use-latest-value";
import { VideoSeekBar } from "./video-seek-bar";
import { Volume } from "./volume";

interface DualVideoPlayerProps {
  primaryClip: S3ClipData;
  duration: number;
  secondaryClip: DualVideoClip | null;
}

type DisplayMode = "split" | "stretch" | "stretch-full";

const BUFFER_EDGE_TOLERANCE = 0.1;

export const DualVideoPlayer: React.FC<DualVideoPlayerProps> = ({
  primaryClip,
  secondaryClip,
  duration,
}) => {
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasPlayIntent, setHasPlayIntent] = useState(false);
  const hasPlayIntentRef = useLatestValue(hasPlayIntent);
  const [primaryError, setPrimaryError] = useState<string | null>(null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const [primaryBuffered, setPrimaryBuffered] = useState<TimeRanges | null>(
    null
  );
  const [secondaryBuffered, setSecondaryBuffered] = useState<TimeRanges | null>(
    null
  );

  const [displayMode, setDisplayMode] = useState<DisplayMode>("split");
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useLatestValue(isPlaying);
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

  const {
    primaryTrim,
    secondaryTrim,
    dualVideoSettings,
    setDualVideoSettings,
  } = useShallowSelector(ClipContext, (state) => ({
    primaryTrim: state.primaryTrim,
    secondaryTrim: state.secondaryTrim,
    dualVideoSettings: state.dualVideoSettings,
    setDualVideoSettings: state.setDualVideoSettings,
  }));

  const secondaryTrimRef = useLatestValue(secondaryTrim);
  const primaryTrimRef = useLatestValue(primaryTrim);
  const isRepeatRef = useLatestValue(isRepeat);
  const isSeekingRef = useRef(false);
  const bufferingTimeoutRef = useRef<number>(0);
  const isPrimaryBuffering = useRef(false);
  const isSecondaryBuffering = useRef(false);

  const setBufferingState = useCallback((shouldBuffer: boolean) => {
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
    }

    if (shouldBuffer) {
      setIsBuffering(true);
    } else {
      bufferingTimeoutRef.current = window.setTimeout(() => {
        setIsBuffering(false);
      }, 200);
    }
  }, []);

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
        secondary.play().catch((err) => {
          logger.warn("Failed to play secondary:", err);
        });
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
        setHasPlayIntent(true);

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
          setIsBuffering(false);
        } catch (err) {
          logger.warn("Failed to play primary:", err);

          setIsPlaying(false);
          setIsBuffering(false);
        }
      } else {
        setHasPlayIntent(false);
        primary.pause();
        if (secondaryTrim) {
          alignSecondary(primary.currentTime, false);
        }

        setIsPlaying(false);
        setIsBuffering(false);
      }
    },
    [isPlaying, primaryTrim, secondaryTrim, alignSecondary]
  );

  const handleSync = useCallback(() => {
    if (isSeekingRef.current || !isPlayingRef.current) return;

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
      setHasPlayIntent(false);
      if (secondaryTrim) {
        alignSecondary(trimStart, false);
      }
      return;
    }

    // Handle end of video
    if (currentTime >= actualTimelineEnd) {
      primary.pause();
      setHasPlayIntent(false);
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

      const primaryTimeMs = primaryTrim.trimStart + normalizedTimeMs;
      const primaryTimeSec = primaryTimeMs / 1000;

      primary.currentTime = primaryTimeSec;

      if (secondaryTrim) {
        alignSecondary(primaryTimeSec, isPlaying);
      }
    },
    [primaryTrim, secondaryTrim, alignSecondary, isPlaying]
  );

  const updateBufferedRanges = useCallback(() => {
    const primary = primaryVideoRef.current;
    const secondary = secondaryVideoRef.current;

    if (primary && primary.buffered) {
      setPrimaryBuffered(primary.buffered);
    }
    if (secondary && secondary.buffered) {
      setSecondaryBuffered(secondary.buffered);
    }
  }, []);

  const isTimeInBufferedRange = useCallback(
    (video: HTMLVideoElement, timeSec: number): boolean => {
      if (!video?.buffered || video.buffered.length === 0) {
        return false;
      }

      for (let i = 0; i < video.buffered.length; i++) {
        const start = video.buffered.start(i);
        const end = video.buffered.end(i);

        if (timeSec >= start && timeSec <= end - BUFFER_EDGE_TOLERANCE) {
          return true;
        }
      }

      return false;
    },
    []
  );

  const canBothVideosPlay = useCallback((): boolean => {
    const primary = primaryVideoRef.current;
    if (!primary) return false;

    const isPrimaryBuffered = isTimeInBufferedRange(
      primary,
      primary.currentTime
    );

    // During seeking: only check if content is buffered (ignore readyState)
    if (isSeekingRef.current) {
      if (!isPrimaryBuffered) return false;

      const secondary = secondaryVideoRef.current;
      if (secondary && secondaryTrimRef.current) {
        const expectedSecondaryTime = calculateSecondaryTime(
          primary.currentTime
        );

        if (expectedSecondaryTime !== null) {
          const isSecondaryBuffered = isTimeInBufferedRange(
            secondary,
            expectedSecondaryTime
          );
          if (!isSecondaryBuffered) return false;
        }
      }

      return true;
    }

    // Normal playback: check both buffered AND readyState
    if (!isPrimaryBuffered || primary.readyState < 3) return false;

    const secondary = secondaryVideoRef.current;
    if (secondary && secondaryTrimRef.current) {
      const expectedSecondaryTime = calculateSecondaryTime(primary.currentTime);

      if (expectedSecondaryTime !== null) {
        const isSecondaryBuffered = isTimeInBufferedRange(
          secondary,
          expectedSecondaryTime
        );
        if (!isSecondaryBuffered || secondary.readyState < 3) return false;
      }
    }

    return true;
  }, [calculateSecondaryTime, isTimeInBufferedRange]);

  useEffect(() => {
    setDualVideoRef(primaryVideoRef);
  }, [setDualVideoRef, primaryVideoRef]);

  useEffect(() => {
    if (primaryVideoRef.current && dualVideoSettings?.primaryVolume != null) {
      primaryVideoRef.current.volume = dualVideoSettings.primaryVolume;
    }
  }, [dualVideoSettings?.primaryVolume]);

  useEffect(() => {
    if (
      secondaryVideoRef.current &&
      dualVideoSettings?.secondaryVolume != null
    ) {
      secondaryVideoRef.current.volume = dualVideoSettings.secondaryVolume;
    }
  }, [dualVideoSettings?.secondaryVolume]);

  useEffect(() => {
    const primary = primaryVideoRef.current;
    if (!primary) return;

    const onPrimaryWaiting = () => {
      if (isSeekingRef.current && canBothVideosPlay()) return;
      if (!hasPlayIntentRef.current) return;

      isPrimaryBuffering.current = true;
      setBufferingState(true);
    };

    const onPrimaryCanPlay = () => {
      isPrimaryBuffering.current = false;

      const secondary = secondaryVideoRef.current;
      if (!secondary || !isSecondaryBuffering.current) {
        setBufferingState(false);
      }
    };

    const onPrimaryCanPlayThrough = () => {
      isPrimaryBuffering.current = false;
      setBufferingState(false);
    };

    const onPrimaryStalled = () => {
      if (isSeekingRef.current && canBothVideosPlay()) return;
      if (!hasPlayIntentRef.current && !isPlayingRef.current) return;

      isPrimaryBuffering.current = true;
      setBufferingState(true);
    };
    const onPrimaryError = () => {
      setPrimaryError("Failed to load primary video");
      setBufferingState(false);
    };
    const onPrimaryProgress = () => updateBufferedRanges();

    const onSeeking = () => {
      isSeekingRef.current = true;
    };
    const onSeeked = () => {
      isSeekingRef.current = false;
      if (secondaryTrim) {
        alignSecondary(primary.currentTime, isPlaying);
      }
    };

    const onTimeUpdate = () => {
      handleSync();
      updateBufferedRanges();
    };

    primary.addEventListener("waiting", onPrimaryWaiting);
    primary.addEventListener("canplay", onPrimaryCanPlay);
    primary.addEventListener("canplaythrough", onPrimaryCanPlayThrough);
    primary.addEventListener("stalled", onPrimaryStalled);
    primary.addEventListener("error", onPrimaryError);
    primary.addEventListener("progress", onPrimaryProgress);
    primary.addEventListener("seeking", onSeeking);
    primary.addEventListener("seeked", onSeeked);
    primary.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      primary.removeEventListener("waiting", onPrimaryWaiting);
      primary.removeEventListener("canplay", onPrimaryCanPlay);
      primary.removeEventListener("canplaythrough", onPrimaryCanPlayThrough);
      primary.removeEventListener("stalled", onPrimaryStalled);
      primary.removeEventListener("error", onPrimaryError);
      primary.removeEventListener("progress", onPrimaryProgress);
      primary.removeEventListener("seeking", onSeeking);
      primary.removeEventListener("seeked", onSeeked);
      primary.removeEventListener("timeupdate", onTimeUpdate);

      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
      }
    };
  }, [
    primaryClip.url,
    alignSecondary,
    handleSync,
    updateBufferedRanges,
    canBothVideosPlay,
  ]);

  useEffect(() => {
    const secondary = secondaryVideoRef.current;
    if (!secondary) return;

    const onSeekingSecondary = () => {
      logger.log("Secondary seeking (ignored, primary drives state)");
    };

    const onSeekedSecondary = () => {
      logger.log("Secondary seeked (ignored, primary drives state)");
    };

    const onSecondaryWaiting = () => {
      if (isSeekingRef.current && canBothVideosPlay()) return;
      if (!hasPlayIntentRef.current) return;
      isSecondaryBuffering.current = true;
      setBufferingState(true);
    };

    const onSecondaryCanPlay = () => {
      isSecondaryBuffering.current = false;
      if (!isPrimaryBuffering.current) {
        setBufferingState(false);
      }
    };

    const onSecondaryCanPlayThrough = () => {
      isSecondaryBuffering.current = false;
      setBufferingState(false);
    };

    const onSecondaryStalled = () => {
      if (isSeekingRef.current && canBothVideosPlay()) return;
      if (!hasPlayIntentRef.current && !isPlayingRef.current) return;
      isSecondaryBuffering.current = true;
      setBufferingState(true);
    };

    const onSecondaryError = () => {
      setSecondaryError("Failed to load secondary video");
      setBufferingState(false);
    };
    const onSecondaryProgress = () => updateBufferedRanges();

    secondary.addEventListener("seeking", onSeekingSecondary);
    secondary.addEventListener("seeked", onSeekedSecondary);
    secondary.addEventListener("waiting", onSecondaryWaiting);
    secondary.addEventListener("canplay", onSecondaryCanPlay);
    secondary.addEventListener("canplaythrough", onSecondaryCanPlayThrough);
    secondary.addEventListener("stalled", onSecondaryStalled);
    secondary.addEventListener("error", onSecondaryError);
    secondary.addEventListener("progress", onSecondaryProgress);
    return () => {
      secondary.removeEventListener("seeking", onSeekingSecondary);
      secondary.removeEventListener("seeked", onSeekedSecondary);
      secondary.removeEventListener("waiting", onSecondaryWaiting);
      secondary.removeEventListener("canplay", onSecondaryCanPlay);
      secondary.removeEventListener(
        "canplaythrough",
        onSecondaryCanPlayThrough
      );
      secondary.removeEventListener("stalled", onSecondaryStalled);
      secondary.removeEventListener("error", onSecondaryError);
      secondary.removeEventListener("progress", onSecondaryProgress);
    };
  }, [secondaryClip?.url, updateBufferedRanges, canBothVideosPlay]);

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

          <div className="absolute bottom-2 left-2 z-10">
            <Volume.Root
              value={dualVideoSettings.primaryVolume}
              onValueChange={(v) =>
                setDualVideoSettings?.({
                  ...dualVideoSettings,
                  primaryVolume: v,
                })
              }
            >
              <Volume.Controls variant="pill">
                <Volume.Button aria-label="Primary volume" />
                <Volume.Slider>
                  <Volume.Slider.Track>
                    <Volume.Slider.Range />
                    <Volume.Slider.Thumb />
                  </Volume.Slider.Track>
                </Volume.Slider>
              </Volume.Controls>
            </Volume.Root>
          </div>
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
            {/* <Badge
              variant="secondary"
              className="absolute top-2 left-2 text-[10px] uppercase font-mono"
            >
              Secondary
            </Badge> */}

            <div className="absolute top-2 left-2 z-10">
              <Volume.Root
                value={dualVideoSettings.secondaryVolume}
                onValueChange={(v) =>
                  setDualVideoSettings?.({
                    ...dualVideoSettings,
                    secondaryVolume: v,
                  })
                }
              >
                <Volume.Controls variant="pill">
                  <Volume.Button aria-label="Secondary volume" />
                  <Volume.Slider>
                    <Volume.Slider.Track>
                      <Volume.Slider.Range />
                      <Volume.Slider.Thumb />
                    </Volume.Slider.Track>
                  </Volume.Slider>
                </Volume.Controls>
              </Volume.Root>
            </div>
          </div>
        )}

        {secondaryClip && (
          <div className="absolute top-1/2 left-0 right-0 h-px bg-red-600 transform -translate-y-px" />
        )}

        {isBuffering && (
          <div className="absolute top-1/2 -translate-y-1/2 z-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        )}

        {(primaryError || secondaryError) && (
          <div className="absolute inset-0 bg-error/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center text-foreground-default p-4 flex flex-col items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              <div className="text-sm">{primaryError || secondaryError}</div>
            </div>
          </div>
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
                primaryBuffered={primaryBuffered}
                secondaryBuffered={secondaryBuffered}
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
                          ? "bg-primary/90 hover:bg-primary text-foreground-on-accent border-primary/50"
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
