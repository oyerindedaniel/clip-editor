import React, { forwardRef, useRef, useMemo } from "react";
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
import type { AspectRatio } from "@/utils/aspect-ratios";
import type { PlayingStatus } from "@/hooks/app/use-video-controls-core";
import { cn } from "@/lib/utils";
import { Volume } from "./volume";
import { Playback } from "./video-controls";
import { Seek } from "./video-seek-bar";
import type { KeyframeBounds } from "@/utils/keyframe";
import PiPOverlay from "./pip-overlay";
import { useShallowSelector } from "react-shallow-store";
import { ClipContext } from "@/contexts/clip-context";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { composeRefs } from "@/lib/compose-refs";
import { getElementRef } from "@/lib/get-element-ref";

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
}

interface DualVideoPreviewEditorProps extends BaseDualVideoProps {
  primaryVideoUrl: string;
  secondaryVideoUrl?: string;

  primaryTrimData: TrimData;
  secondaryTrimData?: TrimData;
  cropMode: CropMode;
}

const DualVideoPreviewEditor = forwardRef<
  HTMLDivElement,
  DualVideoPreviewEditorProps
>((props, forwardedRef) => {
  const {
    primaryVideoUrl,
    secondaryVideoUrl,
    keyframes,
    primaryTrimData,
    secondaryTrimData,
    baseAspect,
    targetAspect,
    cropMode,
    canvasWidth,
    canvasHeight,
    padColor,
    className,
    style,
    playing = false,
  } = props;

  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  const { dualVideoSettings } = useShallowSelector(ClipContext, (state) => ({
    dualVideoSettings: state.dualVideoSettings,
  }));

  const hasSecondaryClip = Boolean(secondaryVideoUrl && secondaryTrimData);

  const hasSecondaryKeyframes = keyframes.some(
    (kf) => kf.target === "secondary"
  );

  const useDualMode = hasSecondaryClip && hasSecondaryKeyframes;

  if (useDualMode && secondaryVideoUrl && secondaryTrimData) {
    const primaryKeyframeBounds = useMemo(
      () => getKeyframeBoundsForTarget(keyframes, "primary"),
      [keyframes]
    );
    const secondaryKeyframeBounds = useMemo(
      () => getKeyframeBoundsForTarget(keyframes, "secondary"),
      [keyframes]
    );

    return (
      <DualVideoPreview
        ref={forwardedRef}
        primarySource={<video ref={primaryVideoRef} src={primaryVideoUrl} />}
        secondarySource={
          <video ref={secondaryVideoRef} src={secondaryVideoUrl} />
        }
        primaryTrimData={primaryTrimData}
        secondaryTrimData={secondaryTrimData}
        primaryKeyframeBounds={primaryKeyframeBounds}
        secondaryKeyframeBounds={secondaryKeyframeBounds}
        baseAspect={baseAspect}
        targetAspect={targetAspect}
        variant={cropMode}
        keyframes={keyframes}
        playing={playing}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        padColor={padColor}
        className={className}
        style={style}
      />
    );
  }

  const primaryKeyframeBounds = useMemo(
    () => getKeyframeBoundsForTarget(keyframes, "primary"),
    [keyframes]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundVideoRef =
    dualVideoSettings.backgroundVideo === "primary"
      ? primaryVideoRef
      : secondaryVideoRef;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden shadow-md w-full aspect-(--aspect-ratio)",
        className
      )}
      style={
        {
          "--aspect-ratio": targetAspect.replace(":", "/"),
          height: canvasHeight,
          ...style,
        } as React.CSSProperties
      }
    >
      <VideoPreview
        ref={forwardedRef}
        playing={playing}
        source={<video src={primaryVideoUrl} />}
        baseAspect={baseAspect}
        targetAspect={targetAspect}
        variant={cropMode}
        keyframes={filterKeyframesByTarget(keyframes, "primary")}
        keyframeBounds={primaryKeyframeBounds}
        trimData={primaryTrimData}
        className="w-full h-full"
      >
        {({ transform, variant, videoRef }) => (
          <CanvasVideoRenderer
            renderEnabled={playing}
            videoRef={videoRef}
            transformData={transform}
            variant={variant}
            width={canvasWidth}
            height={canvasHeight}
            color={padColor}
            backgroundMode={dualVideoSettings.backgroundMode}
            backgroundVideo={dualVideoSettings.backgroundVideo}
            backgroundVideoRef={backgroundVideoRef}
          />
        )}
      </VideoPreview>

      {dualVideoSettings.layout === "pip" && secondaryVideoUrl && (
        <PiPOverlay containerRef={containerRef}>
          <video src={secondaryVideoUrl} />
        </PiPOverlay>
      )}
    </div>
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

  defaultRepeat?: boolean;

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

  const sync = useDualVideoSync({
    primaryVideoRef,
    secondaryVideoRef,
    primaryTrim: primaryTrimData,
    secondaryTrim: secondaryTrimData,
    onTimeUpdate: onTimeChange,
    enabled: true,
  });

  const { dualVideoSettings, setDualVideoSettings } = useShallowSelector(
    ClipContext,
    (state) => ({
      dualVideoSettings: state.dualVideoSettings,
      setDualVideoSettings: state.setDualVideoSettings,
    })
  );

  const primaryPercentage = dualVideoSettings.primaryPanelPercentage || 50;
  const secondaryPercentage = 100 - primaryPercentage;

  const handlePanelResize = (sizes: number[]) => {
    if (sizes.length >= 2) {
      setDualVideoSettings((prev) => ({
        ...prev,
        primaryPanelPercentage: Math.round(sizes[0]),
      }));
    }
  };

  return (
    <div
      ref={forwardedRef}
      className={cn(
        "relative overflow-hidden shadow-md w-full aspect-(--aspect-ratio)",
        className
      )}
      style={
        {
          "--aspect-ratio": targetAspect.replace(":", "/"),
          height: canvasHeight,
          ...style,
        } as React.CSSProperties
      }
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
            playing={sync.status === "playing"}
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
            playing={sync.status === "playing"}
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
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/80 to-transparent pt-12 pb-4">
        <div className="flex items-center justify-center gap-2 px-4">
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
          >
            <Playback.Controls className="flex items-center justify-between px-4 w-full">
              <div className="flex items-center gap-3">
                <Playback.PlayToggle />
                <Playback.LoopToggle
                  defaultLoop={defaultRepeat}
                  onLoopChange={(value) => {
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
              primaryTrim={primaryTrimData}
              secondaryTrim={secondaryTrimData}
              isPlaying={sync.status === "playing"}
              onSeek={sync.controls.seek}
              primaryBuffered={sync.primaryBuffered}
              secondaryBuffered={sync.secondaryBuffered}
            >
              <Seek.Content>
                <Seek.TimeDisplay className="absolute -top-8 right-4" />
                <Seek.Track className="absolute w-[85%] -top-2 left-1/2 -translate-x-1/2">
                  <Seek.Buffer />
                  <Seek.Progress />
                  <Seek.Thumb />
                </Seek.Track>
                <Seek.Animator />
              </Seek.Content>
            </Seek.Root>
          </Playback.Root>
        </div>
      </div>

      <div className="absolute top-2 left-2 z-20">
        <Volume.Root
          defaultValue={0.8}
          onValueChangeAlways={(vol) => {
            if (primaryVideoRef.current) primaryVideoRef.current.volume = vol;
            if (secondaryVideoRef.current)
              secondaryVideoRef.current.volume = vol;
          }}
        >
          <Volume.Controls variant="pill">
            <Volume.Button />
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
  );
});

DualVideoPreview.displayName = "DualVideoPreview";

export default DualVideoPreviewEditor;
