import React, { forwardRef, useRef, useMemo, useEffect } from "react";
import { useDualVideoSync } from "@/hooks/app/use-dual-video-sync";
import {
  filterKeyframesByTarget,
  getKeyframeBoundsForTarget,
  type KeyframeData,
} from "@/utils/keyframe";
import CanvasVideoRenderer from "./canvas-video-renderer";
import type { Color } from "./color-palette";
import { VideoPreview, type Video } from "./video-preview";
import type { CropMode, TrimData } from "@/types/app";
import { calculateHeight, type AspectRatio } from "@/utils/aspect-ratios";
import type { PlayingStatus } from "@/hooks/app/use-video-controls-core";
import { cn } from "@/lib/utils";
import { Volume } from "./volume";
import { Playback } from "./video-controls";
import { Seek } from "./video-seek-bar";
import type { KeyframeBounds } from "@/utils/keyframe";
import PiPOverlay from "./pip-overlay";
import { useShallowSelector } from "react-shallow-store";
import { ClipContext } from "@/contexts/clip-context";
import { KeyframeContext } from "@/contexts/keyframe-context";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { composeRefs } from "@/lib/compose-refs";
import { getElementRef } from "@/lib/get-element-ref";
import { DualClockProvider } from "@/contexts/dual-clock-context";
import {
  createBoundTrimData,
  createDualBoundTrimData,
} from "@/utils/keyframe-bounds";

interface BaseDualVideoProps {
  keyframes: KeyframeData[];
  canvasWidth: number;
  canvasHeight: number;
  padColor?: Color;
  className?: string;
  style?: React.CSSProperties;
  playing?: boolean;
  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
  boundaryAspectRatio: AspectRatio | null;
  defaultRepeat?: boolean;
}

interface DualVideoPreviewEditorProps extends BaseDualVideoProps {
  primaryVideoUrl: string;
  secondaryVideoUrl?: string;
  cropMode: CropMode;
  active: "dual" | "renderer";
  playerType: "primary" | "secondary";
}

const DualVideoPreviewEditor = forwardRef<
  HTMLDivElement,
  DualVideoPreviewEditorProps
>((props, forwardedRef) => {
  const {
    primaryVideoUrl,
    secondaryVideoUrl,
    keyframes,
    baseAspect,
    targetAspect,
    cropMode,
    canvasWidth,
    canvasHeight,
    padColor,
    boundaryAspectRatio,
    className,
    style,
    playing = false,
    active,
    playerType,
    defaultRepeat,
  } = props;

  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  const { dualVideoSettings, primaryTrim, secondaryTrim } = useShallowSelector(
    ClipContext,
    (state) => ({
      dualVideoSettings: state.dualVideoSettings,
      primaryTrim: state.primaryTrim,
      secondaryTrim: state.secondaryTrim,
    })
  );
  const {
    setPrimaryBoundaryAspectOverride,
    setSecondaryBoundaryAspectOverride,
  } = useShallowSelector(KeyframeContext, (state) => ({
    setPrimaryBoundaryAspectOverride: state.setPrimaryBoundaryAspectOverride,
    setSecondaryBoundaryAspectOverride:
      state.setSecondaryBoundaryAspectOverride,
  }));

  const hasInitialized = useRef(false);

  const primaryPercentage = dualVideoSettings.primaryPanelPercentage || 50;
  const secondaryPercentage = 100 - primaryPercentage;

  useEffect(() => {
    if (canvasHeight > 0 && canvasWidth > 0 && !hasInitialized.current) {
      const primaryHeight = Math.round(
        (canvasHeight * primaryPercentage) / 100
      );
      const secondaryHeight = Math.round(
        (canvasHeight * secondaryPercentage) / 100
      );

      setPrimaryBoundaryAspectOverride?.(`${canvasWidth}:${primaryHeight}`);
      setSecondaryBoundaryAspectOverride?.(`${canvasWidth}:${secondaryHeight}`);

      hasInitialized.current = true;
    }
  }, [canvasHeight, canvasWidth, primaryPercentage, secondaryPercentage]);

  const hasSecondaryClip = Boolean(secondaryVideoUrl && secondaryTrim);

  const hasSecondaryKeyframes = keyframes.some(
    (kf) => kf.target === "secondary"
  );

  const useDualMode = hasSecondaryClip && hasSecondaryKeyframes;

  const primaryKeyframeBounds = useMemo(
    () => getKeyframeBoundsForTarget(keyframes, "primary"),
    [keyframes]
  );
  const secondaryKeyframeBounds = useMemo(
    () => getKeyframeBoundsForTarget(keyframes, "secondary"),
    [keyframes]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundVideoRef =
    dualVideoSettings.backgroundVideo === "primary"
      ? primaryVideoRef
      : secondaryVideoRef;

  const primaryBoundTrimData = useMemo(
    () => createBoundTrimData(primaryKeyframeBounds, primaryTrim),
    [primaryKeyframeBounds, primaryTrim]
  );

  const pipSync = useDualVideoSync({
    primaryVideoRef,
    secondaryVideoRef,
    primaryTrim: primaryBoundTrimData,
    secondaryTrim: secondaryTrim,
    enabled: true,
  });

  if (active !== "renderer") return null;

  if (useDualMode && secondaryVideoUrl && secondaryTrim) {
    return (
      <DualVideoPreview
        ref={forwardedRef}
        primarySource={<video ref={primaryVideoRef} src={primaryVideoUrl} />}
        secondarySource={
          <video ref={secondaryVideoRef} src={secondaryVideoUrl} />
        }
        primaryTrimData={primaryTrim}
        secondaryTrimData={secondaryTrim}
        primaryKeyframeBounds={primaryKeyframeBounds}
        secondaryKeyframeBounds={secondaryKeyframeBounds}
        baseAspect={baseAspect}
        targetAspect={targetAspect}
        variant={cropMode}
        keyframes={keyframes}
        playing={playing}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        boundaryAspectRatio={boundaryAspectRatio}
        padColor={padColor}
        className={className}
        style={style}
      />
    );
  }

  return (
    <DualClockProvider
      primaryVideoRef={primaryVideoRef}
      secondaryVideoRef={secondaryVideoRef}
    >
      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden bg-surface-secondary shadow-md w-full aspect-[9/16]",
          className
        )}
        style={{
          ...style,
        }}
      >
        <VideoPreview
          ref={forwardedRef}
          playing={playing}
          source={<video ref={primaryVideoRef} src={primaryVideoUrl} />}
          baseAspect={baseAspect}
          targetAspect={targetAspect}
          variant={cropMode}
          keyframes={filterKeyframesByTarget(keyframes, "primary")}
          keyframeBounds={primaryKeyframeBounds}
          trimData={primaryTrim}
          externalControls={dualVideoSettings.layout === "pip"}
        >
          {({ transform, variant, videoRef }) => (
            <CanvasVideoRenderer
              renderEnabled={playing}
              videoRef={videoRef}
              transformData={transform}
              variant={variant}
              width={canvasWidth}
              height={calculateHeight({
                aspectRatio: boundaryAspectRatio ?? "9:16",
                width: canvasWidth,
              })}
              color={padColor}
              className={cn({
                "absolute top-1/2 -translate-y-1/2": targetAspect !== "9:16",
              })}
              backgroundMode={dualVideoSettings.backgroundMode}
              backgroundVideo={dualVideoSettings.backgroundVideo}
              backgroundVideoRef={backgroundVideoRef}
              backgroundAlign={dualVideoSettings.backgroundAlign}
              backgroundOpacity={dualVideoSettings.backgroundOpacity}
              backgroundBlur={dualVideoSettings.backgroundBlur}
            />
          )}
        </VideoPreview>

        {dualVideoSettings.layout === "pip" && secondaryVideoUrl && (
          <PiPOverlay playerType={playerType} containerRef={containerRef}>
            <video ref={secondaryVideoRef} src={secondaryVideoUrl} />
          </PiPOverlay>
        )}

        {dualVideoSettings.layout === "pip" && (
          <Playback.Root
            defaultPlaying={pipSync.status === "playing"}
            onPlayingChangeAlways={(shouldPlay) => {
              if (shouldPlay) {
                pipSync.controls.play();
              } else {
                pipSync.controls.pause();
              }
            }}
            playingStatus={pipSync.status}
            isBuffering={pipSync.isBuffering}
            hasError={pipSync.hasError}
            isDual
          >
            <Playback.Controls className="flex items-center justify-between px-4 w-full">
              <div className="flex items-center gap-3">
                <Playback.PlayToggle />
                <Playback.LoopToggle
                  defaultLoop={defaultRepeat}
                  onLoopChangeAlways={(value) => {
                    pipSync.controls.setRepeat(value);
                  }}
                />
              </div>
              <Playback.RateControl
                defaultRate={1}
                onRateChangeAlways={pipSync.controls.setPlayback}
              />
            </Playback.Controls>

            <Seek.Root
              primaryVideoRef={primaryVideoRef}
              secondaryVideoRef={secondaryVideoRef}
              primaryTrim={primaryBoundTrimData}
              secondaryTrim={secondaryTrim}
              isPlaying={pipSync.status === "playing"}
              onSeek={(timeMs) => {
                pipSync.controls.seek(timeMs);
              }}
              primaryBuffered={pipSync.primaryBuffered}
              secondaryBuffered={pipSync.secondaryBuffered}
            >
              <Seek.Content>
                <Seek.TimeDisplay className="absolute top-4 translate-y right-4" />
                {/* TODO: 58px height of Playback.Controls */}
                <Seek.Track className="absolute w-[85%] bottom-[58px] translate-y-1/2 left-1/2 -translate-x-1/2">
                  <Seek.Buffer />
                  <Seek.Progress />
                  <Seek.Thumb />
                </Seek.Track>
                <Seek.Animator />
              </Seek.Content>
            </Seek.Root>
          </Playback.Root>
        )}
      </div>
    </DualClockProvider>
  );
});

DualVideoPreviewEditor.displayName = "DualVideoPreviewEditor";

interface DualVideoPreviewProps extends BaseDualVideoProps {
  primarySource: Video;
  secondarySource: Video;

  primaryTrimData: TrimData;
  secondaryTrimData: TrimData;

  primaryKeyframeBounds: KeyframeBounds;
  secondaryKeyframeBounds: KeyframeBounds;

  onTimeChange?: (timelineMs: number) => void;
  onPlayingChange?: (status: PlayingStatus) => void;

  variant: CropMode;
}

export const DualVideoPreview = forwardRef<
  HTMLDivElement,
  DualVideoPreviewProps
>((props, forwardedRef) => {
  const {
    primarySource,
    secondarySource,
    primaryTrimData,
    secondaryTrimData,
    primaryKeyframeBounds,
    secondaryKeyframeBounds,
    baseAspect,
    targetAspect,
    variant,
    keyframes,
    playing = false,
    onTimeChange,
    onPlayingChange,
    defaultRepeat = false,
    canvasWidth,
    canvasHeight,
    boundaryAspectRatio,
    padColor,
    className,
    style,
  } = props;

  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  const primaryKeyframes = useMemo(
    () => filterKeyframesByTarget(keyframes, "primary"),
    [keyframes]
  );

  const secondaryKeyframes = useMemo(
    () => filterKeyframesByTarget(keyframes, "secondary"),
    [keyframes]
  );

  const { dualVideoSettings, setDualVideoSettings } = useShallowSelector(
    ClipContext,
    (state) => ({
      dualVideoSettings: state.dualVideoSettings,
      setDualVideoSettings: state.setDualVideoSettings,
    })
  );
  const {
    setPrimaryBoundaryAspectOverride,
    setSecondaryBoundaryAspectOverride,
  } = useShallowSelector(KeyframeContext, (state) => ({
    setPrimaryBoundaryAspectOverride: state.setPrimaryBoundaryAspectOverride,
    setSecondaryBoundaryAspectOverride:
      state.setSecondaryBoundaryAspectOverride,
  }));

  const { primaryBoundTrimData, secondaryBoundTrimData } = useMemo(
    () =>
      createDualBoundTrimData(
        primaryKeyframeBounds,
        primaryTrimData,
        secondaryKeyframeBounds,
        secondaryTrimData
      ),
    [
      primaryKeyframeBounds,
      primaryTrimData,
      secondaryKeyframeBounds,
      secondaryTrimData,
    ]
  );

  const sync = useDualVideoSync({
    primaryVideoRef,
    secondaryVideoRef,
    primaryTrim: primaryBoundTrimData,
    secondaryTrim: secondaryBoundTrimData,
    defaultRepeat,
    enabled: true,
  });

  const primaryPercentage = dualVideoSettings.primaryPanelPercentage || 50;
  const secondaryPercentage = 100 - primaryPercentage;

  const handlePanelResize = (sizes: number[]) => {
    if (sizes.length >= 2) {
      setDualVideoSettings((prev) => ({
        ...prev,
        primaryPanelPercentage: Math.round(sizes[0]),
      }));

      const primaryHeight = Math.round((canvasHeight * sizes[0]) / 100);
      const secondaryHeight = Math.round((canvasHeight * sizes[1]) / 100);

      setPrimaryBoundaryAspectOverride?.(`${canvasWidth}:${primaryHeight}`);
      setSecondaryBoundaryAspectOverride?.(`${canvasWidth}:${secondaryHeight}`);
    }
  };

  return (
    <div
      ref={forwardedRef}
      className={cn(
        "relative overflow-hidden shadow-md w-full h-full bg-surface-secondary",
        className
      )}
      style={{
        ...style,
      }}
    >
      <ResizablePanelGroup
        direction="vertical"
        onLayout={handlePanelResize}
        className="h-full"
      >
        <ResizablePanel
          defaultSize={primaryPercentage}
          minSize={20}
          maxSize={80}
          className="relative"
        >
          <VideoPreview
            source={React.cloneElement(primarySource, {
              ref: composeRefs(primaryVideoRef, getElementRef(primarySource)),
            })}
            baseAspect={baseAspect}
            targetAspect={targetAspect}
            variant={variant}
            keyframes={primaryKeyframes}
            keyframeBounds={primaryKeyframeBounds}
            trimData={primaryTrimData}
            playing
            externalControls
          >
            {({ transform, videoRef }) => (
              <CanvasVideoRenderer
                renderEnabled
                videoRef={videoRef}
                transformData={transform}
                variant={variant}
                width={canvasWidth}
                height={canvasHeight * (primaryPercentage / 100)}
                color={padColor}
              />
            )}
          </VideoPreview>

          <div className="absolute bottom-2 left-2 z-20">
            <Volume.Root
              defaultValue={(() => {
                const video = primaryVideoRef?.current;
                const volume = dualVideoSettings.primaryVolume;

                if (video && video.volume !== volume) {
                  video.volume = Math.max(0, Math.min(volume, 1));
                }
                return volume;
              })()}
              value={dualVideoSettings.primaryVolume}
              onValueChange={(volume) => {
                sync.controls.setPrimaryVolume(volume);
                setDualVideoSettings({
                  ...dualVideoSettings,
                  primaryVolume: volume,
                });
              }}
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
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel
          defaultSize={secondaryPercentage}
          minSize={20}
          maxSize={80}
          className="relative"
        >
          <VideoPreview
            source={React.cloneElement(secondarySource, {
              ref: composeRefs(
                secondaryVideoRef,
                getElementRef(secondarySource)
              ),
            })}
            baseAspect={baseAspect}
            targetAspect={targetAspect}
            variant={variant}
            keyframes={secondaryKeyframes}
            keyframeBounds={secondaryKeyframeBounds}
            trimData={secondaryTrimData}
            playing
            externalControls
          >
            {({ transform, videoRef }) => (
              <CanvasVideoRenderer
                renderEnabled
                videoRef={videoRef}
                transformData={transform}
                variant={variant}
                width={canvasWidth}
                height={canvasHeight * (secondaryPercentage / 100)}
                color={padColor}
              />
            )}
          </VideoPreview>
          <div className="absolute top-2 left-2 z-20">
            <Volume.Root
              defaultValue={(() => {
                const video = secondaryVideoRef?.current;
                const volume = dualVideoSettings.secondaryVolume;

                if (video && video.volume !== volume) {
                  video.volume = Math.max(0, Math.min(volume, 1));
                }
                return volume;
              })()}
              value={dualVideoSettings.secondaryVolume}
              onValueChange={(volume) => {
                sync.controls.setSecondaryVolume(volume);
                setDualVideoSettings({
                  ...dualVideoSettings,
                  secondaryVolume: volume,
                });
              }}
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
        </ResizablePanel>
      </ResizablePanelGroup>

      <Playback.Root
        defaultPlaying={sync.status === "playing"}
        onPlayingChangeAlways={(shouldPlay) => {
          if (shouldPlay) {
            sync.controls.play();
          } else {
            sync.controls.pause();
          }
        }}
        playingStatus={sync.status}
        isBuffering={sync.isBuffering}
        hasError={sync.hasError}
        isDual
      >
        <Playback.Controls className="flex items-center justify-between px-4 w-full">
          <div className="flex items-center gap-3">
            <Playback.PlayToggle />
            <Playback.LoopToggle
              defaultLoop={defaultRepeat}
              onLoopChangeAlways={(value) => {
                sync.controls.setRepeat(value);
              }}
            />
          </div>
          <Playback.RateControl
            defaultRate={1}
            onRateChangeAlways={sync.controls.setPlayback}
          />
        </Playback.Controls>

        <Seek.Root
          primaryVideoRef={primaryVideoRef}
          secondaryVideoRef={secondaryVideoRef}
          primaryTrim={primaryBoundTrimData}
          secondaryTrim={secondaryBoundTrimData}
          isPlaying={sync.status === "playing"}
          onSeek={(timeMs) => {
            sync.controls.seek(timeMs);
          }}
          primaryBuffered={sync.primaryBuffered}
          secondaryBuffered={sync.secondaryBuffered}
        >
          <Seek.Content>
            <Seek.TimeDisplay className="absolute top-4 translate-y right-4" />
            {/* TODO: 58px height of Playback.Controls */}
            <Seek.Track className="absolute w-[85%] bottom-[58px] translate-y-1/2 left-1/2 -translate-x-1/2">
              <Seek.Buffer />
              <Seek.Progress />
              <Seek.Thumb />
            </Seek.Track>
            <Seek.Animator />
          </Seek.Content>
        </Seek.Root>
      </Playback.Root>
    </div>
  );
});

DualVideoPreview.displayName = "DualVideoPreview";

export default DualVideoPreviewEditor;
