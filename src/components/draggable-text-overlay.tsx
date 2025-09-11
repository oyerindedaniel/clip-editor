import React, { useEffect, useRef } from "react";
import type { TextOverlay } from "@/types/app";
import { cn } from "@/lib/utils";
import { useShallowSelector } from "@/hooks/context-store";
import { OverlaysContext } from "@/contexts/overlays-context";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DraggableTextOverlayProps {
  overlay: TextOverlay;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export const DraggableTextOverlay = ({
  overlay,
  isSelected,
  onMouseDown,
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
    registerTextOverlayRef(overlay.id, elementRef.current);
    return () => registerTextOverlayRef(overlay.id, null);
  }, []);

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
          transform: `translate3d(${overlay.x}px, ${overlay.y}px, 0)`,
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
          maxWidth: overlay.maxWidth,
          padding: "6px 8px",
          borderRadius: "4px",
          zIndex: isSelected ? 10 : 1,
        } as React.CSSProperties
      }
      onMouseDown={onMouseDown}
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
    transition-[opacity,filter] duration-300 ease-out
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
