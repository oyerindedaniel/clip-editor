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

interface DualVideoPreviewProps {
  primarySource: Video;
  secondarySource: Video;

  primaryTrimData: TrimData;
  secondaryTrimData: TrimData;

  primaryKeyframeBounds: KeyframeBounds;
  secondaryKeyframeBounds: KeyframeBounds;

  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
  variant: CropMode;

  keyframes: KeyframeData[];

  playing?: boolean;
  onTimeChange?: (timelineMs: number) => void;
  onPlayingChange?: (status: PlayingStatus) => void;

  defaultRepeat?: boolean;

  canvasWidth: number;
  canvasHeight: number;
  padColor?: Color;

  className?: string;
  style?: React.CSSProperties;
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

  const halfHeight = canvasHeight / 2;

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
      <div className="absolute inset-x-0 top-0" style={{ height: halfHeight }}>
        <VideoPreview
          source={React.cloneElement(primarySource, {
            ref: primaryVideoRef,
          })}
          baseAspect={baseAspect}
          targetAspect={targetAspect}
          variant={variant}
          keyframes={primaryKeyframes}
          keyframeBounds={primaryKeyframeBounds}
          trimData={primaryTrimData}
          playing={sync.status === "playing"}
          externalControls={true}
        >
          {({ transform, videoRef }) => (
            <CanvasVideoRenderer
              renderEnabled={true}
              videoRef={videoRef}
              transformData={transform}
              variant={variant}
              width={canvasWidth}
              height={halfHeight}
              color={padColor}
            />
          )}
        </VideoPreview>
      </div>

      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: halfHeight }}
      >
        <VideoPreview
          source={React.cloneElement(secondarySource, {
            ref: secondaryVideoRef,
          })}
          baseAspect={baseAspect}
          targetAspect={targetAspect}
          variant={variant}
          keyframes={secondaryKeyframes}
          keyframeBounds={secondaryKeyframeBounds}
          trimData={secondaryTrimData}
          playing={sync.status === "playing"}
          externalControls={true}
        >
          {({ transform, videoRef }) => (
            <CanvasVideoRenderer
              renderEnabled={true}
              videoRef={videoRef}
              transformData={transform}
              variant={variant}
              width={canvasWidth}
              height={halfHeight}
              color={padColor}
            />
          )}
        </VideoPreview>
      </div>

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

interface DualVideoPreviewEditorProps {
  primaryVideoUrl: string;
  secondaryVideoUrl?: string;
  keyframes: KeyframeData[];
  primaryTrimData: TrimData;
  secondaryTrimData?: TrimData;
  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
  cropMode: CropMode;
  canvasWidth: number;
  canvasHeight: number;
  padColor?: Color;
  className?: string;
  style?: React.CSSProperties;
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
  } = props;

  const [playing, setPlaying] = React.useState(false);

  const hasSecondaryClip = Boolean(secondaryVideoUrl && secondaryTrimData);

  const hasSecondaryKeyframes = keyframes.some(
    (kf) => kf.target === "secondary"
  );

  const useDualMode = hasSecondaryClip && hasSecondaryKeyframes;

  if (useDualMode && secondaryVideoUrl && secondaryTrimData) {
    const primaryKeyframeBounds = getKeyframeBoundsForTarget(
      keyframes,
      "primary"
    );
    const secondaryKeyframeBounds = getKeyframeBoundsForTarget(
      keyframes,
      "secondary"
    );

    return (
      <DualVideoPreview
        ref={forwardedRef}
        primarySource={<video src={primaryVideoUrl} />}
        secondarySource={<video src={secondaryVideoUrl} />}
        primaryTrimData={primaryTrimData}
        secondaryTrimData={secondaryTrimData}
        primaryKeyframeBounds={primaryKeyframeBounds}
        secondaryKeyframeBounds={secondaryKeyframeBounds}
        baseAspect={baseAspect}
        targetAspect={targetAspect}
        variant={cropMode}
        keyframes={keyframes}
        playing={playing}
        onPlayingChange={(status) => setPlaying(status === "playing")}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        padColor={padColor}
        className={className}
        style={style}
      />
    );
  }

  const primaryKeyframeBounds = getKeyframeBoundsForTarget(
    keyframes,
    "primary"
  );

  return (
    <VideoPreview
      source={<video src={primaryVideoUrl} />}
      baseAspect={baseAspect}
      targetAspect={targetAspect}
      variant={cropMode}
      keyframes={filterKeyframesByTarget(keyframes, "primary")}
      keyframeBounds={primaryKeyframeBounds}
      trimData={primaryTrimData}
      playing={playing}
      onPlayingChange={(status) => setPlaying(status === "playing")}
      className={className}
      style={style}
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
        />
      )}
    </VideoPreview>
  );
});

DualVideoPreviewEditor.displayName = "DualVideoPreviewEditor";

export default DualVideoPreviewEditor;
