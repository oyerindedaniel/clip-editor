"use client";

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
} from "react";
import {
  Expand,
  Maximize,
  SquareStack,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { S3ClipData, DualVideoClip } from "@/types/app";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";
import { ClipContext } from "@/contexts/clip-context";
import { PersistentOverlays } from "./persistent-overlays";
import logger from "@/utils/logger";
import { useLatestValue } from "@/hooks/use-latest-value";
import { Seek } from "./video-seek-bar";
import { Volume } from "./volume";
import { Playback } from "./video-controls";
import { msToSeconds } from "@/utils/video";

interface DualVideoPlayerProps {
  isPrimaryVideoLoaded: boolean;
  primaryClip: S3ClipData;
  duration: number;
  secondaryClip: DualVideoClip | null;
  className?: string;
  style?: React.CSSProperties;
}

type DisplayMode = "split" | "stretch" | "stretch-full";

const BUFFER_EDGE_TOLERANCE = 0.1;

const END_TOLERANCE = 0.05;

export const DualVideoPlayer = forwardRef<HTMLDivElement, DualVideoPlayerProps>(
  (
    {
      isPrimaryVideoLoaded,
      primaryClip,
      secondaryClip,
      duration,
      className,
      style,
    },
    forwardedRef
  ) => {
    const [isBuffering, setIsBuffering] = useState(false);
    const [hasPlayIntent, setHasPlayIntent] = useState(false);
    const hasPlayIntentRef = useLatestValue(hasPlayIntent);
    const [hasError, setHasError] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [primaryBuffered, setPrimaryBuffered] = useState<TimeRanges | null>(
      null
    );
    const [secondaryBuffered, setSecondaryBuffered] =
      useState<TimeRanges | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useLatestValue(isPlaying);

    const primaryVideoRef = useRef<HTMLVideoElement>(null);
    const secondaryVideoRef = useRef<HTMLVideoElement>(null);

    const isRepeatRef = useRef(false);

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

    const isSeekingRef = useRef(false);
    const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const isPrimaryBuffering = useRef(false);
    const isSecondaryBuffering = useRef(false);

    const setBufferingState = useCallback((shouldBuffer: boolean) => {
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
      }

      if (shouldBuffer) {
        setIsBuffering(true);
      } else {
        bufferingTimeoutRef.current = setTimeout(() => {
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
        const secondaryTime = msToSeconds(
          secondaryTrim.trimStart + secondaryElapsed
        );

        const secondaryEndTime = msToSeconds(secondaryTrim.trimEnd);
        if (secondaryTime > secondaryEndTime) {
          return secondaryEndTime;
        }

        const secondaryStartTime = msToSeconds(secondaryTrim.trimStart);
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
        const trimStart = msToSeconds(secondaryTrim.trimStart);
        const trimEnd = msToSeconds(secondaryTrim.trimEnd);

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

    const syncSecondaryPlayState = useCallback(() => {
      const secondaryTrim = secondaryTrimRef.current;
      if (!isPlayingRef.current || !secondaryTrim) return;

      const secondary = secondaryVideoRef.current;
      const primary = primaryVideoRef.current;
      if (!secondary || !primary) return;

      const expectedTime = calculateSecondaryTime(primary.currentTime);
      const trimEnd = msToSeconds(secondaryTrim.trimEnd);
      const trimStart = msToSeconds(secondaryTrim.trimStart);

      const shouldBePlaying = expectedTime !== null && expectedTime < trimEnd;

      if (shouldBePlaying && secondary.paused) {
        if (Math.abs(secondary.currentTime - expectedTime!) > 0.1) {
          secondary.currentTime = expectedTime!;
        }
        secondary.play().catch((err) => {
          logger.warn("Failed to play secondary during sync:", err);
        });
      } else if (!shouldBePlaying && !secondary.paused) {
        secondary.pause();
        if (expectedTime === null) {
          secondary.currentTime = trimStart;
        } else if (expectedTime >= trimEnd) {
          secondary.currentTime = trimEnd;
        }
      }
    }, [calculateSecondaryTime]);

    const play = useCallback(async () => {
      const primary = primaryVideoRef.current;
      if (!primary) return;

      if (isPlaying) return;

      setHasPlayIntent(true);

      const trimStart = msToSeconds(primaryTrim.trimStart);
      const trimEnd = msToSeconds(primaryTrim.trimEnd);

      // Reset primary if outside valid trim range
      if (primary.currentTime < trimStart || primary.currentTime >= trimEnd) {
        primary.currentTime = trimStart;
      }

      try {
        setIsBuffering(true);

        await primary.play();

        // Small delay to ensure proper audio mix priority
        await new Promise((resolve) => setTimeout(resolve, 10));

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
    }, [isPlaying, primaryTrim, secondaryTrim, alignSecondary]);

    const pause = useCallback(() => {
      const primary = primaryVideoRef.current;
      if (!primary) return;

      if (!isPlaying) return;

      setHasPlayIntent(false);
      primary.pause();

      if (secondaryTrim) {
        alignSecondary(primary.currentTime, false);
      }

      setIsPlaying(false);
      setIsBuffering(false);
    }, [isPlaying, secondaryTrim, alignSecondary]);

    const togglePlay = useCallback(
      async (forcePlay?: boolean) => {
        const primary = primaryVideoRef.current;
        if (!primary) return;

        const shouldPlay = forcePlay ?? !isPlaying;

        if (shouldPlay) {
          setHasPlayIntent(true);

          const trimStart = msToSeconds(primaryTrim.trimStart);
          const trimEnd = msToSeconds(primaryTrim.trimEnd);

          // Reset primary if outside valid trim range
          if (
            primary.currentTime < trimStart ||
            primary.currentTime >= trimEnd
          ) {
            primary.currentTime = trimStart;
          }

          try {
            // Play primary first and wait for it to actually start
            await primary.play();

            // Small delay to ensure primary has priority in audio mixing
            await new Promise((resolve) => setTimeout(resolve, 10));

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

    const handlePrimarySync = useCallback(() => {
      if (isSeekingRef.current || !isPlayingRef.current) return;

      const primary = primaryVideoRef.current;
      const secondary = secondaryVideoRef.current;
      const primaryTrim = primaryTrimRef.current;
      const secondaryTrim = secondaryTrimRef.current;

      if (!primary || !primaryTrim) return;

      const currentTime = primary.currentTime;
      const primaryStart = msToSeconds(primaryTrim.trimStart);
      const primaryEnd = msToSeconds(primaryTrim.trimEnd);

      let actualTimelineEnd = primaryEnd;
      let isPrimaryLonger = true;

      if (secondaryTrim && secondary) {
        const secondaryDuration = msToSeconds(
          secondaryTrim.trimEnd - secondaryTrim.trimStart
        );
        const secondaryOffset = msToSeconds(secondaryTrim.timelineOffset || 0);
        const secondaryEnd = secondaryOffset + secondaryDuration;
        const secondaryTimelineEnd = primaryStart + secondaryEnd;

        actualTimelineEnd = Math.max(primaryEnd, secondaryTimelineEnd);
        isPrimaryLonger = primaryEnd >= secondaryTimelineEnd;
      }

      // Handle live trimming
      if (
        (currentTime < primaryStart || currentTime >= actualTimelineEnd) &&
        !isRepeatRef.current
      ) {
        primary.pause();
        if (secondary && !secondary.paused) {
          secondary.pause();
        }
        primary.currentTime = primaryStart;
        setIsPlaying(false);
        setHasPlayIntent(false);
        if (secondaryTrim) {
          alignSecondary(primaryStart, false);
        }
        return;
      }

      // If primary ends but secondary continues
      if (!isPrimaryLonger && currentTime >= primaryEnd - END_TOLERANCE) {
        // Primary has finished, let secondary continue
        if (!primary.paused) {
          primary.pause();
        }
        // Don't set isPlaying to false - secondary is still playing
        return;
      }

      // Handle actual end of timeline
      if (currentTime >= actualTimelineEnd - END_TOLERANCE) {
        primary.pause();
        if (secondary && !secondary.paused) {
          secondary.pause();
        }
        setIsPlaying(false);
        setHasPlayIntent(false);

        if (isRepeatRef.current) {
          primary.currentTime = primaryStart;
          if (secondaryTrim) {
            alignSecondary(primaryStart, false);
          }

          setTimeout(() => {
            primary
              .play()
              .then(() => {
                setIsPlaying(true);
                setHasPlayIntent(true);
                if (secondaryTrim) {
                  alignSecondary(primaryStart, true);
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

    const handleSecondarySync = useCallback(() => {
      if (!isPlayingRef.current || !secondaryTrimRef.current) return;

      const primary = primaryVideoRef.current;
      const secondary = secondaryVideoRef.current;
      if (!primary || !secondary) return;

      const secondaryTrim = secondaryTrimRef.current;
      const primaryTrim = primaryTrimRef.current;

      const secondaryCurrentTime = secondary.currentTime;
      const secondaryEnd = msToSeconds(secondaryTrim.trimEnd);
      const primaryEnd = msToSeconds(primaryTrim?.trimEnd);

      // Check if secondary reached its end
      if (secondaryCurrentTime >= secondaryEnd - END_TOLERANCE) {
        // Check if primary is also done
        if (
          primary.currentTime >= (primaryEnd || 0) - END_TOLERANCE ||
          primary.paused
        ) {
          // Both videos finished
          secondary.pause();
          setIsPlaying(false);
          setHasPlayIntent(false);

          if (isRepeatRef.current) {
            const primaryStart = msToSeconds(primaryTrim?.trimStart) || 0;
            primary.currentTime = primaryStart;
            alignSecondary(primaryStart, false);

            setTimeout(() => {
              primary
                .play()
                .then(() => {
                  setIsPlaying(true);
                  setHasPlayIntent(true);
                  alignSecondary(primaryStart, true);
                })
                .catch((err) => {
                  logger.warn("Failed to restart:", err);
                  setIsPlaying(false);
                });
            }, 25);
          }
        }
      }
    }, [alignSecondary]);

    const handleSeek = useCallback(
      (normalizedTimeMs: number) => {
        const primary = primaryVideoRef.current;
        if (!primary) return;

        const primaryTimeMs = primaryTrim.trimStart + normalizedTimeMs;
        const primaryTimeSec = msToSeconds(primaryTimeMs);

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
        const expectedSecondaryTime = calculateSecondaryTime(
          primary.currentTime
        );

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
      if (primaryVideoRef.current && dualVideoSettings.primaryVolume != null) {
        primaryVideoRef.current.volume = dualVideoSettings.primaryVolume;
      }
    }, [dualVideoSettings.primaryVolume]);

    useEffect(() => {
      if (
        secondaryVideoRef.current &&
        dualVideoSettings.secondaryVolume != null
      ) {
        secondaryVideoRef.current.volume = dualVideoSettings.secondaryVolume;
      }
    }, [dualVideoSettings.secondaryVolume]);

    useEffect(() => {
      const primary = primaryVideoRef.current;
      if (!primary) return;

      // Reset to start when secondary changes
      const trimStart = msToSeconds(primaryTrim.trimStart);
      primary.currentTime = trimStart;

      if (secondaryTrim) {
        alignSecondary(trimStart, false);
      }

      setIsPlaying(false);
      setHasPlayIntent(false);
    }, [secondaryClip?.url, primaryTrim, secondaryTrim, alignSecondary]);

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
        setHasError(true);
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
        handlePrimarySync();
        updateBufferedRanges();
        syncSecondaryPlayState();
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
      handlePrimarySync,
      updateBufferedRanges,
      syncSecondaryPlayState,
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
        setHasError(true);
        setBufferingState(false);
      };
      const onSecondaryProgress = () => updateBufferedRanges();

      const onSecondaryTimeUpdate = () => {
        handleSecondarySync();
        updateBufferedRanges();
      };

      secondary.addEventListener("timeupdate", onSecondaryTimeUpdate);
      secondary.addEventListener("seeking", onSeekingSecondary);
      secondary.addEventListener("seeked", onSeekedSecondary);
      secondary.addEventListener("waiting", onSecondaryWaiting);
      secondary.addEventListener("canplay", onSecondaryCanPlay);
      secondary.addEventListener("canplaythrough", onSecondaryCanPlayThrough);
      secondary.addEventListener("stalled", onSecondaryStalled);
      secondary.addEventListener("error", onSecondaryError);
      secondary.addEventListener("progress", onSecondaryProgress);
      return () => {
        secondary.removeEventListener("timeupdate", onSecondaryTimeUpdate);
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
    }, [
      secondaryClip?.url,
      updateBufferedRanges,
      canBothVideosPlay,
      handleSecondarySync,
    ]);

    useEffect(() => {
      const isSecondaryTrim = secondaryClip && secondaryTrim;
      const isPrimaryTrim = isPrimaryVideoLoaded && primaryTrim;

      if (
        isPrimaryTrim &&
        primaryTrim.trimStart === 0 &&
        primaryTrim.trimEnd === 0
      ) {
        setValidationError("Invalid primary video trim data");
        return;
      }

      if (
        isSecondaryTrim &&
        secondaryTrim.trimStart === 0 &&
        secondaryTrim.trimEnd === 0
      ) {
        setValidationError("Invalid secondary video trim data");
        return;
      }

      setValidationError(null);
    }, [primaryTrim, secondaryTrim, isPrimaryVideoLoaded, secondaryClip]);

    return (
      <div
        ref={forwardedRef}
        className={cn("flex flex-col gap-4 items-center relative", className)}
        style={style}
      >
        <div
          ref={secondaryContainerRef}
          className="relative flex flex-col items-center aspect-[9/16] w-full justify-center overflow-hidden rounded-2xl bg-surface-secondary shadow-md group"
        >
          <div
            className={cn(
              "relative overflow-hidden w-full flex h-1/2",
              secondaryClip ? "items-end h-1/2" : "items-center h-1/2"
            )}
          >
            <video
              ref={primaryVideoRef}
              src={primaryClip.url}
              poster={"/thumbnails/video-thumb-2.webp"}
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                if (dualVideoSettings.primaryVolume != null) {
                  video.volume = dualVideoSettings.primaryVolume;
                }
              }}
              className={cn(
                "rounded-none",
                secondaryClip
                  ? "object-contain"
                  : "object-contain w-full h-full"
              )}
            />

            <div className="absolute bottom-2 left-2 z-20">
              <Volume.Root
                value={dualVideoSettings.primaryVolume}
                onValueChange={(v) =>
                  setDualVideoSettings({
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
                "relative overflow-hidden h-1/2 w-full flex items-start"
              )}
            >
              <video
                ref={secondaryVideoRef}
                src={secondaryClip.url}
                poster={"/thumbnails/video-thumb-2.webp"}
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  if (dualVideoSettings.secondaryVolume != null) {
                    video.volume = dualVideoSettings.secondaryVolume;
                  }
                }}
                className={cn("rounded-none object-contain")}
              />

              <div className="absolute top-2 left-2 z-20">
                <Volume.Root
                  value={dualVideoSettings.secondaryVolume}
                  onValueChange={(v) =>
                    setDualVideoSettings({
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
            <div className="absolute top-1/2 left-0 right-0 h-px bg-error transform -translate-y-px" />
          )}
          {isBuffering && (
            <div className="absolute top-1/2 -translate-y-1/2 z-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
          {(hasError || validationError) && (
            <div className="absolute inset-0 bg-black/80 text-white backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center text-foreground-default p-4 flex flex-col items-center gap-2 w-[85%]">
                <AlertTriangle className="size-8 text-error mb-px" />
                <div className="text-sm font-semibold tracking-tight">
                  {validationError || "Video failed to load"}
                </div>
              </div>
            </div>
          )}
          <Playback.Root
            playing={isPlaying}
            onPlayingChange={(shouldPlay) => {
              if (shouldPlay) {
                play();
              } else {
                pause();
              }
            }}
            isBuffering={isBuffering}
            hasError={hasError}
          >
            <Playback.Controls className="px-4">
              <Playback.PlayToggle />
              <Playback.LoopToggle
                defaultLoop={isRepeatRef.current}
                onLoopChangeAlways={(value) => {
                  isRepeatRef.current = value;
                }}
              />

              <Seek.Root
                primaryVideoRef={primaryVideoRef}
                primaryTrim={primaryTrim}
                secondaryTrim={secondaryClip ? secondaryTrim : null}
                primaryBuffered={primaryBuffered}
                secondaryBuffered={secondaryBuffered}
                isPlaying={isPlaying}
                onSeek={handleSeek}
              >
                <Seek.Content>
                  <Seek.TimeDisplay className="absolute top-1/2 -translate-y-1/2 right-4" />
                  <Seek.Track className="-translate-y-full absolute top-0 w-[85%] left-1/2 -translate-x-1/2">
                    <Seek.Buffer />
                    <Seek.Progress />
                    <Seek.Thumb />
                  </Seek.Track>
                  <Seek.Animator />
                </Seek.Content>
              </Seek.Root>
            </Playback.Controls>
          </Playback.Root>

          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent transition-opacity duration-200 ease-out opacity-0 group-hover:opacity-100"
            )}
          />
        </div>

        <PersistentOverlays duration={duration} isDualVideo />
      </div>
    );
  }
);

DualVideoPlayer.displayName = "DualVideoPlayer";

export default DualVideoPlayer;
