import React, { useEffect, useRef } from "react";
import type { TextOverlay } from "@/types/app";
import { cn } from "@/lib/utils";
import { useShallowSelector } from "react-shallow-store";
import { ContainerContext, OverlaysContext } from "@/contexts/overlays-context";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DraggableTextOverlayProps {
  overlay: TextOverlay;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  isDualVideo: boolean;
  containerContext?: ContainerContext;
}

export const DraggableTextOverlay = ({
  overlay,
  isSelected = false,
  onMouseDown,
  isDualVideo = false,
  containerContext = "primary",
}: DraggableTextOverlayProps) => {
  const elementRef = useRef<HTMLDivElement | null>(null);

  const { registerTextOverlayRef, deleteTextOverlay } = useShallowSelector(
    OverlaysContext,
    (state) => ({
      registerTextOverlayRef: state.registerTextOverlayRef,
      deleteTextOverlay: state.deleteTextOverlay,
    })
  );

  useEffect(() => {
    if (!isDualVideo) {
      registerTextOverlayRef(overlay.id, elementRef.current);
      return () => registerTextOverlayRef(overlay.id, null);
    }
  }, [isDualVideo, registerTextOverlayRef, overlay.id]);

  return (
    <div
      ref={elementRef}
      data-selected={isSelected ? "" : undefined}
      className={cn(
        "absolute top-0 left-0 select-none cursor-move pointer-events-auto will-change-transform",
        isSelected && "ring-2 ring-primary"
      )}
      style={
        {
          transform: `translate3d(${
            isDualVideo ? overlay.dualX : overlay.x
          }px, ${isDualVideo ? overlay.dualY : overlay.y}px, 0)`,
          fontSize: `${overlay.fontSize}px`,
          fontFamily: overlay.fontFamily,
          letterSpacing: overlay.letterSpacing,
          color: overlay.color,
          backgroundColor: overlay.backgroundColor,
          opacity: overlay.opacity,
          fontWeight: overlay.bold ? "bold" : "normal",
          fontStyle: overlay.italic ? "italic" : "normal",
          textDecoration: overlay.underline ? "underline" : "none",
          textAlign: overlay.alignment,
          maxWidth: isDualVideo ? overlay.dualMaxWidth : overlay.maxWidth,
          padding: "6px 8px",
          borderRadius: "4px",
          zIndex: isSelected ? 10 : 1,
        } as React.CSSProperties
      }
      onMouseDown={(e) => onMouseDown(e)}
      data-overlay-id={overlay.id}
    >
      {overlay.text}

      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          deleteTextOverlay(overlay.id);
        }}
        className="
    absolute -top-8 -right-2 h-6 px-2 gap-1 text-xs z-10
    opacity-0 blur-[1px]
    transition-[opacity,filter,transform] duration-300 ease-out
    hover:scale-105
    [[data-selected]_&]:opacity-100
    [[data-selected]_&]:blur-none
  "
      >
        <X size={12} />
        Remove
      </Button>
    </div>
  );
};
