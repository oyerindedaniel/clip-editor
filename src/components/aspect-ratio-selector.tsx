import { useEffect, useState } from "react";
import { Video, Crop, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { FORMAT_OPTIONS } from "@/constants/app";
import type {
  CropMode,
  ExportSettings,
  Settings,
  VideoFormat,
} from "@/types/app";
import { cn } from "@/lib/utils";
import ColorPalette from "@/components/color-palette";
import { useLatestValue } from "@/hooks/use-latest-value";
import InfoTooltip from "@/components/info-tooltip";

interface AspectRatioSelectorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onSettingsApplied: (settings: Settings) => void;
  isBufferDownloaded: boolean;
  isExporting: boolean;
}

const aspectRatios = [
  { value: "original", label: "Keep Original", description: "No conversion" },
  { value: "16:9", label: "16:9", description: "Widescreen (YouTube, TV)" },
  { value: "9:16", label: "9:16", description: "Portrait (TikTok, Stories)" },
  { value: "1:1", label: "1:1", description: "Square (Instagram)" },
  { value: "4:3", label: "4:3", description: "Standard (Old TV)" },
  { value: "21:9", label: "21:9", description: "Ultra-wide (Cinema)" },
  { value: "3:4", label: "3:4", description: "Portrait Standard" },
] as const;

const cropModes = [
  {
    value: "letterbox",
    label: "Letterbox",
    icon: <Maximize2 size={16} />,
  },
  {
    value: "crop",
    label: "Crop",
    icon: <Crop size={16} />,
  },
  {
    value: "stretch",
    label: "Stretch",
    icon: <Video size={16} />,
  },
];

export type AspectRatioValue = (typeof aspectRatios)[number]["value"];

const AspectRatioSelector = ({
  isOpen,
  onOpenChange,
  settings,
  onSettingsApplied,
  isBufferDownloaded,
  isExporting,
}: AspectRatioSelectorProps) => {
  const [convertAspectRatio, setConvertAspectRatio] =
    useState<AspectRatioValue>(settings.aspectRatio);
  const [cropMode, setCropMode] = useState(settings.cropMode);
  const [padColor, setPadColor] = useState<string>(settings.padColor);
  const [format, setFormat] = useState<VideoFormat>(settings.format);

  const settingsRef = useLatestValue(settings);

  useEffect(() => {
    return () => {
      // Delay state reset slightly on unmount to prevent UI flash
      setTimeout(() => {
        setConvertAspectRatio(settingsRef.current.aspectRatio);
        setCropMode(settingsRef.current.cropMode);
        setFormat(settingsRef.current.format);
        setPadColor(settingsRef.current.padColor);
      }, 50);
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent data-dialog-aspect-ratio className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Aspect Ratio</DialogTitle>
          <DialogDescription>
            Configure aspect ratio and crop mode
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="aspectRatio" className="text-right text-xs">
              Aspect Ratio
            </label>
            <Select
              value={convertAspectRatio}
              onValueChange={(val) =>
                setConvertAspectRatio(val as AspectRatioValue)
              }
            >
              <SelectTrigger
                id="aspectRatio"
                className="col-span-3 h-auto px-2 py-1 text-xs"
              >
                <SelectValue placeholder="Select an aspect ratio" />
              </SelectTrigger>
              <SelectContent>
                {aspectRatios.map((ratio) => (
                  <SelectItem key={ratio.value} value={ratio.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{ratio.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {ratio.description}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {convertAspectRatio !== "original" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="cropMode" className="text-right text-xs">
                Crop Mode
              </label>
              <div className="col-span-3 grid grid-cols-3 gap-2">
                {cropModes.map((mode) => (
                  <Button
                    key={mode.value}
                    onClick={() => setCropMode(mode.value as CropMode)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-colors space-y-1 border",
                      cropMode === mode.value
                        ? "bg-primary/20 text-primary border-primary"
                        : "bg-surface-tertiary text-foreground-subtle hover:bg-surface-hover border-gray-700/50"
                    )}
                    variant="ghost"
                    size="sm"
                  >
                    <div className="flex items-center space-x-1.5">
                      {mode.icon}
                      <span className="text-xs font-medium">{mode.label}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {convertAspectRatio !== "original" && cropMode === "letterbox" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-xs">Pad Color</label>
              <div className="col-span-3">
                <ColorPalette value={padColor} onChange={setPadColor}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs flex items-center gap-2"
                  >
                    <span
                      className="h-4 w-4 rounded border"
                      style={{ backgroundColor: padColor }}
                    />
                    <span>{padColor}</span>
                  </Button>
                </ColorPalette>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="format" className="text-right text-xs">
              Format
            </label>
            <Select
              value={format}
              onValueChange={(value) =>
                setFormat(value as ExportSettings["format"])
              }
            >
              <SelectTrigger
                id="format"
                className="col-span-3 h-auto px-2 py-1 text-xs"
              >
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{f.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {f.description}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            <Button
              onClick={() => {
                onSettingsApplied({
                  aspectRatio: convertAspectRatio,
                  cropMode: cropMode as CropMode,
                  padColor,
                  format,
                });
                onOpenChange(false);
              }}
              className="flex-1"
              variant="default"
              size="sm"
              disabled={!isBufferDownloaded || isExporting}
            >
              Apply Settings
            </Button>
            <InfoTooltip
              content={
                isBufferDownloaded
                  ? "Apply aspect ratio and crop settings to the video"
                  : "Please wait for the video buffer to finish downloading before applying settings"
              }
              disabled={isBufferDownloaded}
            />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AspectRatioSelector;
