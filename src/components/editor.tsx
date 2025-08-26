"use client";

import React, {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
  startTransition,
} from "react";
import Image from "next/image";
import {
  Download,
  Settings,
  Type,
  Music,
  Scissors,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Crosshair,
} from "lucide-react";
import {
  AudioTrack,
  ExportSettings,
  CropMode,
  ClipExportData,
  ClipMetadata,
  ExportClip,
  S3ClipData as ClipData,
} from "@/types/app";
import { toast } from "sonner";
import { normalizeError } from "@/utils/error-utils";
import { processClip, processClipForExport } from "@/utils/ffmpeg";
import logger from "@/utils/logger";
import { DraggableTextOverlay } from "./draggable-text-overlay";
import { DraggableImageOverlay } from "./draggable-image-overlay";
import { FileUpload } from "./ui/file-upload";
import * as MediaPlayer from "@/components/ui/media-player";
import { getVideoBoundingBox, getTargetVideoDimensions } from "@/utils/video";
import AspectRatioSelector from "./aspect-ratio-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDisclosure } from "@/hooks/use-disclosure";
import { DEFAULT_ASPECT_RATIO, DEFAULT_CROP_MODE } from "@/constants/app";
import Timeline from "@/components/timeline";
import { TimelineSkeleton } from "@/components/timeline-skeleton";
import { ExportNamingDialog } from "@/components/export-naming-dialog";
import { useLatestValue } from "@/hooks/use-latest-value";
import { EditPageSkeleton } from "@/components/edit-skeleton";
import TextOverlayItemContainer from "./text-overlay-item";
import { useOverlayControls } from "@/contexts/overlays-context";
import ImageOverlayItemContainer from "./image-overlay-item";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ClipEditorProps {
  clipData: ClipData;
}

type ClipToolType = "clips" | "text" | "image" | "audio";

const ClipEditor = ({ clipData }: ClipEditorProps) => {
  const [duration, setDuration] = useState(0);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<ClipToolType>("clips");
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioFileRef = useRef<HTMLInputElement | null>(null);
  const trimRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const clipMetaDataRef = useRef<ClipMetadata | null>(null);
  const traceRef = useRef<HTMLDivElement>(null);

  const {
    selectedOverlay,
    addTextOverlay,
    addImageOverlay,
    getAllVisibleOverlays,
    containerRef,
    startDrag,
    startResize,
    setVideoRef,
    textOverlaysRef,
    imageOverlaysRef,
  } = useOverlayControls();

  const [showTrace, setShowTrace] = useState(false);
  const showTraceRef = useLatestValue(showTrace);

  const clipBufferRef = useRef<ArrayBuffer | null>(null);
  const currentVideoUrl = useRef<string | null>(null);

  const toggleTrace = useCallback(() => {
    setShowTrace((v) => {
      console.log("trace", { v });
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
      const processedBlob = await processClip(clipBuffer, {
        convertAspectRatio: selectedConvertAspectRatio.current,
        cropMode: selectedCropMode.current,
      });

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
    console.log("here now", videoRef.current);
    const video = videoRef.current;
    const clipBuffer = clipBufferRef.current;
    if (!video || !clipBuffer) return null;

    console.log("us noe");

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

        console.log({ response });

        if (!response.ok) {
          console.log("here....", response);
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

    convertUrlToBuffer();

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
    const video = videoRef.current;
    console.log("mearnt to sync write", video);
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

      logger.log("📹 Video metadata loaded:", {
        durationMs: video.duration * 1000,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        videoSrc: video.currentSrc,
      });

      logger.log("🧱 Rendered video element dimensions:", {
        clientWidth: video.clientWidth,
        clientHeight: video.clientHeight,
      });
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

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(
        seconds % 60
      )
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  const addAudioTrack = () => {
    if (audioFileRef.current) {
      audioFileRef.current.click();
    }
  };

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newTrack: AudioTrack = {
      id: `audio_${Date.now()}`,
      name: file.name,
      file,
      volume: 1,
      startTime: 0,
      endTime: duration,
      visible: true,
    };
    setAudioTracks([...audioTracks, newTrack]);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    addImageOverlay(file, 0, duration);
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
            convertAspectRatio: selectedConvertAspectRatio.current || undefined,
            cropMode: selectedCropMode.current,
          },
          clientDisplaySize,
          targetResolution: targetResolutionDimensions,
        };

        const exportClip: ExportClip = {
          blob: clipBufferRef.current!,
          metadata: clipMetaDataRef.current,
        };

        const processedBlob = await processClipForExport(
          exportClip,
          exportData
        );

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

  const handleSettingsApplied = (aspectRatio: string, cropMode: CropMode) => {
    selectedConvertAspectRatio.current = aspectRatio;
    selectedCropMode.current = cropMode;
    closeAspectRatioModal();
    loadClipVideo();
  };

  const handleTrim = (startTime: number, endTime: number) => {
    trimRef.current = { start: startTime, end: endTime };
    logger.log("Trimmed video from:", startTime, "to:", endTime);
  };

  return (
    <div className="flex flex-col h-screen bg-surface-primary text-foreground-default text-sm">
      <div className="max-w-screen-xl mx-auto w-full">
        <div className="flex items-center relative justify-between p-4 bg-surface-secondary border-b border-gray-700/50">
          <Link href="/">
            <Image
              src="/logo/zinc_norms_white.webp"
              alt="Zinc"
              width={128}
              height={128}
              className="h-20 w-20 absolute top-2/4 -translate-y-2/4 text-white"
              priority
            />
          </Link>
          <div />
          <div className="flex items-center space-x-2">
            <Button
              className="flex items-center space-x-2 px-3 py-1.5 text-xs"
              variant="outline"
              onClick={() => openAspectRatioModal()}
            >
              <Settings size={16} />
              <span>Settings</span>
            </Button>

            <Button
              onClick={() => openExportNamingModal()}
              disabled={isExporting}
              className="flex items-center space-x-2 px-3 py-1.5 text-xs"
            >
              <Download size={16} />
              <span>{isExporting ? "Exporting..." : "Export"}</span>
            </Button>
            <Button
              className="flex items-center space-x-2 px-3 py-1.5 text-xs"
              variant="outline"
              onClick={toggleTrace}
            >
              <Crosshair size={16} />
              <span>{showTrace ? "Hide Trace" : "Show Trace"}</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col p-4 space-y-4 overflow-hidden pb-16">
          <div
            ref={containerRef}
            className="relative w-full aspect-video flex items-center justify-center overflow-hidden rounded-lg bg-surface-secondary shadow-md border border-gray-700/50"
          >
            <MediaPlayer.Root>
              <MediaPlayer.Video
                ref={videoRef}
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

            {getAllVisibleOverlays()
              .textOverlays.filter(
                (overlay) =>
                  overlay.startTime === 0 && overlay.endTime >= duration
              )
              .map((overlay) => (
                <DraggableTextOverlay
                  key={`persistent-${overlay.id}`}
                  overlay={overlay}
                  isSelected={selectedOverlay === overlay.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startDrag(overlay.id, e);
                  }}
                />
              ))}

            {getAllVisibleOverlays()
              .imageOverlays.filter(
                (overlay) =>
                  overlay.startTime === 0 && overlay.endTime >= duration
              )
              .map((overlay) => (
                <DraggableImageOverlay
                  key={`persistent-${overlay.id}`}
                  overlay={overlay}
                  isSelected={selectedOverlay === overlay.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startDrag(overlay.id, e);
                  }}
                  onResizeStart={(handle, e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startResize(overlay.id, handle, e);
                  }}
                />
              ))}
          </div>

          {isVideoLoaded ? (
            <Timeline duration={duration} onTrim={handleTrim} />
          ) : (
            <TimelineSkeleton />
          )}

          <div className="flex-1 flex flex-col bg-surface-primary rounded-lg shadow-md overflow-hidden border border-gray-700/50">
            <div className="flex border-b border-gray-700/50">
              {[
                { id: "clips", label: "Clips", icon: Scissors },
                { id: "text", label: "Text", icon: Type },
                { id: "image", label: "Image", icon: Eye },
                { id: "audio", label: "Audio", icon: Music },
              ].map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  onClick={() =>
                    startTransition(() => setActiveTab(id as ClipToolType))
                  }
                  className={cn(
                    "flex-1 py-2 px-1 flex items-center justify-center space-x-1.5 rounded-none text-xs transition-colors",
                    activeTab === id
                      ? "bg-primary text-foreground-on-accent border-b-2 border-primary"
                      : "text-foreground-subtle hover:text-foreground-default hover:bg-surface-hover"
                  )}
                  variant="ghost"
                  disabled={!isVideoLoaded}
                >
                  <Icon size={16} />
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "clips" && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-foreground-default">
                    Clip
                  </h3>
                  {[
                    {
                      id: clipData.metadata.clipId,
                      startTime: clipData.metadata.clipStartTime,
                      endTime: clipData.metadata.clipEndTime,
                    },
                  ].map((clip) => (
                    <div key={clip.id}>
                      <div className="font-medium text-foreground-default text-sm">{`Clip ${clip.id}`}</div>
                      <div className="text-xs text-foreground-subtle">
                        {formatTime(clip.endTime - clip.startTime)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "text" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground-default">
                      Text Overlays
                    </h3>
                    <Button
                      onClick={() => addTextOverlay(0, duration)}
                      className="p-1.5"
                      variant="default"
                      size="icon"
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                  <TextOverlayItemContainer
                    selectedOverlay={selectedOverlay}
                    duration={duration}
                  />
                </div>
              )}

              {activeTab === "image" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground-default">
                      Image Overlays
                    </h3>
                  </div>

                  <FileUpload
                    accept="image/*"
                    hint="Select an image to add as overlay"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageFileSelect(e);
                      }
                    }}
                    name="image-overlay"
                  />

                  <ImageOverlayItemContainer
                    selectedOverlay={selectedOverlay}
                    duration={duration}
                  />
                </div>
              )}

              {activeTab === "audio" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground-default">
                      Audio Tracks
                    </h3>
                    <Button
                      onClick={addAudioTrack}
                      className="p-1.5"
                      variant="default"
                      size="icon"
                    >
                      <Plus size={16} />
                    </Button>
                  </div>

                  <Input
                    ref={audioFileRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioFileSelect}
                    className="hidden"
                  />

                  {audioTracks.map((track) => (
                    <div
                      key={track.id}
                      className="p-3 rounded-lg border border-gray-700/50 bg-surface-secondary"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium truncate text-foreground-default text-sm">
                          {track.name}
                        </span>
                        <div className="flex items-center space-x-1">
                          <Button
                            onClick={() =>
                              updateAudioTrack(track.id, {
                                visible: !track.visible,
                              })
                            }
                            className={cn(
                              "p-1 rounded",
                              track.visible
                                ? "text-accent-primary"
                                : "text-foreground-muted"
                            )}
                            variant="ghost"
                            size="icon"
                          >
                            {track.visible ? (
                              <Eye size={14} />
                            ) : (
                              <EyeOff size={14} />
                            )}
                          </Button>
                          <Button
                            onClick={() => deleteAudioTrack(track.id)}
                            className="p-1 text-error hover:text-error/80"
                            variant="ghost"
                            size="icon"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-foreground-subtle mb-1">
                            Volume
                          </label>
                          <Input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={track.volume}
                            onChange={(e) =>
                              updateAudioTrack(track.id, {
                                volume: parseFloat(e.target.value),
                              })
                            }
                            className="h-7"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-foreground-subtle mb-1">
                              Start Time
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max={duration}
                              value={Math.floor(track.startTime / 1000)}
                              onChange={(e) =>
                                updateAudioTrack(track.id, {
                                  startTime: parseInt(e.target.value) * 1000,
                                })
                              }
                              className="px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-foreground-subtle mb-1">
                              End Time
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max={duration}
                              value={Math.floor(track.endTime / 1000)}
                              onChange={(e) =>
                                updateAudioTrack(track.id, {
                                  endTime: parseInt(e.target.value) * 1000,
                                })
                              }
                              className="px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
          streamerName={clipData.metadata.streamerName || ""}
          onExport={handleExport}
        />
      </div>
    </div>
  );
};

export default ClipEditor;
