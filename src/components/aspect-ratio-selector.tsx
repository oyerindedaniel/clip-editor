import { useEffect, useState } from "react";
import { Crop, Maximize2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { FORMAT_OPTIONS } from "@/constants/app";
import type {
  CropMode,
  ExportSettings,
  Settings as SettingsType,
  VideoFormat,
} from "@/types/app";
import { cn } from "@/lib/utils";
import ColorPalette, { Color } from "@/components/color-palette";
import { useLatestValue } from "@/hooks/use-latest-value";
import InfoTooltip from "@/components/info-tooltip";

interface AspectRatioSelectorProps extends React.PropsWithChildren {
  settings: SettingsType;
  onSettingsApplied: (settings: SettingsType) => void;
  isBufferDownloaded: boolean;
  isExporting: boolean;
}

export const aspectRatios = [
  { value: "original", label: "Keep Original", description: "No conversion" },
  { value: "16:9", label: "16:9", description: "Widescreen (YouTube, TV)" },
  { value: "9:16", label: "9:16", description: "Portrait (TikTok, Stories)" },
  { value: "1:1", label: "1:1", description: "Square (Instagram)" },
  { value: "4:3", label: "4:3", description: "Standard (Old TV)" },
  { value: "21:9", label: "21:9", description: "Ultra-wide (Cinema)" },
  { value: "3:4", label: "3:4", description: "Portrait Standard" },
] as const;

export const cropModes = [
  { value: "letterbox", label: "Letterbox", icon: <Maximize2 size={14} /> },
  { value: "crop", label: "Crop", icon: <Crop size={14} /> },
  // { value: "stretch", label: "Stretch", icon: <Video size={14} /> },
];

export type AspectRatioValue = (typeof aspectRatios)[number]["value"];

const AspectRatioSelector = ({
  settings,
  onSettingsApplied,
  isBufferDownloaded,
  isExporting,
}: AspectRatioSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [convertAspectRatio, setConvertAspectRatio] =
    useState<AspectRatioValue>(settings.aspectRatio);
  const [cropMode, setCropMode] = useState(settings.cropMode);
  const [padColor, setPadColor] = useState<Color>(settings.padColor);
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings size={14} className="mr-1" />
          Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit" align="start" side="bottom">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-foreground-default">
              Adjust Aspect Ratio
            </h3>
            <p className="text-sm md:text-[0.8rem] text-foreground-subtle">
              Configure aspect ratio and crop mode
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor="aspectRatio"
                className="text-right text-sm md:text-[0.8rem]"
              >
                Aspect Ratio
              </label>
              <Select
                value={convertAspectRatio}
                onValueChange={(val) =>
                  setConvertAspectRatio(val as AspectRatioValue)
                }
              >
                <SelectTrigger id="aspectRatio" className="col-span-3">
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
                <label
                  htmlFor="cropMode"
                  className="text-right text-sm md:text-[0.8rem]"
                >
                  Crop Mode
                </label>
                <div className="col-span-3 grid grid-cols-3 gap-2">
                  {cropModes.map((mode) => (
                    <Button
                      key={mode.value}
                      onClick={() => setCropMode(mode.value as CropMode)}
                      className={cn(
                        "flex flex-col items-center rounded-3xl justify-center p-2 cursor-pointer transition-colors space-y-1 border",
                        cropMode === mode.value
                          ? "bg-primary/20 text-primary border-primary"
                          : "bg-surface-tertiary text-foreground-subtle hover:bg-surface-secondary border-subtle"
                      )}
                      variant="ghost"
                      size="sm"
                    >
                      <div className="flex items-center space-x-1.5">
                        {mode.icon}
                        <span className="text-sm md:text-[0.8rem] font-medium">
                          {mode.label}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {convertAspectRatio !== "original" && cropMode === "letterbox" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <label
                  htmlFor="padColor"
                  className="text-right text-sm md:text-[0.8rem]"
                >
                  Pad Color
                </label>
                <div className="col-span-3">
                  <ColorPalette
                    id="padColor"
                    value={padColor}
                    onChange={setPadColor}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 flex items-center gap-2"
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
              <label
                htmlFor="format"
                className="text-right text-sm md:text-[0.8rem]"
              >
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
                  className="col-span-3 h-auto px-2 py-1 text-sm md:text-[0.8rem]"
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

          <div className="flex items-center gap-2 w-full pt-2">
            <Button
              onClick={() => {
                onSettingsApplied({
                  aspectRatio: convertAspectRatio,
                  cropMode: cropMode as CropMode,
                  padColor,
                  format,
                });
                setIsOpen(false);
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
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AspectRatioSelector;
