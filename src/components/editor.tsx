"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type {
  AudioTrack,
  ExportSettings,
  CropMode,
  ClipExportData,
  ClipMetadata,
  ExportClip,
  S3ClipData as ClipData,
  DualVideoClip,
  DualVideoSettings,
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
import { getVideoBoundingBox, getTargetVideoDimensions } from "@/utils/video";
import AspectRatioSelector from "./aspect-ratio-selector";
import { useDisclosure } from "@/hooks/use-disclosure";
import { DEFAULT_ASPECT_RATIO, DEFAULT_CROP_MODE } from "@/constants/app";
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
import { Button } from "./ui/button";
import { Settings } from "lucide-react";

interface ClipEditorProps {
  clipData: ClipData;
}

const ClipEditor = ({ clipData }: ClipEditorProps) => {
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [toolPanelOpen, setToolPanelOpen] = useState(false);

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

  const selectedConvertAspectRatio = useRef<string>(DEFAULT_ASPECT_RATIO);
  const selectedCropMode = useRef<CropMode>(DEFAULT_CROP_MODE);
  const padColorRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioFileRef = useRef<HTMLInputElement | null>(null);
  const trimRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const clipMetaDataRef = useRef<ClipMetadata | null>(null);
  const traceRef = useRef<HTMLDivElement>(null);

  const {
    textOverlaysRef,
    imageOverlaysRef,
    containerRef,
    secondaryContainerRef,
    setVideoRef,
    secondaryClip,
    dualVideoOffsetMs,
    dualVideoSettings,
    setDualVideoSettings,
    setSecondaryClip,
  } = useShallowSelector(OverlaysContext, (state) => ({
    containerRef: state.containerRef,
    secondaryContainerRef: state.secondaryContainerRef,
    textOverlaysRef: state.textOverlaysRef,
    imageOverlaysRef: state.imageOverlaysRef,
    setVideoRef: state.setVideoRef,
    dualVideoSettings: state.dualVideoSettings,
    dualVideoOffsetMs: state.dualVideoOffsetMs,
    secondaryClip: state.secondaryClip,
    setSecondaryClip: state.setSecondaryClip,
    setDualVideoSettings: state.setDualVideoSettings,
  }));

  const [showTrace, setShowTrace] = useState(false);
  const showTraceRef = useLatestValue(showTrace);

  const clipBufferRef = useRef<ArrayBuffer | null>(null);
  const currentVideoUrl = useRef<string | null>(null);

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
            <div className="w-72 rounded-md bg-primary/70 backdrop-blur-xl shadow-md p-3 text-foreground">
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
        const msg = normalizeError(e).message;
        toast.error(`${label} failed: ${msg}`);
        throw e;
      } finally {
        if (unsub) unsub();
      }
    },
    [clipData.metadata.clipId]
  );

  const adjustOverlayBounds = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    const trace = traceRef.current;

    if (!video || !container || !trace) return;

    video.style.width = `${container.clientWidth}px`;

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

  const loadClipVideo = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    const clipBuffer = clipBufferRef.current;
    if (!video || !clipBuffer) return null;

    logger.log("Loading clip video from buffer:", {
      clipId: clipData.metadata.clipId,
      hasBuffer: !!clipBuffer,
    });

    try {
      const processedBlob = await withProgressToast<Blob>(
        "Processing clip",
        () =>
          processClip(
            clipBuffer,
            {
              convertAspectRatio: selectedConvertAspectRatio.current,
              cropMode: selectedCropMode.current,
              ...(padColorRef.current ? { padColor: padColorRef.current } : {}),
            },
            clipMetaDataRef.current!.dimensions
          ),
        `process-${clipData.metadata.clipId}`
      );

      if (processedBlob && processedBlob.size > 0) {
        const objectUrl = URL.createObjectURL(processedBlob);
        video.src = objectUrl;
        logger.log("Set video src to blob URL:", objectUrl);
        return objectUrl;
      } else {
        logger.error("Failed to get valid clip blob:", { processedBlob });
        toast.error("No valid clip data found");
        return null;
      }
    } catch (err) {
      const errorMsg = normalizeError(err).message;
      logger.error("Error loading clip blob:", err);
      toast.error(`Failed to load clip: ${errorMsg}`);
      return null;
    }
  }, [clipData.metadata.clipId]);

  const initializeVideo = useCallback(async () => {
    const video = videoRef.current;
    const clipBuffer = clipBufferRef.current;
    if (!video || !clipBuffer) return null;

    setVideoRef(videoRef);
    let objectUrl: string | null = null;

    try {
      if (
        selectedConvertAspectRatio.current === DEFAULT_ASPECT_RATIO &&
        selectedCropMode.current === DEFAULT_CROP_MODE
      ) {
        const blob = new Blob([clipBuffer], { type: "video/mp4" });
        objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        logger.log(
          "Loaded video directly from buffer with default settings:",
          objectUrl
        );
      } else {
        objectUrl = await loadClipVideo();
      }
      return objectUrl;
    } catch (error) {
      logger.error("Error initializing video:", error);
      return null;
    }
  }, [loadClipVideo]);

  const handleAddSecondaryClip = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();

      const tempVideo = document.createElement("video");
      const tempUrl = URL.createObjectURL(file);
      tempVideo.src = tempUrl;

      const metadata: DualVideoClip["metadata"] = {
        clipId: `secondary_${Date.now()}`,
        clipDurationMs: 0,
        clipStartTime: 0,
        clipEndTime: 0,
        originalFilename: file.name,
      };

      const newSecondaryClip: DualVideoClip = {
        id: `secondary_${Date.now()}`,
        url: tempUrl,
        buffer,
        metadata,
        offset: 0,
        volume: 0.6,
        visible: true,
      };

      tempVideo.addEventListener("loadedmetadata", () => {
        const durationMs = tempVideo.duration * 1000;

        setSecondaryClip({
          ...newSecondaryClip,
          metadata: {
            ...newSecondaryClip.metadata,
            clipDurationMs: durationMs,
            clipEndTime: durationMs,
          },
        });
        toast.success("Secondary video clip added");
      });
    } catch (error) {
      logger.error("Error adding secondary clip:", error);
      toast.error("Failed to add secondary video clip");
    }
  }, []);

  const handleSecondaryClipChange = useCallback(
    (clip: DualVideoClip | null) => {
      if (secondaryClip?.url && secondaryClip.url !== clip?.url) {
        URL.revokeObjectURL(secondaryClip.url);
      }
      setSecondaryClip(clip);
    },
    [secondaryClip?.url]
  );

  const handleDualVideoSettingsChange = useCallback(
    (settings: DualVideoSettings) => {
      setDualVideoSettings(settings);
    },
    []
  );

  const primaryFrames = useVideoThumbnails(
    videoRef.current?.src || undefined,
    24,
    isVideoLoaded
  );
  const secondaryFrames = useVideoThumbnails(
    secondaryClip?.url,
    24,
    Boolean(secondaryClip?.url)
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t") {
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
      if (!clipData.url) return;

      abortController = new AbortController();

      try {
        logger.log("Converting URL to buffer:", {
          clipId: clipData.metadata.clipId,
          url: clipData.url,
        });

        const response = await fetch(clipData.url, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch clip: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        clipBufferRef.current = buffer;

        logger.log("Successfully converted URL to buffer:", {
          clipId: clipData.metadata.clipId,
          bufferSize: buffer.byteLength,
        });

        const videoUrl = await initializeVideo();
        currentVideoUrl.current = videoUrl;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          logger.log("Buffer conversion aborted");
          return;
        }

        const errorMsg = normalizeError(err).message;
        logger.error("Error converting URL to buffer:", err);
        toast.error(`Failed to load clip: ${errorMsg}`);
      } finally {
      }
    };

    if (!clipBufferRef.current) {
      convertUrlToBuffer();
    }

    return () => {
      if (abortController) {
        abortController.abort();
      }

      if (currentVideoUrl.current) {
        URL.revokeObjectURL(currentVideoUrl.current);
        currentVideoUrl.current = null;
      }
    };
  }, [clipData.url, clipData.metadata.clipId, initializeVideo]);

  useEffect(() => {
    return () => {
      if (secondaryClip?.url) {
        URL.revokeObjectURL(secondaryClip.url);
      }
    };
  }, [secondaryClip?.url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setIsVideoLoaded(true);
      setDuration(video.duration * 1000);
      adjustOverlayBounds();

      clipMetaDataRef.current = {
        aspectRatio: selectedConvertAspectRatio.current,
        cropMode: selectedCropMode.current,
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
    }: Pick<
      ExportSettings,
      | "preset"
      | "crf"
      | "fps"
      | "format"
      | "resolution"
      | "bitrate"
      | "customBitrateKbps"
    >
  ) => {
    const video = videoRef.current;

    if (!video || !clipMetaDataRef.current || !clipBufferRef.current) return;

    setIsExporting(true);

    const promise = new Promise<string>(async (resolve, reject) => {
      try {
        const { width: clientWidth, height: clientHeight } =
          getVideoBoundingBox(video);
        const clientDisplaySize = { width: clientWidth, height: clientHeight };

        const videoAspectRatio =
          clipMetaDataRef.current!.dimensions.width /
          clipMetaDataRef.current!.dimensions.height;
        const targetResolutionDimensions = getTargetVideoDimensions(
          resolution!,
          videoAspectRatio
        );

        console.log("export ----------------");

        const exportData: ClipExportData = {
          id: clipData.metadata.clipId,
          startTime: trimRef.current.start || 0,
          endTime: trimRef.current.end || duration,
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
            convertAspectRatio: selectedConvertAspectRatio.current,
            cropMode: selectedCropMode.current,
          },
          clientDisplaySize,
          targetResolution: targetResolutionDimensions,
          ...(secondaryClip && {
            dualVideo: {
              primaryClip: {
                id: clipData.metadata.clipId,
                url: clipData.url,
                buffer: clipBufferRef.current,
                metadata: clipData.metadata,
                offset: 0,
                volume: 1,
                visible: true,
              },
              secondaryClip,
              settings: dualVideoSettings,
            },
          }),
        };

        const exportClip: ExportClip = {
          blob: clipBufferRef.current!,
          metadata: clipMetaDataRef.current,
        };

        console.log({ exportClip, exportData });

        const processedBlob = await withProgressToast<Blob>(
          "Exporting clip",
          () => processClipForExport(exportClip, exportData),
          `export-${clipData.metadata.clipId}`
        );

        console.log("export", processedBlob);

        const downloadUrl = URL.createObjectURL(processedBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${outputName}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        closeAspectRatioModal();
        resolve(`Downloaded ${outputName}.${format}`);
      } catch (error) {
        logger.error("Export error:", error);
        reject(error);
      } finally {
        setIsExporting(false);
      }
    });

    toast.promise(promise, {
      loading: "Exporting clip...",
      success: (message) => {
        return message;
      },
      error: (err) => {
        const normalizedError = normalizeError(err);
        return `Export failed: ${normalizedError.message}`;
      },
      id: clipData.metadata.clipId,
    });
  };

  const handleSettingsApplied = (
    aspectRatio: string,
    cropMode: CropMode,
    padColor: string
  ) => {
    selectedConvertAspectRatio.current = aspectRatio;
    selectedCropMode.current = cropMode;
    padColorRef.current = padColor;
    closeAspectRatioModal();
    loadClipVideo();
  };

  const handleTrim = (startTime: number, endTime: number) => {
    trimRef.current = { start: startTime, end: endTime };
    logger.log("Trimmed video from:", startTime, "to:", endTime);
  };

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  }, []);

  return (
    <div className="h-dvh bg-surface-primary text-foreground-default text-sm flex flex-col">
      <EditorHeader
        isVideoLoaded={isVideoLoaded}
        isExporting={isExporting}
        showTrace={showTrace}
        onToggleTrace={toggleTrace}
        onOpenAdjust={openAspectRatioModal}
        onOpenExport={openExportNamingModal}
      />

      <div className="flex-1 min-h-0">
        <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
          <div className="w-full flex flex-col lg:flex-row items-center gap-4">
            {/* 16:9 primary player (original) */}
            <div
              data-container-context="primary"
              ref={containerRef}
              className="relative flex-1 min-w-0 aspect-video flex items-center justify-center overflow-hidden rounded-lg bg-surface-secondary shadow-md"
            >
              <MediaPlayer.Root>
                <MediaPlayer.Video
                  ref={videoRef}
                  playsInline
                  className="w-full aspect-video"
                  poster={"/thumbnails/video-thumb-2.webp"}
                  // onTimeUpdate={handleTimeUpdate}
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
            </div>

            {/* 9:16 dual preview */}
            <div
              data-container-context="dual"
              ref={secondaryContainerRef}
              className="relative flex items-center aspect-[9/16] w-[260px] justify-center overflow-hidden rounded-lg bg-surface-secondary shadow-md"
            >
              <DualVideoPlayer
                primaryClip={clipData}
                secondaryClip={secondaryClip}
                offsetMs={dualVideoOffsetMs}
                className="w-full"
                primarySrc={currentVideoUrl.current || undefined}
                currentTime={currentTime}
              />

              <PersistentOverlays duration={duration} isDualVideo />
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {secondaryClip ? (
              <DualVideoTracks
                primaryDurationMs={duration}
                secondaryDurationMs={secondaryClip.metadata.clipDurationMs}
                initialOffsetMs={dualVideoOffsetMs}
                primaryPreviewFrames={primaryFrames}
                secondaryPreviewFrames={secondaryFrames}
              />
            ) : isVideoLoaded ? (
              <Timeline
                duration={duration}
                onTrim={handleTrim}
                frames={primaryFrames}
              />
            ) : (
              <TimelineSkeleton />
            )}
          </div>
        </div>
      </div>

      <AspectRatioSelector
        isOpen={isAspectRatioModalOpen}
        onOpenChange={closeAspectRatioModal}
        onSettingsApplied={handleSettingsApplied}
      />

      <ExportNamingDialog
        isOpen={isExportNamingModalOpen}
        onOpenChange={closeExportNamingModal}
        streamerName={clipData.metadata.streamerName}
        onExport={handleExport}
      />

      <EditorPanel.Root
        open={toolPanelOpen}
        onOpenChange={setToolPanelOpen}
        side="right"
        disablePortal={false}
      >
        <EditorPanel.Portal>
          <EditorPanel.Content className="w-[300px] h-[calc(100dvh-48px)] top-[48px] backdrop-blur-lg overflow-hidden">
            <EditorPanel.Header className="py-2 px-2 bg-background">
              <div className="pointer-events-none" />
              <EditorPanel.CloseButton size="sm" />
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
                secondaryClip={secondaryClip}
                dualVideoSettings={dualVideoSettings}
                onSecondaryClipChange={handleSecondaryClipChange}
                onDualVideoSettingsChange={handleDualVideoSettingsChange}
                onAddSecondaryClip={handleAddSecondaryClip}
              />
            </EditorPanel.Body>
          </EditorPanel.Content>
        </EditorPanel.Portal>
      </EditorPanel.Root>

      <Button
        type="button"
        onClick={() => setToolPanelOpen(true)}
        className="fixed bottom-4 right-4 z-40 shadow-lg hover:shadow-xl hover:scale-105 transition-transform duration-200 ease-in-out"
        size="sm"
        variant="default"
        aria-label="Open Tools (T)"
      >
        <Settings size={14} className="mr-2" />
        Tools
      </Button>
    </div>
  );
};

export default ClipEditor;
