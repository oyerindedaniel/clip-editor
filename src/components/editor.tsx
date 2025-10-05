"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type {
  AudioTrack,
  ExportSettings,
  ClipExportData,
  ClipMetadata,
  S3ClipData as ClipData,
  Settings as SettingsType,
} from "@/types/app";
import { toast } from "sonner";
import { normalizeError } from "@/utils/error-utils";
import {
  processClip,
  processClipForExport,
  onFFmpegProgress,
} from "@/utils/ffmpeg";
import logger from "@/utils/logger";
import * as MediaPlayer from "@/components/ui/media-player";
import {
  getVideoBoundingBox,
  getTargetVideoDimensions,
  getFormatFromSrc,
  getBufferKey,
  getOriginalBufferKey,
} from "@/utils/video";
import AspectRatioPicker from "./aspect-ratio-picker";
import { useDisclosure } from "@/hooks/use-disclosure";
import { DEFAULT_CLIP_METADATA } from "@/constants/app";
import Timeline from "@/components/timeline";
import { TimelineSkeleton } from "@/components/timeline-skeleton";
import { ExportNamingDialog } from "./export-naming-dialog";
import { useLatestValue } from "@/hooks/use-latest-value";
import { OverlaysContext } from "@/contexts/overlays-context";
import { EditorRightPanel } from "./editor-right-panel";
import DualVideoTracks from "./dual-video-tracks";
import DualVideoPlayer from "./dual-video-player";
import EditorHeader from "./editor-header";
import useVideoThumbnails from "@/hooks/app/use-video-thumbnails";
import { PersistentOverlays } from "./persistent-overlays";
import { useShallowSelector } from "react-shallow-store";
import EditorPanel from "./editor-panel";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Film } from "lucide-react";
import { ClipContext } from "@/contexts/clip-context";
import { KeyframeContext } from "@/contexts/keyframe-context";
import { AspectRatio, BoundaryBox, Transform } from "./boundary-box";
import { Keyframe } from "./keyframe";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClipEditorProps {
  clipData: ClipData;
}

const ClipEditor = ({ clipData }: ClipEditorProps) => {
  const [duration, setDuration] = useState(0);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [toolPanelOpen, setToolPanelOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const {
    isOpen: isAspectRatioModalOpen,
    close: closeAspectRatioModal,
    open: openAspectRatioModal,
  } = useDisclosure();

  const {
    isOpen: isExportNamingModalOpen,
    close: closeExportNamingModal,
    open: openExportNamingModal,
  } = useDisclosure();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioFileRef = useRef<HTMLInputElement | null>(null);
  const primaryClipMetaDataRef = useRef<ClipMetadata>(DEFAULT_CLIP_METADATA);
  const traceRef = useRef<HTMLDivElement>(null);

  const { textOverlaysRef, imageOverlaysRef, containerRef, setVideoRef } =
    useShallowSelector(OverlaysContext, (state) => ({
      containerRef: state.containerRef,
      textOverlaysRef: state.textOverlaysRef,
      imageOverlaysRef: state.imageOverlaysRef,
      setVideoRef: state.setVideoRef,
    }));

  const { secondaryClip, dualVideoSettingsRef } = useShallowSelector(
    ClipContext,
    (state) => ({
      secondaryClip: state.secondaryClip,
      dualVideoSettingsRef: state.dualVideoSettingsRef,
    })
  );

  const [showTrace, setShowTrace] = useState(false);
  const showTraceRef = useLatestValue(showTrace);

  const [processedBuffers, setProcessedBuffers] = useState<
    Map<string, { buffer: ArrayBuffer; url: string }>
  >(() => new Map());

  const processedBuffersRef = useLatestValue(processedBuffers);

  const [primaryUrl, setPrimaryUrl] = useState<string>(clipData.url);

  const { primaryTrimRef, secondaryTrimRef, setPrimaryTrim, setSecondaryTrim } =
    useShallowSelector(ClipContext, (state) => ({
      primaryTrimRef: state.primaryTrimRef,
      secondaryTrimRef: state.secondaryTrimRef,
      setPrimaryTrim: state.setPrimaryTrim,
      setSecondaryTrim: state.setSecondaryTrim,
    }));

  const {
    boundaryAspectRatio,
    setBoundaryAspectRatio,
    boundaryVisible,
    setBoundaryVisible,
    boundaryTransform,
    setBoundaryTransform,
  } = useShallowSelector(KeyframeContext, (state) => ({
    boundaryAspectRatio: state.boundaryAspectRatio,
    setBoundaryAspectRatio: state.setBoundaryAspectRatio,
    boundaryVisible: state.boundaryVisible,
    setBoundaryVisible: state.setBoundaryVisible,
    boundaryTransform: state.boundaryTransform,
    setBoundaryTransform: state.setBoundaryTransform,
  }));

  const isValidBufferState = useMemo(() => {
    const bufferKey = getBufferKey(primaryClipMetaDataRef.current);

    const originalBufferExists = processedBuffers.has(bufferKey);
    const hasAnyProcessedBuffer = processedBuffers.size > 0;

    return originalBufferExists && hasAnyProcessedBuffer;
  }, [processedBuffers]);

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
            <div className="w-72 rounded-md bg-primary shadow-md p-3 text-foreground">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{label}</span>
                <span className="text-[10px] tabular-nums text-foreground/70">
                  {percent}%
                </span>
              </div>
              <div className="w-full h-2 rounded bg-foreground/10 overflow-hidden">
                <div
                  className="h-full bg-foreground/70 transition-all duration-150"
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

  const originalPrimaryUrl = useMemo(() => {
    const originalBufferData = processedBuffers.get(getOriginalBufferKey());
    return originalBufferData?.url ?? clipData.url;
  }, [processedBuffers, clipData.url]);

  const adjustOverlayBounds = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    const trace = traceRef.current;

    if (!video || !container || !trace) return;

    // video.style.width = `${container.clientWidth}px`;

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

  const loadClipVideo = useCallback(
    async (settings: SettingsType): Promise<string | null> => {
      const video = videoRef.current;
      if (!video) return null;

      const bufferKey = getBufferKey(settings);
      const originalBufferData = processedBuffers.get(getOriginalBufferKey());

      if (!originalBufferData) {
        toast.error("Original clip not available");
        return null;
      }

      const existingBufferData = processedBuffers.get(bufferKey);
      if (existingBufferData) {
        primaryClipMetaDataRef.current = {
          ...primaryClipMetaDataRef.current,
          ...settings,
        };

        const blob = new Blob([existingBufferData.buffer], {
          type: "video/mp4",
        });
        const objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        return objectUrl;
      }

      const { aspectRatio, cropMode, padColor, format } = settings;

      try {
        const processedBlob = await withProgressToast<Blob>(
          "Processing clip",
          () =>
            processClip(
              originalBufferData.buffer,
              { aspectRatio, cropMode, padColor, format },
              primaryClipMetaDataRef.current.dimensions
            ),
          `process-${clipData.metadata.clipId}-${bufferKey}`
        );

        if (!processedBlob || processedBlob.size === 0) {
          toast.error("No valid clip data found");
          return null;
        }

        const processedBuffer = await processedBlob.arrayBuffer();

        setProcessedBuffers((prev) => {
          const updated = new Map(prev);
          updated.set(bufferKey, { buffer: processedBuffer, url: objectUrl });
          return updated;
        });

        primaryClipMetaDataRef.current = {
          ...primaryClipMetaDataRef.current,
          ...settings,
        };

        const objectUrl = URL.createObjectURL(processedBlob);
        video.src = objectUrl;
        return objectUrl;
      } catch (err) {
        const errorMsg = normalizeError(err).message;
        toast.error(`Failed to load clip: ${errorMsg}`);
        return null;
      }
    },
    [processedBuffers, clipData.metadata.clipId, withProgressToast]
  );

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
      const bufferKey = getBufferKey(primaryClipMetaDataRef.current);
      if (!clipData.url || processedBuffersRef.current.has(bufferKey)) return;

      abortController = new AbortController();

      try {
        const response = await fetch(clipData.url, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch clip: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();

        setProcessedBuffers((prev) => {
          const updated = new Map(prev);
          updated.set(bufferKey, { buffer, url: clipData.url });
          return updated;
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const errorMsg = normalizeError(err).message;
        toast.error(`Failed to load clip: ${errorMsg}`);
      }
    };

    convertUrlToBuffer();

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [clipData.url, clipData.metadata.clipId]);

  useEffect(() => {
    return () => {
      if (secondaryClip?.url) {
        URL.revokeObjectURL(secondaryClip.url);
      }
    };
  }, [secondaryClip?.url]);

  useEffect(() => {
    return () => {
      processedBuffersRef.current.forEach(({ url }) => {
        if (typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
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
      logger.log("Cleaning up video event listeners");
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
      window.removeEventListener("resize", adjustOverlayBounds);
    };
  }, [adjustOverlayBounds]);

  const addAudioTrack = () => {
    if (audioFileRef.current) {
      audioFileRef.current.click();
    }
  };

  const updateAudioTrack = (id: string, updates: Partial<AudioTrack>) => {
    setAudioTracks(
      audioTracks.map((track) =>
        track.id === id ? { ...track, ...updates } : track
      )
    );
  };

  const deleteAudioTrack = (id: string) => {
    setAudioTracks(audioTracks.filter((track) => track.id !== id));
  };

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
    const video = videoRef.current;

    const bufferKey = getBufferKey(primaryClipMetaDataRef.current);
    const bufferData = processedBuffers.get(bufferKey);

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
        audioTracks: audioTracks.filter((track) => track.visible),
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
            url: secondaryClip ? originalPrimaryUrl : primaryUrl,
            buffer: bufferData.buffer,
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

  const handleSettingsApplied = async (settings: SettingsType) => {
    closeAspectRatioModal();
    const videoUrl = await loadClipVideo(settings);
    if (videoUrl) setPrimaryUrl(videoUrl);
  };

  const handleTrim = (startTime: number, endTime: number) => {
    setPrimaryTrim((prev) => ({
      ...prev,
      trimStart: startTime,
      trimEnd: endTime,
    }));

    logger.log("Trimmed primary video from:", startTime, "to:", endTime);
  };

  const settings = useMemo(() => {
    const { dimensions, ...settings } = primaryClipMetaDataRef.current;
    return settings as SettingsType;
  }, [isAspectRatioModalOpen]);

  const primaryTrimData = primaryTrimRef.current;

  const primaryDurationMs =
    primaryTrimData &&
    (primaryTrimData.trimEnd !== 0 || primaryTrimData.trimStart !== 0)
      ? primaryTrimData.trimEnd - primaryTrimData.trimStart
      : duration;

  return (
    <div className="h-dvh bg-surface-primary text-foreground-default text-sm flex flex-col">
      <EditorHeader
        isVideoLoaded={isVideoLoaded}
        isExporting={isExporting}
        showTrace={showTrace}
        onToggleTrace={toggleTrace}
        onOpenExport={openExportNamingModal}
        onOpenAdjust={openAspectRatioModal}
        settings={settings}
        onSettingsApplied={handleSettingsApplied}
        isBufferDownloaded={isValidBufferState}
      />

      <div className="flex-1 min-h-0">
        <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
          <Keyframe.Root maxTime={duration} pxPerMs={0.05}>
            {({
              keyframes,
              currentKeyframeId,
              addKeyframe,
              updateKeyframe,
              deleteKeyframe,
              getKeyframe,
            }) => (
              <>
                <div className="w-full flex flex-col lg:flex-row items-center gap-4">
                  <div>
                    <div className="flex justify-start p-2">
                      <AspectRatioPicker
                        screenSize="16:9"
                        aspectRatio={boundaryAspectRatio}
                        onAspectRatioChange={setBoundaryAspectRatio}
                        visible={boundaryVisible}
                        onVisibleChange={setBoundaryVisible}
                        disabled={!isValidBufferState || isExporting}
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (boundaryTransform) {
                            addKeyframe({
                              time: videoRef.current?.currentTime
                                ? videoRef.current.currentTime * 1000
                                : 0,
                              transform: {
                                x: boundaryTransform.x,
                                y: boundaryTransform.y,
                                scale: boundaryTransform.scale,
                                normX: boundaryTransform.normX,
                                normY: boundaryTransform.normY,
                              },
                              easing: "ease-in-out",
                            });
                          }
                        }}
                        disabled={!boundaryTransform}
                        className="ml-2"
                      >
                        <Film className="mr-2" size={14} />
                        Add Keyframe
                      </Button>
                    </div>

                    <BoundaryBox
                      screenSize="16:9"
                      videoWidth={videoRef.current?.videoWidth || 1920}
                      videoHeight={videoRef.current?.videoHeight || 1080}
                      aspectRatio={boundaryAspectRatio as AspectRatio}
                      visible={boundaryVisible}
                      transform={boundaryTransform!}
                      onTransformChange={(transform) => {
                        // console.log("in here transform", transform);
                        setBoundaryTransform(transform);
                        if (currentKeyframeId) {
                          updateKeyframe(currentKeyframeId, {
                            transform: {
                              x: transform.x,
                              y: transform.y,
                              scale: transform.scale,
                              normX: transform.normX,
                              normY: transform.normY,
                            },
                          });
                        }
                      }}
                    >
                      <BoundaryBox.Container className="relative flex-1 min-w-0 bg-surface-secondary shadow-md">
                        <MediaPlayer.Root>
                          <MediaPlayer.Video
                            src={primaryUrl}
                            ref={(el) => {
                              videoRef.current = el;
                              setVideoRef(el);
                            }}
                            playsInline
                            className="w-full aspect-video"
                            poster={"/thumbnails/video-thumb-2.webp"}
                          />
                          <MediaPlayer.Loading />
                          <MediaPlayer.Error />
                          <MediaPlayer.VolumeIndicator />
                          <MediaPlayer.Controls>
                            <MediaPlayer.ControlsOverlay />
                            <MediaPlayer.Play />
                            <MediaPlayer.SeekBackward />
                            <MediaPlayer.SeekForward />
                            <MediaPlayer.Volume />
                            <MediaPlayer.Seek />
                            <MediaPlayer.Time />
                            <MediaPlayer.PlaybackSpeed />
                            <MediaPlayer.Loop />
                            <MediaPlayer.Captions />
                            <MediaPlayer.PiP />
                            <MediaPlayer.Fullscreen />
                            <MediaPlayer.Download />
                          </MediaPlayer.Controls>
                        </MediaPlayer.Root>

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
                    </BoundaryBox>
                  </div>

                  <DualVideoPlayer
                    isPrimaryVideoLoaded={isVideoLoaded}
                    primaryClip={{ ...clipData, url: originalPrimaryUrl }}
                    secondaryClip={secondaryClip}
                    duration={duration}
                  />
                </div>

                <div className="flex-1 min-h-0">
                  {secondaryClip ? (
                    <DualVideoTracks
                      primaryDurationMs={primaryDurationMs}
                      secondaryDurationMs={
                        secondaryClip.metadata.clipDurationMs
                      }
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
                    />
                  ) : isVideoLoaded ? (
                    <div className="relative">
                      <Timeline
                        duration={duration}
                        onTrim={handleTrim}
                        frames={primaryFrames}
                      />
                      <div
                        className="absolute inset-0 pointer-events-none"
                        data-timeline-track
                      >
                        <div className="relative h-full pointer-events-auto">
                          {keyframes.map((kf) => (
                            <Keyframe.Marker
                              key={kf.id}
                              keyframeId={kf.id}
                              color={
                                currentKeyframeId === kf.id
                                  ? "#ec4899"
                                  : "#3b82f6"
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <TimelineSkeleton />
                  )}
                </div>

                <Keyframe.Box>
                  <Keyframe.BoxHeader>
                    {currentKeyframeId &&
                      getKeyframe(currentKeyframeId) &&
                      `Keyframe @ ${(
                        getKeyframe(currentKeyframeId)!.time / 1000
                      ).toFixed(1)}s`}
                    <Keyframe.BoxClose />
                  </Keyframe.BoxHeader>
                  <Keyframe.BoxContent>
                    {currentKeyframeId && getKeyframe(currentKeyframeId) && (
                      <>
                        <div className="space-y-3">
                          <div>
                            <Label>X Position</Label>
                            <Input
                              type="number"
                              step={10}
                              value={
                                getKeyframe(currentKeyframeId)!.transform.x
                              }
                              onChange={(e) =>
                                updateKeyframe(currentKeyframeId, {
                                  transform: {
                                    ...getKeyframe(currentKeyframeId)!
                                      .transform,
                                    x: parseFloat(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>

                          <div>
                            <Label>Y Position</Label>
                            <Input
                              type="number"
                              step={10}
                              value={
                                getKeyframe(currentKeyframeId)!.transform.y
                              }
                              onChange={(e) =>
                                updateKeyframe(currentKeyframeId, {
                                  transform: {
                                    ...getKeyframe(currentKeyframeId)!
                                      .transform,
                                    y: parseFloat(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>

                          <div>
                            <Label>Scale</Label>
                            <Input
                              type="number"
                              min={0.1}
                              max={3}
                              step={0.1}
                              value={
                                getKeyframe(currentKeyframeId)!.transform.scale
                              }
                              onChange={(e) =>
                                updateKeyframe(currentKeyframeId, {
                                  transform: {
                                    ...getKeyframe(currentKeyframeId)!
                                      .transform,
                                    scale: parseFloat(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>

                          <div>
                            <Label>Normalized X</Label>
                            <Input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={
                                getKeyframe(currentKeyframeId)!.transform.normX
                              }
                              onChange={(e) =>
                                updateKeyframe(currentKeyframeId, {
                                  transform: {
                                    ...getKeyframe(currentKeyframeId)!
                                      .transform,
                                    normX: parseFloat(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>

                          <div>
                            <Label>Normalized Y</Label>
                            <Input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={
                                getKeyframe(currentKeyframeId)!.transform.normY
                              }
                              onChange={(e) =>
                                updateKeyframe(currentKeyframeId, {
                                  transform: {
                                    ...getKeyframe(currentKeyframeId)!
                                      .transform,
                                    normY: parseFloat(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>

                          <div>
                            <Label>Easing</Label>
                            <Select
                              value={getKeyframe(currentKeyframeId)!.easing}
                              onValueChange={(value) =>
                                updateKeyframe(currentKeyframeId, {
                                  easing: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select easing" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="linear">linear</SelectItem>
                                <SelectItem value="ease-in">ease-in</SelectItem>
                                <SelectItem value="ease-out">
                                  ease-out
                                </SelectItem>
                                <SelectItem value="ease-in-out">
                                  ease-in-out
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteKeyframe(currentKeyframeId)}
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
        side="right"
        disablePortal={false}
        triggerRef={triggerRef}
      >
        <EditorPanel.Portal>
          <EditorPanel.Content className="pb-[49px] w-[280px] h-[calc(100dvh-48px)] top-[48px] backdrop-blur-lg overflow-hidden">
            <EditorPanel.Header className="py-2 px-2 bg-background">
              <kbd className="px-2 py-0.5 bg-surface-tertiary rounded-sm text-foreground-default font-mono text-xs border border-gray-700/50">
                Shift+T
              </kbd>
              <EditorPanel.CloseButton />
            </EditorPanel.Header>
            <EditorPanel.Body className="p-0 h-full">
              <EditorRightPanel
                isVideoLoaded={isVideoLoaded}
                duration={duration}
                clipData={clipData}
                audioTracks={audioTracks}
                onAudioTrackUpdate={updateAudioTrack}
                onAudioTrackDelete={deleteAudioTrack}
                onAddAudioTrack={addAudioTrack}
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
