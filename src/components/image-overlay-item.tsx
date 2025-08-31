"use client";

import React, { useEffect, useState, memo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Trash2, RotateCw, Maximize2 } from "lucide-react";
import { ImageOverlay } from "@/types/app";
import { cn } from "@/lib/utils";
import { useImageOverlays } from "@/contexts/overlays-context";

interface ImageOverlayItemProps {
  overlay: ImageOverlay;
  selectedOverlay: string | null;
  duration: number;
  updateImageOverlay: (id: string, updates: Partial<ImageOverlay>) => void;
  deleteImageOverlay: (id: string) => void;
}

const ImageOverlayItem: React.FC<ImageOverlayItemProps> = ({
  overlay,
  selectedOverlay,
  duration,
  updateImageOverlay,
  deleteImageOverlay,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const objectUrl = useRef(URL.createObjectURL(overlay.file));

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl.current);
    };
  }, [objectUrl]);

  const handleTimeChange = (field: "startTime" | "endTime", value: string) => {
    const timeMs = parseInt(value) * 1000;
    if (!isNaN(timeMs) && timeMs >= 0 && timeMs <= duration) {
      updateImageOverlay(overlay.id, { [field]: timeMs });
    }
  };

  const handleOpacityChange = (value: string) => {
    const opacity = parseFloat(value);
    if (!isNaN(opacity) && opacity >= 0 && opacity <= 1) {
      updateImageOverlay(overlay.id, { opacity });
    }
  };

  const handleScaleChange = (value: string) => {
    const scale = parseFloat(value);
    if (!isNaN(scale) && scale > 0) {
      updateImageOverlay(overlay.id, { scale });
    }
  };

  return (
    <div
      className={cn(
        "py-2 px-3 rounded-lg border-2 text-sm",
        selectedOverlay === overlay.id
          ? "border-primary bg-primary/10"
          : "border-gray-700/50 bg-surface-secondary"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0 space-x-2">
          <img
            src={objectUrl.current}
            alt={overlay.file.name}
            className="w-8 h-8 object-cover rounded"
          />
          <span className="font-medium flex-1 min-w-0 truncate text-foreground-default text-sm">
            {overlay.file.name}
          </span>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              updateImageOverlay(overlay.id, { visible: !overlay.visible });
            }}
            className={cn(
              "p-1",
              overlay.visible ? "text-accent-primary" : "text-foreground-muted"
            )}
            variant="ghost"
            size="icon"
          >
            {overlay.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1"
            variant="ghost"
            size="icon"
          >
            <Maximize2 size={14} />
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              deleteImageOverlay(overlay.id);
            }}
            className="p-1 text-error hover:text-error/80"
            variant="ghost"
            size="icon"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-gray-700/50">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-foreground-subtle mb-1">
                Start Time
              </label>
              <Input
                type="number"
                min="0"
                max={Math.floor(duration / 1000)}
                value={Math.floor(overlay.startTime / 1000)}
                onChange={(e) => handleTimeChange("startTime", e.target.value)}
                className="px-2 py-1 text-xs"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div>
              <label className="block text-xs text-foreground-subtle mb-1">
                End Time
              </label>
              <Input
                type="number"
                min="0"
                max={Math.floor(duration / 1000)}
                value={Math.floor(overlay.endTime / 1000)}
                onChange={(e) => handleTimeChange("endTime", e.target.value)}
                className="px-2 py-1 text-xs"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-foreground-subtle mb-1">
              Opacity
            </label>
            <Input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={overlay.opacity}
              onChange={(e) => handleOpacityChange(e.target.value)}
              className="h-7"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div>
            <label className="block text-xs text-foreground-subtle mb-1">
              Scale
            </label>
            <Input
              type="number"
              min="0.1"
              max="3"
              step="0.1"
              value={overlay.scale}
              onChange={(e) => handleScaleChange(e.target.value)}
              className="px-2 py-1 text-xs"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface ImageOverlayItemContainerProps {
  selectedOverlay: string | null;
  duration: number;
}

const ImageOverlayItemContainer = ({
  selectedOverlay,
  duration,
}: ImageOverlayItemContainerProps) => {
  const { imageOverlays, updateImageOverlay, deleteImageOverlay } =
    useImageOverlays();

  return imageOverlays.map((imageOverlay) => (
    <ImageOverlayItem
      key={imageOverlay.id}
      overlay={imageOverlay}
      selectedOverlay={selectedOverlay}
      duration={duration}
      updateImageOverlay={updateImageOverlay}
      deleteImageOverlay={deleteImageOverlay}
    />
  ));
};

export default memo(ImageOverlayItemContainer);
