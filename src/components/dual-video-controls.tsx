"use client";

import React, { useState, useCallback } from "react";
import {
  Video,
  Settings,
  Trash2,
  Maximize2,
  Crop,
  PictureInPicture,
  Volume2,
  VolumeX,
  Volume1,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";
import { Volume } from "./volume";
import { Switch } from "@/components/ui/switch";
import type {
  DualVideoClip,
  DualVideoSettings,
  DualVideoLayout,
  AudioMixMode,
  S3ClipData,
  VideoFormat,
  CropMode,
  TrimData,
} from "@/types/app";
import type { AspectRatio } from "@/utils/aspect-ratios";
import { toast } from "sonner";
import { useShallowSelector } from "react-shallow-store";
import logger from "@/utils/logger";
import { ClipContext } from "@/contexts/clip-context";
import {
  DEFAULT_ASPECT_RATIO,
  DEFAULT_COLOR,
  DEFAULT_CROP_MODE,
} from "@/constants/app";
import { DEFAULT_DUAL_VIDEO_SETTINGS } from "@/contexts/clip-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getSecondaryClipId, getStorageKey } from "@/utils/app";
import type { HistoryState } from "./dual-video-tracks";

interface DualVideoControlsProps {
  primaryClip: S3ClipData;
  disabled?: boolean;
  isBufferDownloaded?: boolean;
}

const layoutOptions = [
  {
    value: "vertical-letterbox" as DualVideoLayout,
    label: "Vertical Letterbox",
    description: "Stacks videos with black bars",
    icon: <Maximize2 size={14} />,
  },
  {
    value: "vertical-crop" as DualVideoLayout,
    label: "Vertical Crop",
    description: "Stacks videos filling container",
    icon: <Crop size={14} />,
  },
  {
    value: "pip" as DualVideoLayout,
    label: "Picture-in-Picture",
    description: "Secondary overlays primary",
    icon: <PictureInPicture size={14} />,
  },
];

const audioModeOptions = [
  {
    value: "primary" as AudioMixMode,
    label: "Primary Audio Only",
    icon: <Volume2 size={14} />,
  },
  {
    value: "secondary" as AudioMixMode,
    label: "Secondary Audio Only",
    icon: <Volume1 size={14} />,
  },
  {
    value: "mixed" as AudioMixMode,
    label: "Mixed Audio",
    icon: <VolumeX size={14} />,
  },
];

const pipAspectRatioOptions = [
  {
    value: "16:9" as AspectRatio,
    label: "16:9",
    description: "Widescreen",
  },
  {
    value: "9:16" as AspectRatio,
    label: "9:16",
    description: "Portrait",
  },
  {
    value: "1:1" as AspectRatio,
    label: "1:1",
    description: "Square",
  },
  {
    value: "4:3" as AspectRatio,
    label: "4:3",
    description: "Standard",
  },
  {
    value: "3:4" as AspectRatio,
    label: "3:4",
    description: "Portrait Standard",
  },
  {
    value: "21:9" as AspectRatio,
    label: "21:9",
    description: "Ultra-wide",
  },
];

export default function DualVideoControls({
  primaryClip,
  disabled = false,
  isBufferDownloaded = false,
}: DualVideoControlsProps) {
  const {
    videoId,
    secondaryClip,
    dualVideoSettings: settings,
    onSecondaryClipChange,
    onSettingsChange,
    setSecondaryClip,
    setSecondaryTrim,
  } = useShallowSelector(ClipContext, (state) => ({
    videoId: state.videoId,
    secondaryClip: state.secondaryClip,
    dualVideoSettings: state.dualVideoSettings,
    onSecondaryClipChange: state.setSecondaryClip,
    onSettingsChange: state.setDualVideoSettings,
    setSecondaryClip: state.setSecondaryClip,
    setSecondaryTrim: state.setSecondaryTrim,
  }));

  const [isExpanded, setIsExpanded] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    const secondaryClipId = getSecondaryClipId(`${videoId}_${file.name}`);

    try {
      const tempVideo = document.createElement("video");
      const tempUrl = URL.createObjectURL(file);
      tempVideo.src = tempUrl;

      const metadata: DualVideoClip["metadata"] = {
        clipId: secondaryClipId,
        clipDurationMs: 0,
        clipStartTime: 0,
        clipEndTime: 0,
        originalFilename: file.name,
      };

      const newSecondaryClip: DualVideoClip = {
        id: secondaryClipId,
        url: tempUrl,
        metadata,
        visible: true,
        trimStart: 0,
        trimEnd: 0,
        timelineOffset: 0,
      };

      const handleMetadata = () => {
        const aspect = tempVideo.videoWidth / tempVideo.videoHeight;
        if (Math.abs(aspect - 16 / 9) > 0.01) {
          toast.warning("Secondary video must have an aspect ratio of 16:9");
          URL.revokeObjectURL(tempUrl);
          return;
        }

        const durationMs = tempVideo.duration * 1000;
        setSecondaryClip({
          ...newSecondaryClip,
          trimEnd: durationMs,
          metadata: {
            ...newSecondaryClip.metadata,
            clipDurationMs: durationMs,
            clipEndTime: durationMs,
          },
          dimensions: {
            width: tempVideo.videoWidth,
            height: tempVideo.videoHeight,
          },
          aspectRatio: DEFAULT_ASPECT_RATIO,
          cropMode: DEFAULT_CROP_MODE as CropMode,
          format: file.type.split("/")[1] as VideoFormat,
          padColor: DEFAULT_COLOR,
        });

        let trimData: TrimData = {
          trimStart: 0,
          trimEnd: durationMs,
          timelineOffset: 0,
        };

        try {
          const key = getStorageKey(`${secondaryClipId}:dual-video-history`);
          const saved = localStorage.getItem(key);

          if (saved) {
            const parsed = JSON.parse(saved) as Array<HistoryState>;

            const lastCutState = [...parsed]
              .reverse()
              .find((state) => state.action === "cut");

            if (
              lastCutState &&
              lastCutState.cutTrimStart !== undefined &&
              lastCutState.cutTrimEnd !== undefined
            ) {
              trimData.trimStart = lastCutState.cutTrimStart;
              trimData.trimEnd = lastCutState.cutTrimEnd;
            }

            const lastStateWithOffset = [...parsed]
              .reverse()
              .find(
                (state) =>
                  state.trackOffset !== undefined && state.trackOffset !== 0
              );

            if (
              lastStateWithOffset &&
              lastStateWithOffset.trackOffset !== undefined
            ) {
              trimData.timelineOffset = lastStateWithOffset.trackOffset;
            }

            logger.log("Loaded secondary clip history:", {
              trimData,
              lastCutState,
              lastStateWithOffset,
            });
          }
        } catch (error) {
          logger.error("Failed to load secondary clip history:", error);
        }

        setSecondaryTrim(trimData);
        toast.success("Secondary video clip added");

        tempVideo.removeEventListener("loadedmetadata", handleMetadata);
      };

      tempVideo.addEventListener("loadedmetadata", handleMetadata);
    } catch (error) {
      logger.error("Error adding secondary clip:", error);
      toast.error("Failed to add secondary video clip");
    }
  };

  const updateSetting = <K extends keyof DualVideoSettings>(
    key: K,
    value: DualVideoSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  if (!secondaryClip) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <FileUpload
            accept="video/*"
            hint="Add a second video clip"
            onChange={handleFileSelect}
            name="secondary-video"
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Settings size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onSecondaryClipChange(null);
              onSettingsChange(DEFAULT_DUAL_VIDEO_SETTINGS);
            }}
          >
            <Trash2 size={14} className="text-error" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <div className="p-3 rounded-3xl bg-surface-secondary cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center space-x-2">
                  <Video size={14} className="text-foreground-subtle" />
                  <span className="text-sm md:text-[0.8rem] font-medium text-foreground-default truncate">
                    {primaryClip.metadata.originalFilename || "Primary Clip"}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-foreground-subtle">
                    Primary
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {isBufferDownloaded && (
                    <Check size={12} className="text-green-400" />
                  )}
                </div>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="flex flex-col gap-2">
              <div className="text-sm md:text-[0.8rem] tracking-tight font-medium text-foreground-default truncate">
                {primaryClip.metadata.originalFilename || "Primary Clip"}
              </div>
              <div className="text-[11px] tracking-wide text-foreground-subtle">
                Duration:{" "}
                {Math.round(
                  (primaryClip.metadata.clipEndTime -
                    primaryClip.metadata.clipStartTime) /
                    1000
                )}
                s
              </div>
              <div className="text-[11px] tracking-wide text-foreground-subtle">
                ID: {primaryClip.metadata.clipId}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <div className="p-3 rounded-3xl bg-surface-secondary cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center space-x-2">
                    <Video size={14} className="text-foreground-subtle" />
                    <span className="text-sm md:text-[0.8rem] font-medium text-foreground-default truncate">
                      {secondaryClip.metadata.originalFilename ||
                        "Secondary Clip"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-foreground-subtle">
                      Secondary
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Check size={12} className="text-green-400" />
                  </div>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="flex flex-col gap-2">
                <div className="text-sm md:text-[0.8rem] tracking-tight font-medium text-foreground-default truncate">
                  {secondaryClip.metadata.originalFilename || "Secondary Clip"}
                </div>
                <div className="text-[11px] tracking-wide text-foreground-subtle">
                  Duration:{" "}
                  {Math.round(
                    (secondaryClip.metadata.clipEndTime -
                      secondaryClip.metadata.clipStartTime) /
                      1000
                  )}
                  s
                </div>
                <div className="text-[11px] tracking-wide text-foreground-subtle">
                  ID: {secondaryClip.metadata.clipId}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="settings-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-2 border-t border-surface-tertiary">
                <div className="flex flex-col gap-3">
                  <label className="text-sm md:text-[0.8rem] text-foreground-subtle">
                    Layout
                  </label>
                  <Select
                    value={settings.layout}
                    onValueChange={(value: DualVideoLayout) =>
                      updateSetting("layout", value)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {
                          layoutOptions.find(
                            (option) => option.value === settings.layout
                          )?.label
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {layoutOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center space-x-2">
                            {option.icon}
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              <span className="text-sm md:text-[0.8rem] text-foreground-muted">
                                {option.description}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {settings.layout === "pip" && (
                  <div className="flex flex-col gap-3">
                    <label className="text-sm md:text-[0.8rem] text-foreground-subtle">
                      PiP Aspect Ratio
                    </label>
                    <Select
                      value={settings.pipAspectRatio || "16:9"}
                      onValueChange={(value: AspectRatio) =>
                        updateSetting("pipAspectRatio", value)
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pipAspectRatioOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center space-x-2">
                              <span>{option.label}</span>
                              <span className="text-sm md:text-[0.8rem] text-foreground-muted">
                                {option.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <label className="text-sm md:text-[0.8rem] text-foreground-subtle">
                    Audio Mode
                  </label>
                  <Select
                    value={settings.primaryAudio}
                    onValueChange={(value: AudioMixMode) =>
                      updateSetting("primaryAudio", value)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {
                          audioModeOptions.find(
                            (option) => option.value === settings.primaryAudio
                          )?.label
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {audioModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center space-x-2">
                            {option.icon}
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Volume.Root
                  value={settings.primaryVolume}
                  onValueChange={(volume) =>
                    updateSetting("primaryVolume", volume)
                  }
                >
                  <Volume.Label className="mb-3">
                    Primary Volume:{" "}
                    <span className="font-bold text-foreground-default">
                      {Math.round(settings.primaryVolume * 100)}%
                    </span>
                  </Volume.Label>
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

                <Volume.Root
                  value={settings.secondaryVolume}
                  onValueChange={(volume) =>
                    updateSetting("secondaryVolume", volume)
                  }
                >
                  <Volume.Label className="mb-3">
                    Secondary Volume:{" "}
                    <span className="font-bold text-foreground-default">
                      {Math.round((settings.secondaryVolume || 0.6) * 100)}%
                    </span>
                  </Volume.Label>
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

                <div className="flex items-center space-x-2">
                  <Switch
                    id="normalizeAudio"
                    checked={settings.normalizeAudio}
                    onCheckedChange={(value) =>
                      updateSetting("normalizeAudio", value)
                    }
                    disabled={disabled}
                  />
                  <label
                    htmlFor="normalizeAudio"
                    className="text-sm md:text-[0.8rem] text-foreground-subtle"
                  >
                    Normalize Audio
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
