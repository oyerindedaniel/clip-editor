"use client";

import React, { useEffect, useState, memo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { ImageOverlay } from "@/types/app";
import { cn } from "@/lib/utils";
import { OverlaysContext } from "@/contexts/overlays-context";
import { useShallowSelector } from "react-shallow-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ImageOverlayItemProps {
  overlay: ImageOverlay;
  selectedOverlay: string | null;
  deleteImageOverlay: (id: string) => void;
}

const ImageOverlayItem: React.FC<ImageOverlayItemProps> = ({
  overlay,
  selectedOverlay,
  deleteImageOverlay,
}) => {
  const objectUrl = useRef(URL.createObjectURL(overlay.file));

  const [open, setOpen] = useState(false);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          data-overlay-inspector
          className={cn(
            "group w-full rounded-3xl border text-base overflow-hidden cursor-pointer",
            selectedOverlay === overlay.id
              ? "border-primary/60 bg-primary/5"
              : "border-subtle bg-surface-secondary"
          )}
        >
          <div className="flex items-center gap-3 p-2">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-surface-tertiary flex items-center justify-center">
              <img
                src={objectUrl.current}
                alt={overlay.file.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm md:text-[0.8rem] tracking-tight font-medium text-foreground-default truncate">
                {overlay.file.name}
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteImageOverlay(overlay.id);
                }}
                className="h-7 w-7 p-0 text-foreground-on-accent"
                variant="ghost"
                size="icon"
                aria-label="Remove image overlay"
              >
                <Trash2 size={14} className="text-error" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-64">
        <div className="flex flex-col gap-2">
          <div className="w-full aspect-[4/3] overflow-hidden rounded-2xl bg-surface-tertiary">
            <img
              src={objectUrl.current}
              alt={overlay.file.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-sm md:text-[0.8rem] tracking-tight font-medium text-foreground-default truncate">
            {overlay.file.name}
          </div>
          <div className="text-[11px] tracking-wide text-foreground-subtle">
            {overlay.file.type || "Image"}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ImageOverlayItemContainerProps {
  duration: number;
}

const ImageOverlayItemContainer = ({
  duration,
}: ImageOverlayItemContainerProps) => {
  const { imageOverlays, selectedOverlay, deleteImageOverlay } =
    useShallowSelector(OverlaysContext, (state) => ({
      imageOverlays: state.imageOverlays,
      selectedOverlay: state.selectedOverlay,
      updateImageOverlay: state.updateImageOverlay,
      deleteImageOverlay: state.deleteImageOverlay,
    }));

  return (
    <div className="flex flex-col gap-2">
      {imageOverlays.map((imageOverlay) => (
        <ImageOverlayItem
          key={imageOverlay.id}
          overlay={imageOverlay}
          selectedOverlay={selectedOverlay}
          deleteImageOverlay={deleteImageOverlay}
        />
      ))}
    </div>
  );
};

export default memo(ImageOverlayItemContainer);
