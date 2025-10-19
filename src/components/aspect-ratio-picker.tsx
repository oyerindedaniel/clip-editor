import { useEffect, useState } from "react";
import { Crop, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { cn } from "@/lib/utils";
import ColorPalette, { Color } from "@/components/color-palette";
import type { CropMode } from "@/types/app";
import type {
  ScreenSize,
  AspectRatio169,
  AspectRatio916,
  AspectRatio,
} from "@/utils/aspect-ratios";
import { cropModes } from "./aspect-ratio-selector";
import { DEFAULT_CLIP_METADATA } from "@/constants/app";

type AspectRatioType = AspectRatio | null;

interface AspectRatioPickerProps {
  screenSize: ScreenSize;
  aspectRatio: AspectRatioType;
  onAspectRatioChange: (ratio: AspectRatioType) => void;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  disabled?: boolean;
  cropMode?: CropMode;
  onCropModeChange?: (mode: CropMode) => void;
  padColor?: Color;
  onPadColorChange?: (color: Color) => void;
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
  cropMode,
  onCropModeChange,
  padColor,
  onPadColorChange,
}: AspectRatioPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localAspectRatio, setLocalAspectRatio] =
    useState<AspectRatioType>(aspectRatio);

  const availableRatios =
    screenSize === "16:9" ? aspectRatios169 : aspectRatios916;

  useEffect(() => {
    if (!isOpen) {
      setLocalAspectRatio(aspectRatio);
    }
  }, [isOpen, aspectRatio]);

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
    setIsOpen(false);
  };

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
        className="w-fit bg-surface-primary"
        align="start"
        side="bottom"
      >
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-medium text-foreground-default">
              Crop to Aspect Ratio
            </h3>
            <p className="text-sm md:text-[0.8rem] text-foreground-subtle">
              Screen: {screenSize}
            </p>
          </div>

          <div className="grid gap-2">
            {availableRatios.map((ratio) => (
              <Button
                key={ratio.value}
                onClick={() => setLocalAspectRatio(ratio.value)}
                variant={
                  localAspectRatio === ratio.value ? "default" : "outline"
                }
                className="w-full text-left block overflow-hidden border-subtle"
              >
                <span className="font-medium mr-2">{ratio.label}</span>
                <Badge variant="secondary">{ratio.description}</Badge>
              </Button>
            ))}
          </div>

          {onCropModeChange && (
            <div className="grid gap-2">
              <div className="text-sm md:text-[0.8rem] font-medium text-foreground-default">
                Crop Mode
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cropModes.map((mode) => (
                  <Button
                    key={mode.value}
                    onClick={() => onCropModeChange(mode.value as CropMode)}
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
          )}

          {onPadColorChange && cropMode === "letterbox" && (
            <div className="grid gap-2">
              <div className="text-sm md:text-[0.8rem] font-medium text-foreground-default">
                Pad Color
              </div>
              <ColorPalette
                id="padColor"
                value={padColor ?? DEFAULT_CLIP_METADATA.padColor}
                onChange={(c) => onPadColorChange(c)}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-sm md:text-[0.8rem] flex items-center gap-2"
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
              disabled={!localAspectRatio}
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
