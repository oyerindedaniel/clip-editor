"use client";
import React, { useRef, useEffect, useMemo, useCallback } from "react";
import type { ImageOverlay } from "@/types/app";
import { ResizeHandle } from "./resize-handle";
import { Position } from "./resize-handle";
import { cn } from "@/lib/utils";
import { OverlaysContext } from "@/contexts/overlays-context";
import { useShallowSelector } from "@/hooks/context-store";

interface DraggableImageOverlayProps {
  overlay: ImageOverlay;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (handle: Position, e: React.MouseEvent) => void;
  onRotationStart: (e: React.MouseEvent) => void;
}

const DraggableImageOverlay: React.FC<DraggableImageOverlayProps> = ({
  overlay,
  isSelected,
  onMouseDown,
  onResizeStart,
  onRotationStart,
}) => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const { registerImageOverlayRef } = useShallowSelector(
    OverlaysContext,
    (state) => ({
      registerImageOverlayRef: state.registerImageOverlayRef,
    })
  );

  const objectUrl = useRef(URL.createObjectURL(overlay.file));

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl.current);
    };
  }, [objectUrl]);

  useEffect(() => {
    registerImageOverlayRef(overlay.id, elementRef.current);
    return () => registerImageOverlayRef(overlay.id, null);
  }, []);

  const resizeHandles = [
    { position: "nw", cursor: "nw-resize" },
    { position: "n", cursor: "n-resize" },
    { position: "ne", cursor: "ne-resize" },
    { position: "e", cursor: "e-resize" },
    { position: "se", cursor: "se-resize" },
    { position: "s", cursor: "s-resize" },
    { position: "sw", cursor: "sw-resize" },
    { position: "w", cursor: "w-resize" },
  ] as const;

  return (
    <div
      ref={elementRef}
      className={cn(
        "absolute top-0 left-0 cursor-move select-none pointer-events-auto origin-center will-change-transform",
        "w-[var(--width)] h-[var(--height)] opacity-[var(--opacity)]",
        isSelected && "ring-2 ring-primary/50"
      )}
      style={
        {
          "--width": `${overlay.width}px`,
          "--height": `${overlay.height}px`,
          "--opacity": overlay.opacity,
          transform: `translate3d(${overlay.x}px, ${overlay.y}px, 0) rotate(${overlay.rotation}deg) scale(${overlay.scale})`,
        } as React.CSSProperties
      }
      onMouseDown={onMouseDown}
    >
      <img
        src={objectUrl.current}
        alt={overlay.file.name}
        className={cn("w-full h-full object-cover pointer-events-none")}
      />

      {isSelected && (
        <>
          {resizeHandles.map(({ position, cursor }) => (
            <ResizeHandle
              key={position}
              position={position}
              cursor={cursor}
              onMouseDown={(e) => onResizeStart(position, e)}
            />
          ))}

          <div
            className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-4 h-4 cursor-grab active:cursor-grabbing z-30"
            onMouseDown={onRotationStart}
            title="Rotate image"
          >
            <div className="w-full h-full bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
              <div className="w-[2px] h-3 bg-white rounded-full" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export { DraggableImageOverlay };
