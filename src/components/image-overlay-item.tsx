"use client";

import React, { useEffect, useState, memo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { ImageOverlay } from "@/types/app";
import { cn } from "@/lib/utils";
import { OverlaysContext } from "@/contexts/overlays-context";
import { useShallowSelector } from "react-shallow-store";

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
        "group rounded-lg border text-sm overflow-hidden",
        selectedOverlay === overlay.id
          ? "border-primary/60 bg-primary/5"
          : "border-subtle bg-surface-secondary"
      )}
    >
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-tertiary">
        <img
          src={objectUrl.current}
          alt={overlay.file.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-start justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              deleteImageOverlay(overlay.id);
            }}
            className="h-7 w-7 p-0 text-foreground-on-accent bg-error/90 hover:bg-error"
            variant="ghost"
            size="icon"
            aria-label="Remove image overlay"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      <div className="px-2 py-2">
        <div className="font-medium text-foreground-default text-xs truncate">
          {overlay.file.name}
        </div>
      </div>
    </div>
  );
};

interface ImageOverlayItemContainerProps {
  duration: number;
}

const ImageOverlayItemContainer = ({
  duration,
}: ImageOverlayItemContainerProps) => {
  const {
    imageOverlays,
    selectedOverlay,
    updateImageOverlay,
    deleteImageOverlay,
  } = useShallowSelector(OverlaysContext, (state) => ({
    imageOverlays: state.imageOverlays,
    selectedOverlay: state.selectedOverlay,
    updateImageOverlay: state.updateImageOverlay,
    deleteImageOverlay: state.deleteImageOverlay,
  }));

  return (
    <div className="grid grid-cols-2 @md:grid-cols-3 gap-3">
      {imageOverlays.map((imageOverlay) => (
        <ImageOverlayItem
          key={imageOverlay.id}
          overlay={imageOverlay}
          selectedOverlay={selectedOverlay}
          duration={duration}
          updateImageOverlay={updateImageOverlay}
          deleteImageOverlay={deleteImageOverlay}
        />
      ))}
    </div>
  );
};

export default memo(ImageOverlayItemContainer);
