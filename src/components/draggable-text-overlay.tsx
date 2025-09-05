import React, { useEffect, useRef } from "react";
import type { TextOverlay } from "@/types/app";
import { cn } from "@/lib/utils";
import { useShallowSelector } from "@/hooks/context-store";
import { OverlaysContext } from "@/contexts/overlays-context";

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
  const { registerTextOverlayRef } = useShallowSelector(
    OverlaysContext,
    (state) => ({
      registerTextOverlayRef: state.registerTextOverlayRef,
    })
  );

  useEffect(() => {
    registerTextOverlayRef(overlay.id, elementRef.current);
    return () => registerTextOverlayRef(overlay.id, null);
  }, []);

  return (
    <div
      ref={elementRef}
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
    </div>
  );
};
