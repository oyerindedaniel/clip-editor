import { useEffect, useState } from "react";
import {
  Crop,
  Video,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { cn } from "@/lib/utils";
import ColorPalette, { type Color } from "@/components/color-palette";
import type { BackgroundVideo, CropMode } from "@/types/app";
import type {
  ScreenSize,
  AspectRatio169,
  AspectRatio916,
  AspectRatio,
} from "@/utils/aspect-ratios";
import { cropModes } from "./aspect-ratio-selector";
import { DEFAULT_CLIP_METADATA } from "@/constants/app";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShallowSelector } from "react-shallow-store";
import { ClipContext } from "@/contexts/clip-context";
import { KeyframeContext } from "@/contexts/keyframe-context";
import { PillToggle } from "@/components/ui/pill-toggle";

type AspectRatioType = AspectRatio | null;

interface AspectRatioPickerProps {
  screenSize: ScreenSize;
  aspectRatio: AspectRatioType;
  onAspectRatioChange: (ratio: AspectRatioType) => void;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  disabled?: boolean;
  // Background settings
  hasSecondaryClip?: boolean;
  // keyframe constraints
  hasKeyframes?: boolean;
  onClearKeyframes?: () => void;

  activeStack?: "dual" | "renderer";
  setActiveStack?: (key: "dual" | "renderer") => void;
}

const aspectRatios169: {
  value: AspectRatio169;
  label: string;
  description: string;
}[] = [
  { value: "9:16", label: "9:16", description: "Portrait (TikTok, Stories)" },
  { value: "1:1", label: "1:1", description: "Square (Instagram)" },
  { value: "4:3", label: "4:3", description: "Standard (Old TV)" },
  { value: "3:4", label: "3:4", description: "Portrait Standard" },
];

const aspectRatios916: {
  value: AspectRatio916;
  label: string;
  description: string;
}[] = [
  { value: "16:9", label: "16:9", description: "Widescreen (YouTube, TV)" },
  { value: "1:1", label: "1:1", description: "Square (Instagram)" },
  { value: "4:3", label: "4:3", description: "Standard (Old TV)" },
  { value: "21:9", label: "21:9", description: "Ultra-wide (Cinema)" },
  { value: "3:4", label: "3:4", description: "Portrait Standard" },
];

const AspectRatioPicker = ({
  screenSize,
  aspectRatio,
  onAspectRatioChange,
  visible,
  onVisibleChange,
  disabled = false,
  hasSecondaryClip = false,
  hasKeyframes = false,
  onClearKeyframes,
  activeStack,
  setActiveStack,
}: AspectRatioPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localAspectRatio, setLocalAspectRatio] =
    useState<AspectRatioType>(aspectRatio);
  const [selectedOverride, setSelectedOverride] = useState<
    "primary" | "secondary" | null
  >(null);

  const availableRatios =
    screenSize === "16:9" ? aspectRatios169 : aspectRatios916;

  const {
    dualVideoSettings,
    setDualVideoSettings,
    secondaryClip,
    cropMode,
    setCropMode,
    padColor,
    setPadColor,
  } = useShallowSelector(ClipContext, (state) => ({
    dualVideoSettings: state.dualVideoSettings,
    setDualVideoSettings: state.setDualVideoSettings,
    secondaryClip: state.secondaryClip,
    cropMode: state.cropMode,
    setCropMode: state.setCropMode,
    padColor: state.padColor,
    setPadColor: state.setPadColor,
  }));
  const { primaryBoundaryAspectOverride, secondaryBoundaryAspectOverride } =
    useShallowSelector(KeyframeContext, (state) => ({
      primaryBoundaryAspectOverride: state.primaryBoundaryAspectOverride,
      secondaryBoundaryAspectOverride: state.secondaryBoundaryAspectOverride,
    }));

  const handleApply = () => {
    if (localAspectRatio) {
      onAspectRatioChange(localAspectRatio);
      onVisibleChange(true);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onAspectRatioChange(null);
    onVisibleChange(false);
    setLocalAspectRatio(null);
    setSelectedOverride(null);
    // when clearing after using crop with keyframes, also clear keyframes
    if (cropMode === "crop" && hasKeyframes && onClearKeyframes) {
      onClearKeyframes();

      if (activeStack === "renderer" && setActiveStack) {
        setActiveStack("dual");
      }
    }
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      setLocalAspectRatio(aspectRatio);
    }
  }, [isOpen, aspectRatio]);

  // If switching to letterbox, disable and clear any aspect ratio selection
  useEffect(() => {
    if (cropMode === "letterbox") {
      setLocalAspectRatio(null);
      setSelectedOverride(null);
      onAspectRatioChange(null);
      onVisibleChange(false);
    }
  }, [cropMode]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          className={cn(
            visible && aspectRatio && "border-primary bg-primary/10"
          )}
        >
          <Crop size={14} className="mr-1" />
          <span>{aspectRatio || "Aspect"}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        data-dialog-popover-ratio
        className="w-fit h-full max-h-[420px] overflow-y-auto bg-surface-primary no-scrollbar"
        align="start"
        side="bottom"
      >
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-foreground-default">
              Crop to Aspect Ratio
            </h3>
            <p className="text-sm md:text-[0.8rem] text-foreground-subtle">
              Screen: {screenSize}
            </p>
          </div>

          <div className="grid gap-2">
            {!!secondaryClip && (
              <>
                {primaryBoundaryAspectOverride && (
                  <div className="flex flex-col gap-1">
                    <div className="px-1 py-1 text-[10px] uppercase tracking-wide text-foreground-muted">
                      primary
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedOverride("primary");
                        setLocalAspectRatio(primaryBoundaryAspectOverride);
                      }}
                      variant={
                        selectedOverride === "primary" ? "default" : "outline"
                      }
                      disabled={cropMode === "letterbox"}
                      className="justify-start overflow-hidden border-subtle"
                    >
                      <span className="font-medium mr-2">Custom (Panel)</span>
                      <Badge variant="secondary">
                        {primaryBoundaryAspectOverride}
                      </Badge>
                    </Button>
                  </div>
                )}
                {secondaryBoundaryAspectOverride && (
                  <div className="flex flex-col gap-1">
                    <div className="px-1 py-1 text-[10px] uppercase tracking-wide text-foreground-muted">
                      secondary
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedOverride("secondary");
                        setLocalAspectRatio(secondaryBoundaryAspectOverride);
                      }}
                      variant={
                        selectedOverride === "secondary" ? "default" : "outline"
                      }
                      disabled={cropMode === "letterbox"}
                      className="justify-start overflow-hidden border-subtle"
                    >
                      <span className="font-medium mr-2">Custom (Panel)</span>
                      <Badge variant="secondary">
                        {secondaryBoundaryAspectOverride}
                      </Badge>
                    </Button>
                  </div>
                )}
              </>
            )}

            {availableRatios.map((ratio) => (
              <Button
                key={ratio.value}
                onClick={() => {
                  setSelectedOverride(null);
                  setLocalAspectRatio(ratio.value);
                }}
                disabled={cropMode === "letterbox"}
                variant={
                  localAspectRatio === ratio.value ? "default" : "outline"
                }
                className="justify-start overflow-hidden border-subtle"
              >
                <span className="font-medium mr-2">{ratio.label}</span>
                <Badge variant="secondary" className="">
                  {ratio.description}
                </Badge>
              </Button>
            ))}
          </div>

          <div className="grid gap-2">
            <Label>Crop Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              {cropModes.map((mode) => (
                <Button
                  key={mode.value}
                  onClick={() => setCropMode(mode.value as CropMode)}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-3xl p-2 text-sm md:text-[0.8rem] border",
                    cropMode === mode.value
                      ? "bg-primary/20 text-primary border-primary"
                      : "bg-surface-tertiary text-foreground-subtle hover:bg-surface-secondary border-subtle"
                  )}
                  variant="ghost"
                  size="sm"
                >
                  {mode.icon}
                  <span className="font-medium">{mode.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {cropMode === "letterbox" ||
          (cropMode === "crop" && localAspectRatio !== "9:16") ? (
            <div className="grid gap-2">
              <Label>Background</Label>
              <div className="flex items-center space-x-2">
                <PillToggle.Root
                  value={dualVideoSettings.backgroundMode === "pad-color"}
                  onValueChange={(checked) =>
                    setDualVideoSettings((prev) => ({
                      ...prev,
                      backgroundMode: checked ? "pad-color" : "video",
                    }))
                  }
                  disabled={disabled}
                >
                  <PillToggle.Item side="left">
                    <Palette size={14} />
                    <span>Pad Color</span>
                  </PillToggle.Item>
                  <PillToggle.Divider />
                  <PillToggle.Item side="right">
                    <Video size={14} />
                    <span>Video</span>
                  </PillToggle.Item>
                </PillToggle.Root>
              </div>

              {dualVideoSettings.backgroundMode === "video" && (
                <div className="grid gap-2">
                  {hasSecondaryClip && (
                    <>
                      <Label>Background Video</Label>
                      <Select
                        value={dualVideoSettings.backgroundVideo}
                        onValueChange={(value: BackgroundVideo) =>
                          setDualVideoSettings((prev) => ({
                            ...prev,
                            backgroundVideo: value,
                          }))
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">
                            <div className="flex items-center space-x-2">
                              <Video size={14} />
                              <span>Primary Video</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="secondary">
                            <div className="flex items-center space-x-2">
                              <Video size={14} />
                              <span>Secondary Video</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  <div className="grid gap-2">
                    <Label>Alignment</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant={
                          dualVideoSettings.backgroundAlign === "left"
                            ? "default"
                            : "tertiary"
                        }
                        aria-label="Align Left"
                        onClick={() =>
                          setDualVideoSettings((prev) => ({
                            ...prev,
                            backgroundAlign: "left",
                          }))
                        }
                      >
                        <AlignLeft size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant={
                          dualVideoSettings.backgroundAlign === "center"
                            ? "default"
                            : "tertiary"
                        }
                        aria-label="Align Center"
                        onClick={() =>
                          setDualVideoSettings((prev) => ({
                            ...prev,
                            backgroundAlign: "center",
                          }))
                        }
                      >
                        <AlignCenter size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant={
                          dualVideoSettings.backgroundAlign === "right"
                            ? "default"
                            : "tertiary"
                        }
                        aria-label="Align Right"
                        onClick={() =>
                          setDualVideoSettings((prev) => ({
                            ...prev,
                            backgroundAlign: "right",
                          }))
                        }
                      >
                        <AlignRight size={14} />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bgOpacity">
                      Background Opacity
                      <span className="font-bold text-foreground-default">
                        {Math.round(
                          (dualVideoSettings.backgroundOpacity ?? 0.3) * 100
                        )}
                        %
                      </span>
                    </Label>
                    <input
                      id="bgOpacity"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={dualVideoSettings.backgroundOpacity ?? 0.3}
                      onChange={(e) =>
                        setDualVideoSettings((prev) => ({
                          ...prev,
                          backgroundOpacity: Number(e.target.value),
                        }))
                      }
                      className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bgBlur">
                      Background Blur
                      <span className="font-bold text-foreground-default">
                        {Math.round(
                          (dualVideoSettings.backgroundBlur ?? 2) * 10
                        ) / 10}
                        px
                      </span>
                    </Label>
                    <input
                      id="bgBlur"
                      type="range"
                      min={0}
                      max={20}
                      step={0.5}
                      value={dualVideoSettings.backgroundBlur ?? 2}
                      onChange={(e) =>
                        setDualVideoSettings((prev) => ({
                          ...prev,
                          backgroundBlur: Number(e.target.value),
                        }))
                      }
                      className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                  </div>
                </div>
              )}

              {dualVideoSettings.backgroundMode === "pad-color" && (
                <div className="grid gap-2">
                  <Label>Pad Color</Label>
                  <ColorPalette
                    id="padColor"
                    value={padColor ?? DEFAULT_CLIP_METADATA.padColor}
                    onChange={(color) => setPadColor(color)}
                  >
                    <Button
                      type="button"
                      variant="tertiary"
                      size="sm"
                      className="h-7 px-2 text-sm md:text-[0.8rem] flex items-center gap-2 border-1 border-subtle"
                    >
                      <span
                        className="h-4 w-4 rounded border"
                        style={{
                          backgroundColor:
                            padColor ?? DEFAULT_CLIP_METADATA.padColor,
                        }}
                      />
                      <span>{padColor ?? DEFAULT_CLIP_METADATA.padColor}</span>
                    </Button>
                  </ColorPalette>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex gap-2 pt-2">
            {visible && aspectRatio && (
              <Button
                onClick={handleClear}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Clear
              </Button>
            )}
            <Button
              onClick={handleApply}
              variant="default"
              size="sm"
              className="flex-1"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AspectRatioPicker;
