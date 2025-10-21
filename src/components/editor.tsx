"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type {
  ExportSettings,
  ClipExportData,
  ClipMetadata,
  S3ClipData as ClipData,
} from "@/types/app";
import { toast } from "sonner";
import { normalizeError } from "@/utils/error-utils";
import { processClipForExport, onFFmpegProgress } from "@/utils/ffmpeg";
import logger from "@/utils/logger";
import {
  getVideoBoundingBox,
  getTargetVideoDimensions,
  getFormatFromSrc,
} from "@/utils/video";
import AspectRatioPicker from "./aspect-ratio-picker";
import { useDisclosure } from "@/hooks/use-disclosure";
import { DEFAULT_CLIP_METADATA, DEFAULT_COLORS } from "@/constants/app";
import Timeline from "@/components/timeline";
import TimelineSkeleton from "@/components/timeline-skeleton";
import ExportNamingDialog from "./export-naming-dialog";
import { useLatestValue } from "@/hooks/use-latest-value";
import { OverlaysContext } from "@/contexts/overlays-context";
import { EditorRightPanel } from "./editor-right-panel";
import DualVideoTracks from "./dual-video-tracks";
import DualVideoPlayer from "./dual-video-player";
import EditorHeader from "./editor-header";
import useVideoThumbnails from "@/hooks/app/use-video-thumbnails";
import { PersistentOverlays } from "./persistent-overlays";
import { useShallowSelector } from "react-shallow-store";
import EditorPanel, { type EditorSide } from "./editor-panel";
import { Button } from "@/components/ui/button";
import {
  SlidersHorizontal,
  Film,
  Square,
  Monitor,
  Smartphone,
  PanelLeft,
  PanelRight,
  Video,
  Clapperboard,
} from "lucide-react";
import { ClipContext } from "@/contexts/clip-context";
import { KeyframeContext } from "@/contexts/keyframe-context";
import { BoundaryBox } from "./boundary-box";
import { Keyframe } from "./keyframe";
import { ScrubbableInput } from "./scrubbable-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AspectRatio } from "@/utils/aspect-ratios";
import { KEYFRAME_EASINGS } from "@/utils/keyframe";
import { roundToDecimals } from "@/utils/app";
import type { KeyframeEasing } from "@/utils/keyframe";
import ColorPalette, { Color } from "./color-palette";
import type { CropMode } from "@/types/app";
import { useElementSize } from "@/hooks/use-element-size";
import VideoPreview from "./video-preview";
import CanvasVideoRenderer from "./canvas-video-renderer";
import { useStackedTransition } from "@/hooks/app/use-stacked-transition";
import { LoaderIcon } from "@/icons/loader";
import { cn } from "@/lib/utils";
import { calculateHeight } from "@/utils/aspect-ratios";
import KeyframeLists from "./keyframe-lists";
import { AudioContext } from "@/contexts/audio-context";
import KeyframeNameInput from "./keyframe-name-input";
import MainMedia from "./main-media";
import PiPOverlay from "./pip-overlay";
import { DualClockProvider } from "@/contexts/dual-clock-context";

interface Data {
  buffer: ArrayBuffer;
  url: string;
}

interface BufferStatus {
  data: Data | null;
  isValid: boolean;
}

interface ClipEditorProps {
  clipData: ClipData;
}

const ClipEditor = ({ clipData }: ClipEditorProps) => {
  const [duration, setDuration] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [toolPanelOpen, setToolPanelOpen] = useState(false);
  const [panelSide, setPanelSide] = useState<EditorSide>("right");

  const [cropMode, setCropMode] = useState<CropMode>(
    DEFAULT_CLIP_METADATA.cropMode
  );
  const [padColor, setPadColor] = useState<Color>(
    DEFAULT_CLIP_METADATA.padColor
  );

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const keyframeTriggerRef = useRef<HTMLButtonElement | null>(null);

  const {
    isOpen: isExportNamingModalOpen,
    close: closeExportNamingModal,
    open: openExportNamingModal,
  } = useDisclosure();

  const { ref: videoRenderRef, sizeRef: canvasSizeRef } =
    useElementSize<HTMLDivElement>();

  const wasPlayingRef = useRef<{ primary: boolean; secondary: boolean }>({
    primary: false,
    secondary: false,
  });

  const primaryClipMetaDataRef = useRef<ClipMetadata>(DEFAULT_CLIP_METADATA);
  const traceRef = useRef<HTMLDivElement>(null);

  const { textOverlaysRef, imageOverlaysRef, containerRef, setVideoRef } =
    useShallowSelector(OverlaysContext, (state) => ({
      containerRef: state.containerRef,
      textOverlaysRef: state.textOverlaysRef,
      imageOverlaysRef: state.imageOverlaysRef,
      setVideoRef: state.setVideoRef,
    }));

  const {
    primaryTrimRef,
    secondaryTrimRef,
    setPrimaryTrim,
    setSecondaryTrim,
    secondaryClip,
    dualVideoSettingsRef,
    getVideoRef,
    primaryVideoRef,
    secondaryVideoRef,
    primaryDualVideoRef,
    secondaryDualVideoRef,
    pipVideoRef,
    clearTrimData,
    canClearTrim,
  } = useShallowSelector(ClipContext, (state) => ({
    primaryTrimRef: state.primaryTrimRef,
    secondaryTrimRef: state.secondaryTrimRef,
    setPrimaryTrim: state.setPrimaryTrim,
    setSecondaryTrim: state.setSecondaryTrim,
    secondaryClip: state.secondaryClip,
    dualVideoSettingsRef: state.dualVideoSettingsRef,
    getVideoRef: state.getVideoRef,
    primaryVideoRef: state.primaryVideoRef,
    secondaryVideoRef: state.secondaryVideoRef,
    primaryDualVideoRef: state.primaryDualVideoRef,
    secondaryDualVideoRef: state.secondaryDualVideoRef,
    pipVideoRef: state.pipVideoRef,
    clearTrimData: state.clearTrimData,
    canClearTrim: state.canClearTrim,
  }));

  const { audioTracksRef } = useShallowSelector(AudioContext, (state) => ({
    audioTracksRef: state.audioTracksRef,
  }));

  const {
    boundaryAspectRatio,
    setBoundaryAspectRatio,
    boundaryVisible,
    setBoundaryVisible,
    boundaryTransform,
    setBoundaryTransform,
    keyframes: controlledKeyframes,
    setKeyframes: setControlledKeyframes,
    currentKeyframeId: controlledCurrentKeyframeId,
    setCurrentKeyframeId: setControlledCurrentKeyframeId,
  } = useShallowSelector(KeyframeContext, (state) => ({
    boundaryAspectRatio: state.boundaryAspectRatio,
    setBoundaryAspectRatio: state.setBoundaryAspectRatio,
    boundaryVisible: state.boundaryVisible,
    setBoundaryVisible: state.setBoundaryVisible,
    boundaryTransform: state.boundaryTransform,
    setBoundaryTransform: state.setBoundaryTransform,
    keyframes: state.keyframes,
    setKeyframes: state.setKeyframes,
    currentKeyframeId: state.currentKeyframeId,
    setCurrentKeyframeId: state.setCurrentKeyframeId,
  }));

  const {
    refs,
    classNames,
    styles,
    animating: isAnimatingStack,
    toggle: toggleStack,
    present,
    parentClassName,
    active,
  } = useStackedTransition({
    defaultActive: "dual",
    keys: ["dual", "renderer"] as const,
    duration: 650,
    forceMount: true,
  });

  const {
    refs: playerRefs,
    classNames: playerClassNames,
    styles: playerStyles,
    animating: isAnimatingPlayerStack,
    toggle: togglePlayerStack,
    present: playerPresent,
    parentClassName: playerParentClassName,
    active: playerActive,
  } = useStackedTransition({
    defaultActive: "primary",
    keys: ["primary", "secondary"] as const,
    duration: 650,
    forceMount: true,
  });

  const playerActiveRef = useLatestValue(playerActive);
  const activeVideoRef = getVideoRef(playerActiveRef.current);

  const [showTrace, setShowTrace] = useState(false);
  const showTraceRef = useLatestValue(showTrace);

  const primaryUrl = clipData.url;

  const [bufferStatus, setBufferStatus] = useState<BufferStatus>({
    data: null,
    isValid: false,
  });

  const isValidBufferState = bufferStatus.isValid;

  const toggleActivePlayer = useCallback(() => {
    const primary =
      !!primaryVideoRef.current && !primaryVideoRef.current.paused;
    const secondary =
      !!secondaryVideoRef.current && !secondaryVideoRef.current.paused;
    wasPlayingRef.current = { primary, secondary };

    togglePlayerStack();

    //  restore playback for new active if it was playing before
    queueMicrotask(() => {
      const activeIsSecondary = playerActive === "primary"; // will become secondary
      if (activeIsSecondary) {
        if (primary && primaryVideoRef.current) primaryVideoRef.current.pause();
        if (wasPlayingRef.current.secondary && secondaryVideoRef.current) {
          secondaryVideoRef.current.play().catch(() => {});
        }
      } else {
        if (secondary && secondaryVideoRef.current)
          secondaryVideoRef.current.pause();
        if (wasPlayingRef.current.primary && primaryVideoRef.current) {
          primaryVideoRef.current.play().catch(() => {});
        }
      }
    });
  }, [togglePlayerStack, playerActive]);

  const togglePanelSide = useCallback(() => {
    setPanelSide((prev) => (prev === "right" ? "left" : "right"));
  }, []);

  const toggleTrace = useCallback(() => {
    setShowTrace((v) => {
      if (traceRef.current) {
        if (v) {
          traceRef.current.style.backgroundColor = "transparent";
        } else {
          traceRef.current.style.backgroundColor = "rgba(255, 0, 0, 0.15)";
        }
      }
      return !v;
    });
  }, []);

  const withProgressToast = useCallback(
    async <T,>(
      label: string,
      task: () => Promise<T>,
      toastId?: string
    ): Promise<T> => {
      const id = toastId || `${clipData.metadata.clipId}-${Date.now()}`;

      const render = (percent: number) =>
        toast.custom(
          () => (
            <div className="w-80 rounded-lg bg-primary shadow-xl p-3 text-foreground-on-accent">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm md:text-[0.8rem] font-medium tracking-tight">
                  {label}
                </span>
                <span className="text-[10px] tabular-nums text-foreground-on-accent/80">
                  {percent}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-foreground-on-accent/20 overflow-hidden">
                <div
                  className="h-full bg-foreground-on-accent transition-all duration-150"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ),
          { id }
        );

      render(0);

      let unsub: (() => void) | null = null;
      try {
        unsub = onFFmpegProgress((p) => {
          const percent = Math.max(
            0,
            Math.min(100, Math.round((p || 0) * 100))
          );
          render(percent);
        });
        const result = await task();
        toast.dismiss(id);
        toast.success(`${label} done`);
        return result;
      } catch (e) {
        toast.dismiss(id);
        throw e;
      } finally {
        if (unsub) unsub();
      }
    },
    []
  );

  const adjustOverlayBounds = useCallback(() => {
    const video = activeVideoRef.current;
    const container = containerRef.current;
    const trace = traceRef.current;

    if (!video || !container || !trace) return;

    const { x, y, width, height } = getVideoBoundingBox(video);

    trace.style.position = "absolute";
    trace.style.left = `${x}px`;
    trace.style.top = `${y}px`;
    trace.style.width = `${width}px`;
    trace.style.height = `${height}px`;
    trace.style.backgroundColor = showTraceRef.current
      ? "rgba(255, 0, 0, 0.15)"
      : "transparent";
    trace.style.pointerEvents = "none";
    trace.style.zIndex = "15";
  }, [showTraceRef]);

  const primaryFrames = useVideoThumbnails(primaryUrl, 24, isVideoLoaded);
  const secondaryFrames = useVideoThumbnails(
    secondaryClip?.url,
    24,
    Boolean(secondaryClip?.url)
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setToolPanelOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let abortController: AbortController | undefined;

    const convertUrlToBuffer = async () => {
      if (!primaryUrl) return;

      abortController = new AbortController();

      try {
        const response = await fetch(primaryUrl, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch clip: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();

        setBufferStatus({
          data: { buffer, url: primaryUrl },
          isValid: true,
        });
      } catch (error) {
        if ((normalizeError(error).name = "AbortError")) {
          return;
        }
        const errorMsg = normalizeError(error).message;
        toast.error(`Failed to load clip: ${errorMsg}`);
      }
    };

    convertUrlToBuffer();

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [primaryUrl, clipData.metadata.clipId]);

  useEffect(() => {
    return () => {
      if (secondaryClip?.url) {
        URL.revokeObjectURL(secondaryClip.url);
      }
    };
  }, [secondaryClip?.url]);

  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const duration = video.duration * 1000;
      setIsVideoLoaded(true);
      setDuration(duration);
      setPrimaryTrim((prev) => ({
        ...prev,
        trimEnd: duration,
      }));
      adjustOverlayBounds();

      primaryClipMetaDataRef.current = {
        ...primaryClipMetaDataRef.current,
        format: getFormatFromSrc(video.currentSrc),
        dimensions: {
          width: video.videoWidth,
          height: video.videoHeight,
        },
      };
    };

    const handleError = (e: Event) => {
      setIsVideoLoaded(false);
      logger.error("Video load error:", e);
      const videoElement = e.target as HTMLVideoElement;
      logger.error("Video error details:", {
        error: videoElement.error,
        networkState: videoElement.networkState,
        readyState: videoElement.readyState,
        currentSrc: videoElement.currentSrc,
      });
      toast.error("Error loading video clip");
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("error", handleError);
    window.addEventListener("resize", adjustOverlayBounds);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
      window.removeEventListener("resize", adjustOverlayBounds);
    };
  }, [adjustOverlayBounds]);

  const handleExport = async (
    outputName: string,
    {
      preset,
      crf,
      fps,
      format,
      resolution,
      bitrate,
      customBitrateKbps,
      audioBitrateKbps,
      audioCompressed,
    }: Pick<
      ExportSettings,
      | "preset"
      | "crf"
      | "fps"
      | "format"
      | "resolution"
      | "bitrate"
      | "customBitrateKbps"
      | "audioBitrateKbps"
      | "audioCompressed"
    >
  ) => {
    // TODO: review video this definety wrong
    const video = activeVideoRef.current;
    const bufferData = bufferStatus.data?.buffer;
    if (!video || !primaryClipMetaDataRef.current || !bufferData) return;

    setIsExporting(true);

    try {
      const { width: clientWidth, height: clientHeight } =
        getVideoBoundingBox(video);
      const clientDisplaySize = { width: clientWidth, height: clientHeight };

      const videoAspectRatio =
        primaryClipMetaDataRef.current.dimensions.width /
        primaryClipMetaDataRef.current.dimensions.height;
      const targetResolutionDimensions = getTargetVideoDimensions(
        resolution!,
        videoAspectRatio
      );

      const exportData: ClipExportData = {
        id: clipData.metadata.clipId,
        outputName,
        textOverlays: textOverlaysRef.current.filter(
          (overlay) => overlay.visible
        ),
        imageOverlays: imageOverlaysRef.current.filter(
          (overlay) => overlay.visible
        ),
        audioTracks: audioTracksRef.current.filter((track) => track.visible),
        exportSettings: {
          preset,
          crf,
          fps,
          format,
          resolution,
          bitrate,
          customBitrateKbps,
          audioBitrateKbps,
          audioCompressed,
          convertAspectRatio: primaryClipMetaDataRef.current.aspectRatio,
          cropMode: primaryClipMetaDataRef.current.cropMode,
        },
        clientDisplaySize,
        targetResolution: targetResolutionDimensions,
        dualVideo: {
          primaryClip: {
            id: clipData.metadata.clipId,
            url: primaryUrl,
            buffer: bufferData,
            metadata: clipData.metadata,
            ...primaryClipMetaDataRef.current,
            ...primaryTrimRef.current,
            visible: true,
          },
          ...(secondaryClip && {
            secondaryClip: {
              ...secondaryClip,
              ...secondaryTrimRef.current,
            },
          }),
          settings: dualVideoSettingsRef.current,
        },
      };

      logger.log({ exportData });

      const processedBlob = await withProgressToast<Blob>(
        "Exporting clip",
        () => processClipForExport(exportData),
        `export-${clipData.metadata.clipId}`
      );

      logger.log("export", processedBlob);

      const downloadUrl = URL.createObjectURL(processedBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${outputName}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      logger.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleTrim = (startTime: number, endTime: number) => {
    setPrimaryTrim((prev) => ({
      ...prev,
      trimStart: startTime,
      trimEnd: endTime,
    }));

    logger.log("Trimmed primary video from:", startTime, "to:", endTime);
  };

  const primaryTrimData = primaryTrimRef.current;

  const primaryDurationMs =
    primaryTrimData &&
    (primaryTrimData.trimEnd !== 0 || primaryTrimData.trimStart !== 0)
      ? primaryTrimData.trimEnd - primaryTrimData.trimStart
      : duration;

  const secondaryDurationMs = secondaryClip?.metadata.clipDurationMs ?? 0;

  const maxDurationMs = Math.max(primaryDurationMs, secondaryDurationMs);

  const source = useMemo(() => <video src={primaryUrl} />, [primaryUrl]);

  return (
    <div className="h-dvh bg-surface-primary text-foreground-default text-sm flex flex-col">
      <EditorHeader
        isVideoLoaded={isVideoLoaded}
        isExporting={isExporting}
        onToggleTrace={toggleTrace}
        onOpenExport={openExportNamingModal}
        onClearTrimData={clearTrimData}
        canClearTrim={canClearTrim}
      />

      <div className="flex-1 min-h-0">
        <div className="h-full flex flex-col md:p-4 space-y-4 max-w-6xl mx-auto">
          <Keyframe.Root
            maxTime={duration}
            keyframes={controlledKeyframes}
            onKeyframesChange={setControlledKeyframes}
            currentKeyframeId={controlledCurrentKeyframeId}
            onCurrentKeyframeIdChange={setControlledCurrentKeyframeId}
          >
            {({
              keyframes,
              currentKeyframeId,
              setCurrentKeyframeId,
              addKeyframe,
              updateKeyframe,
              deleteKeyframe,
              getKeyframe,
              updateColors,
              getKeyframeBounds,
            }) => (
              <>
                <div className="w-full flex flex-col lg:flex-row items-center gap-4">
                  <div className="flex-1 w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 p-2">
                        <AspectRatioPicker
                          screenSize="16:9"
                          aspectRatio={boundaryAspectRatio}
                          onAspectRatioChange={setBoundaryAspectRatio}
                          visible={boundaryVisible}
                          onVisibleChange={setBoundaryVisible}
                          disabled={!isValidBufferState || isExporting}
                          cropMode={cropMode}
                          onCropModeChange={setCropMode}
                          padColor={padColor}
                          onPadColorChange={(color) => setPadColor(color)}
                        />

                        <div className="flex items-center gap-px">
                          <Button
                            ref={keyframeTriggerRef}
                            size="sm"
                            onClick={() => {
                              if (boundaryTransform) {
                                addKeyframe({
                                  time: activeVideoRef.current?.currentTime
                                    ? activeVideoRef.current.currentTime
                                    : 0,
                                  transform: boundaryTransform,
                                  easing: "ease-in-out",
                                  color: DEFAULT_COLORS[2],
                                  target:
                                    playerActive === "secondary"
                                      ? "secondary"
                                      : "primary",
                                });
                              }
                            }}
                            disabled={!boundaryTransform}
                            className="ml-2"
                          >
                            <Film className="mr-2" size={14} />
                            Add Keyframe
                          </Button>
                          {keyframes && keyframes.length > 0 && (
                            <KeyframeLists
                              keyframes={keyframes}
                              currentKeyframeId={currentKeyframeId}
                              onKeyframeSelect={(id) => {
                                setCurrentKeyframeId(id);
                              }}
                              onKeyframeRemove={(id) => {
                                deleteKeyframe(id);
                              }}
                              className="ml-2"
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        {secondaryClip && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={toggleActivePlayer}
                            disabled={isAnimatingPlayerStack}
                            className="flex items-center gap-2"
                          >
                            {isAnimatingPlayerStack ? (
                              <LoaderIcon size={14} />
                            ) : playerActive === "primary" ? (
                              <Video size={14} />
                            ) : (
                              <Clapperboard size={14} />
                            )}
                            <span>
                              {playerActive === "primary"
                                ? "Secondary Clip"
                                : "Primary Clip"}
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>

                    <BoundaryBox
                      screenSize="16:9"
                      videoWidth={activeVideoRef.current?.videoWidth}
                      videoHeight={activeVideoRef.current?.videoHeight}
                      aspectRatio={boundaryAspectRatio as AspectRatio}
                      visible={boundaryVisible}
                      transform={boundaryTransform!}
                      onTransformChange={(transform) => {
                        setBoundaryTransform(transform);
                        if (currentKeyframeId) {
                          updateKeyframe(currentKeyframeId, {
                            transform,
                          });
                        }
                      }}
                      currentKeyframe={
                        currentKeyframeId
                          ? getKeyframe(currentKeyframeId)
                          : undefined
                      }
                    >
                      {({
                        updatePosition,
                        updateScale,
                        containerWidth,
                        containerHeight,
                      }) => (
                        <>
                          <BoundaryBox.Container
                            ref={containerRef}
                            className="relative flex-1 min-w-0"
                          >
                            <DualClockProvider
                              duration={maxDurationMs}
                              primaryVideoRef={
                                playerActive === "primary"
                                  ? primaryVideoRef
                                  : secondaryVideoRef
                              }
                              secondaryVideoRef={pipVideoRef}
                            >
                              <PiPOverlay containerRef={containerRef}>
                                <video
                                  ref={pipVideoRef}
                                  src={
                                    playerActive === "primary"
                                      ? secondaryClip?.url
                                      : primaryUrl
                                  }
                                />
                              </PiPOverlay>

                              <div
                                className={cn(
                                  "relative w-full aspect-video",
                                  playerParentClassName
                                )}
                              >
                                {playerPresent.primary && (
                                  <div
                                    ref={
                                      playerRefs.primary as React.Ref<HTMLDivElement>
                                    }
                                    className={playerClassNames.primary}
                                    style={playerStyles.primary}
                                  >
                                    <div className="relative w-full aspect-video">
                                      <MainMedia
                                        ref={primaryVideoRef}
                                        mediaUrl={primaryUrl}
                                        playerType="primary"
                                        setVideoRef={setVideoRef}
                                      />
                                    </div>
                                  </div>
                                )}

                                {playerPresent.secondary && secondaryClip && (
                                  <div
                                    ref={
                                      playerRefs.secondary as React.Ref<HTMLDivElement>
                                    }
                                    className={playerClassNames.secondary}
                                    style={playerStyles.secondary}
                                  >
                                    <div className="relative w-full aspect-video">
                                      <MainMedia
                                        ref={secondaryVideoRef}
                                        mediaUrl={secondaryClip.url}
                                        playerType="secondary"
                                        setVideoRef={setVideoRef}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DualClockProvider>

                            <div ref={traceRef} />
                            <PersistentOverlays duration={duration} />

                            <BoundaryBox.Draggable>
                              <BoundaryBox.Overlay>
                                <BoundaryBox.Resizable side="top-left" />
                                <BoundaryBox.Resizable side="top-right" />
                                <BoundaryBox.Resizable side="bottom-left" />
                                <BoundaryBox.Resizable side="bottom-right" />
                              </BoundaryBox.Overlay>
                            </BoundaryBox.Draggable>
                          </BoundaryBox.Container>

                          <Keyframe.Box triggerRef={keyframeTriggerRef}>
                            <Keyframe.BoxHeader>
                              {currentKeyframeId &&
                                getKeyframe(currentKeyframeId) &&
                                `Keyframe @ ${getKeyframe(
                                  currentKeyframeId
                                )!.time.toFixed(1)}s`}

                              <Keyframe.BoxClose />
                            </Keyframe.BoxHeader>
                            <Keyframe.BoxContent>
                              {currentKeyframeId &&
                                getKeyframe(currentKeyframeId) && (
                                  <>
                                    <div className="space-y-3">
                                      <div className="space-y-1">
                                        <Label
                                          htmlFor="keyframe-name"
                                          className="text-sm md:text-[0.8rem] font-medium select-none text-foreground-subtle"
                                        >
                                          Name
                                        </Label>
                                        <KeyframeNameInput
                                          id="keyframe-name"
                                          keyframe={
                                            getKeyframe(currentKeyframeId)!
                                          }
                                          currentKeyframeId={currentKeyframeId}
                                          updateKeyframe={updateKeyframe}
                                        />
                                      </div>
                                      <ScrubbableInput.Root
                                        value={roundToDecimals(
                                          getKeyframe(currentKeyframeId)!
                                            .transform.x,
                                          3
                                        )}
                                        onValueChange={(x) => {
                                          updatePosition(
                                            x,
                                            getKeyframe(currentKeyframeId)!
                                              .transform.y
                                          );
                                        }}
                                        min={0}
                                        max={
                                          containerWidth -
                                          (getKeyframe(currentKeyframeId)
                                            ?.transform.width || 0)
                                        }
                                        step={10}
                                        sensitivity={0.1}
                                      >
                                        <ScrubbableInput.Label htmlFor="keyframe-x">
                                          X Position
                                        </ScrubbableInput.Label>
                                        <ScrubbableInput.Content>
                                          <ScrubbableInput.DragHandle>
                                            <ScrubbableInput.Icon>
                                              X
                                            </ScrubbableInput.Icon>
                                          </ScrubbableInput.DragHandle>
                                          <ScrubbableInput.Field id="keyframe-x" />
                                        </ScrubbableInput.Content>
                                      </ScrubbableInput.Root>

                                      <ScrubbableInput.Root
                                        value={roundToDecimals(
                                          getKeyframe(currentKeyframeId)!
                                            .transform.y,
                                          3
                                        )}
                                        onValueChange={(y) => {
                                          updatePosition(
                                            getKeyframe(currentKeyframeId)!
                                              .transform.x,
                                            y
                                          );
                                        }}
                                        min={0}
                                        max={
                                          containerHeight -
                                          (getKeyframe(currentKeyframeId)
                                            ?.transform.height || 0)
                                        }
                                        step={10}
                                        sensitivity={0.1}
                                      >
                                        <ScrubbableInput.Label htmlFor="keyframe-y">
                                          Y Position
                                        </ScrubbableInput.Label>
                                        <ScrubbableInput.Content>
                                          <ScrubbableInput.DragHandle>
                                            <ScrubbableInput.Icon>
                                              Y
                                            </ScrubbableInput.Icon>
                                          </ScrubbableInput.DragHandle>
                                          <ScrubbableInput.Field id="keyframe-y" />
                                        </ScrubbableInput.Content>
                                      </ScrubbableInput.Root>

                                      <ScrubbableInput.Root
                                        value={roundToDecimals(
                                          getKeyframe(currentKeyframeId)!
                                            .transform.scale,
                                          3
                                        )}
                                        onValueChange={(scale) => {
                                          updateScale(scale);
                                        }}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        sensitivity={0.4}
                                      >
                                        <ScrubbableInput.Label htmlFor="keyframe-scale">
                                          Scale
                                        </ScrubbableInput.Label>
                                        <ScrubbableInput.Content>
                                          <ScrubbableInput.DragHandle>
                                            <ScrubbableInput.Icon>
                                              <Square className="w-4 h-4" />
                                            </ScrubbableInput.Icon>
                                          </ScrubbableInput.DragHandle>
                                          <ScrubbableInput.Field id="keyframe-scale" />
                                        </ScrubbableInput.Content>
                                      </ScrubbableInput.Root>

                                      <div className="space-y-1">
                                        <Label
                                          htmlFor="keyframe-color"
                                          className="text-sm md:text-[0.8rem] font-medium select-none text-foreground-subtle"
                                        >
                                          Color
                                        </Label>
                                        <ColorPalette
                                          id="keyframe-color"
                                          value={
                                            currentKeyframeId
                                              ? getKeyframe(currentKeyframeId)
                                                  ?.color
                                              : DEFAULT_COLORS[2]
                                          }
                                          onChange={(color: Color) => {
                                            if (currentKeyframeId) {
                                              updateColors(
                                                currentKeyframeId,
                                                color
                                              );
                                            }
                                          }}
                                        >
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 flex items-center gap-2 font-mono"
                                          >
                                            <span
                                              className="h-4 w-4 rounded-full border"
                                              style={{
                                                backgroundColor:
                                                  currentKeyframeId
                                                    ? getKeyframe(
                                                        currentKeyframeId
                                                      )?.color
                                                    : DEFAULT_COLORS[2],
                                              }}
                                            />
                                            <span>
                                              {currentKeyframeId
                                                ? getKeyframe(currentKeyframeId)
                                                    ?.color
                                                : DEFAULT_COLORS[2]}
                                            </span>
                                          </Button>
                                        </ColorPalette>
                                      </div>

                                      <div className="space-y-1">
                                        <Label
                                          htmlFor="keyframe-easing"
                                          className="text-sm md:text-[0.8rem] font-medium select-none text-foreground-subtle"
                                        >
                                          Easing
                                        </Label>
                                        <Select
                                          value={
                                            getKeyframe(currentKeyframeId)!
                                              .easing
                                          }
                                          onValueChange={(value) =>
                                            updateKeyframe(currentKeyframeId, {
                                              easing: value as KeyframeEasing,
                                            })
                                          }
                                        >
                                          <SelectTrigger
                                            id="keyframse-easing"
                                            className="border-2"
                                          >
                                            <SelectValue placeholder="Select easing" />
                                          </SelectTrigger>
                                          <SelectContent className="z-110">
                                            {KEYFRAME_EASINGS.map((easing) => (
                                              <SelectItem
                                                key={easing}
                                                value={easing}
                                              >
                                                {easing}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          deleteKeyframe(currentKeyframeId)
                                        }
                                        className="w-full mt-2"
                                      >
                                        Delete Keyframe
                                      </Button>
                                    </div>
                                  </>
                                )}
                            </Keyframe.BoxContent>
                          </Keyframe.Box>
                        </>
                      )}
                    </BoundaryBox>
                  </div>

                  <div className="lg:self-end flex flex-col gap-2">
                    {keyframes && !!keyframes.length && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={toggleStack}
                        disabled={isAnimatingStack}
                        className="flex items-center gap-2 self-end"
                      >
                        {isAnimatingStack ? (
                          <LoaderIcon size={14} />
                        ) : active === "dual" ? (
                          <Monitor size={14} />
                        ) : (
                          <Smartphone size={14} />
                        )}
                        <span>
                          {active === "dual" ? "Canvas View" : "Dual View"}
                        </span>
                      </Button>
                    )}

                    <div
                      ref={videoRenderRef}
                      className={cn("aspect-[9/16] w-[260px]", parentClassName)}
                    >
                      {present.dual && (
                        <DualClockProvider
                          duration={maxDurationMs}
                          primaryVideoRef={primaryDualVideoRef}
                          secondaryVideoRef={secondaryDualVideoRef}
                        >
                          <DualVideoPlayer
                            ref={
                              keyframes?.length
                                ? (refs.dual as React.Ref<HTMLDivElement>)
                                : null
                            }
                            primaryClip={clipData}
                            secondaryClip={secondaryClip}
                            duration={duration}
                            className={classNames.dual}
                            style={styles.dual}
                          />
                        </DualClockProvider>
                      )}

                      {present.renderer && (
                        <VideoPreview
                          ref={
                            keyframes?.length
                              ? (refs.renderer as React.Ref<HTMLDivElement>)
                              : null
                          }
                          playing={active === "renderer"}
                          source={source}
                          baseAspect="16:9"
                          targetAspect={boundaryAspectRatio ?? "9:16"}
                          variant={cropMode}
                          keyframes={keyframes}
                          keyframeBounds={getKeyframeBounds(keyframes).primary}
                          className={classNames.renderer}
                          style={styles.renderer}
                        >
                          {({ transform, variant, videoRef }) => (
                            <CanvasVideoRenderer
                              renderEnabled={active === "renderer"}
                              videoRef={videoRef}
                              transformData={transform}
                              variant={variant}
                              width={canvasSizeRef.current.width}
                              height={calculateHeight({
                                aspectRatio: boundaryAspectRatio ?? "9:16",
                                width: canvasSizeRef.current.width,
                              })}
                              color={padColor}
                            />
                          )}
                        </VideoPreview>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  {secondaryClip ? (
                    <DualVideoTracks
                      primaryDurationMs={primaryDurationMs}
                      secondaryDurationMs={secondaryDurationMs}
                      initialOffsetMs={0}
                      primaryPreviewFrames={primaryFrames}
                      secondaryPreviewFrames={secondaryFrames}
                      // onOffsetChange={(liveOffsetMs) => {
                      //   setSecondaryTrim((prev) => ({
                      //     ...prev,
                      //     timelineOffset: liveOffsetMs,
                      //   }));
                      // }}
                      onCommitOffset={(offsetMs) => {
                        setSecondaryTrim((prev) => ({
                          ...prev,
                          timelineOffset: offsetMs,
                        }));
                      }}
                      onCutSecondaryAt={(trimData) => {
                        setSecondaryTrim((prev) => ({
                          ...prev,
                          ...trimData,
                        }));
                      }}
                      keyframes={keyframes}
                      videoId={clipData.metadata.clipId}
                    />
                  ) : isVideoLoaded ? (
                    <Timeline
                      duration={duration}
                      onTrim={handleTrim}
                      frames={primaryFrames}
                      keyframes={keyframes}
                    />
                  ) : (
                    <TimelineSkeleton />
                  )}
                </div>
              </>
            )}
          </Keyframe.Root>
        </div>
      </div>

      <ExportNamingDialog
        isOpen={isExportNamingModalOpen}
        onOpenChange={closeExportNamingModal}
        streamerName={clipData.metadata.streamerName}
        onExport={handleExport}
        isBufferDownloaded={isValidBufferState}
      />

      <EditorPanel.Root
        open={toolPanelOpen}
        onOpenChange={setToolPanelOpen}
        side={panelSide}
        disablePortal={false}
        triggerRef={triggerRef}
      >
        <EditorPanel.Portal>
          <EditorPanel.Content className="pb-[49px] w-[280px] h-[calc(100dvh-48px)] top-[48px] backdrop-blur-lg overflow-hidden">
            <EditorPanel.Header className="py-2 px-2 bg-background">
              <kbd className="px-2 py-0.1 bg-surface-tertiary rounded-sm text-foreground-default font-mono text-sm md:text-[0.8rem] border border-gray-700/50">
                Shift+T
              </kbd>
              <div className="ml-auto flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Toggle panel side"
                      onClick={togglePanelSide}
                    >
                      {panelSide === "right" ? (
                        <PanelRight size={14} />
                      ) : (
                        <PanelLeft size={14} />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {panelSide === "right" ? "Dock to left" : "Dock to right"}
                  </TooltipContent>
                </Tooltip>
                <EditorPanel.CloseButton />
              </div>
            </EditorPanel.Header>
            <EditorPanel.Body className="p-0 h-full">
              <EditorRightPanel
                isVideoLoaded={isVideoLoaded}
                duration={duration}
                clipData={clipData}
              />
            </EditorPanel.Body>
          </EditorPanel.Content>
        </EditorPanel.Portal>
      </EditorPanel.Root>

      <Button
        type="button"
        ref={triggerRef}
        onClick={() => setToolPanelOpen(true)}
        className="fixed bottom-4 right-4 z-40 shadow-lg hover:shadow-xl rounded-full hover:scale-105 transition-transform duration-200 ease-in-out focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-surface-primary"
        size="icon"
        variant="default"
        aria-label="Open Tools (T)"
      >
        <SlidersHorizontal size={14} />
      </Button>
    </div>
  );
};

export default ClipEditor;
