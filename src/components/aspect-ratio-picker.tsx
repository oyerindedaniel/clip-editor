import { useEffect, useState } from "react";
import { Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { cn } from "@/lib/utils";
import {
  ScreenSize,
  AspectRatio169,
  AspectRatio916,
  AspectRatio,
} from "@/components/boundary-box";

type AspectRatioType = AspectRatio | null;

interface AspectRatioSelectorProps {
  screenSize: ScreenSize;
  aspectRatio: AspectRatioType;
  onAspectRatioChange: (ratio: AspectRatioType) => void;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  disabled?: boolean;
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

const AspectRatioSelector = ({
  screenSize,
  aspectRatio,
  onAspectRatioChange,
  visible,
  onVisibleChange,
  disabled = false,
}: AspectRatioSelectorProps) => {
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
          <span className="text-xs">{aspectRatio || "Aspect"}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-fit" align="start" side="bottom">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-foreground-default">
              Crop to Aspect Ratio
            </h3>
            <p className="text-xs text-foreground-subtle">
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
                className="w-full text-left block text-xs overflow-hidden"
              >
                <span className="font-medium mr-2">{ratio.label}</span>
                <Badge variant="secondary">{ratio.description}</Badge>
              </Button>
            ))}
          </div>

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

export default AspectRatioSelector;
