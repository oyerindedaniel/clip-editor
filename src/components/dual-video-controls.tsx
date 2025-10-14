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
  DualVideoOrientation,
  PiPPosition,
  AudioMixMode,
  S3ClipData,
  VideoFormat,
  CropMode,
} from "@/types/app";
import { toast } from "sonner";
import { useShallowSelector } from "react-shallow-store";
import logger from "@/utils/logger";
import { ClipContext } from "@/contexts/clip-context";
import {
  DEFAULT_ASPECT_RATIO,
  DEFAULT_COLOR,
  DEFAULT_CROP_MODE,
} from "@/constants/app";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

const pipPositionOptions = [
  { value: "top-left" as PiPPosition, label: "Top Left" },
  { value: "top-right" as PiPPosition, label: "Top Right" },
  { value: "bottom-left" as PiPPosition, label: "Bottom Left" },
  { value: "bottom-right" as PiPPosition, label: "Bottom Right" },
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

export default function DualVideoControls({
  primaryClip,
  disabled = false,
  isBufferDownloaded = false,
}: DualVideoControlsProps) {
  const {
    secondaryClip,
    dualVideoSettings: settings,
    onSecondaryClipChange,
    onSettingsChange,
    setSecondaryClip,
    setSecondaryTrim,
  } = useShallowSelector(ClipContext, (state) => ({
    secondaryClip: state.secondaryClip,
    dualVideoSettings: state.dualVideoSettings,
    onSecondaryClipChange: state.setSecondaryClip,
    onSettingsChange: state.setDualVideoSettings,
    setSecondaryClip: state.setSecondaryClip,
    setSecondaryTrim: state.setSecondaryTrim,
  }));

  const [isExpanded, setIsExpanded] = useState(false);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("video/")) {
        toast.error("Please select a video file");
        return;
      }

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
          visible: true,
          trimStart: 0,
          trimEnd: 0,
          timelineOffset: 0,
        };

        tempVideo.addEventListener("loadedmetadata", () => {
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

          setSecondaryTrim({
            trimStart: 0,
            trimEnd: durationMs,
            timelineOffset: 0,
          });

          toast.success("Secondary video clip added");
        });
      } catch (error) {
        logger.error("Error adding secondary clip:", error);
        toast.error("Failed to add secondary video clip");
      }
    },
    []
  );

  const updateSetting = useCallback(
    <K extends keyof DualVideoSettings>(
      key: K,
      value: DualVideoSettings[K]
    ) => {
      onSettingsChange({ ...settings, [key]: value });
    },
    [settings, onSettingsChange]
  );

  const updateSecondaryClip = useCallback(
    (updates: Partial<DualVideoClip>) => {
      if (secondaryClip) {
        onSecondaryClipChange({ ...secondaryClip, ...updates });
      }
    },
    [secondaryClip, onSecondaryClipChange]
  );

  const handleOffsetChange = useCallback(
    (value: number) => {
      updateSetting("secondaryOffset", value);
    },
    [updateSetting]
  );

  const handlePiPSizeChange = useCallback(
    (value: number) => {
      const size = value / 100; // Convert percentage to 0.2-0.4 range
      const clampedSize = Math.max(0.2, Math.min(0.4, size));
      updateSetting("pipSize", clampedSize);
    },
    [updateSetting]
  );

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
            onClick={() => onSecondaryClipChange(null)}
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
                  <span className="text-xs font-medium text-foreground-default truncate">
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
              <div className="text-xs tracking-tight font-medium text-foreground-default truncate">
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
                    <span className="text-xs font-medium text-foreground-default truncate">
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
                <div className="text-xs tracking-tight font-medium text-foreground-default truncate">
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
              <div className="space-y-4 pt-2 border-t border-surface-tertiary">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-foreground-subtle">
                    Layout
                  </label>
                  <Select
                    value={settings.layout}
                    onValueChange={(value: DualVideoLayout) =>
                      updateSetting("layout", value)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8">
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
                              <span className="text-sm font-medium">
                                {option.label}
                              </span>
                              <span className="text-xs text-foreground-muted">
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
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-foreground-subtle">
                        PiP Position
                      </label>
                      <Select
                        value={settings.pipPosition || "bottom-right"}
                        onValueChange={(value: PiPPosition) =>
                          updateSetting("pipPosition", value)
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pipPositionOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-foreground-subtle">
                        PiP Size:{" "}
                        <span className="font-bold text-foreground-default">
                          {Math.round((settings.pipSize || 0.25) * 100)}%
                        </span>
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="40"
                        value={Math.round((settings.pipSize || 0.25) * 100)}
                        onChange={(e) =>
                          handlePiPSizeChange(parseInt(e.target.value))
                        }
                        className="w-full h-2 bg-surface-tertiary rounded-lg appearance-none cursor-pointer"
                        disabled={disabled}
                      />
                      <div className="flex justify-between text-xs text-foreground-muted">
                        <span>20%</span>
                        <span>40%</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <label className="text-xs text-foreground-subtle">
                    Audio Mode
                  </label>
                  <Select
                    value={settings.primaryAudio}
                    onValueChange={(value: AudioMixMode) =>
                      updateSetting("primaryAudio", value)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8">
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
                            <span className="text-sm font-medium">
                              {option.label}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex flex-col gap-3 items-start">
                    <Volume.Root
                      value={settings.primaryVolume}
                      onValueChange={(v) => updateSetting("primaryVolume", v)}
                    >
                      <Volume.Label className="text-xs">
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
                      onValueChange={(v) => updateSetting("secondaryVolume", v)}
                    >
                      <Volume.Label className="text-xs">
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
                        onCheckedChange={(v: boolean) =>
                          updateSetting("normalizeAudio", v)
                        }
                        disabled={disabled}
                      />
                      <label
                        htmlFor="normalizeAudio"
                        className="text-xs text-foreground-subtle"
                      >
                        Normalize Audio
                      </label>
                    </div>
                  </div>
                </div>

                {/* <div className="flex flex-col gap-2">
                  <label className="text-xs text-foreground-subtle">
                    Output Orientation
                  </label>
                  <Select
                    value={settings.outputOrientation}
                    onValueChange={(value: DualVideoOrientation) =>
                      updateSetting("outputOrientation", value)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vertical">Vertical (9:16)</SelectItem>
                    </SelectContent>
                  </Select>
                </div> */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
