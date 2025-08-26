"use client";
import React, { useRef, useEffect, useMemo } from "react";
import { ImageOverlay } from "@/types/app";
import { ResizeHandle } from "./resize-handle";
import { Position } from "./resize-handle";
import { cn } from "@/lib/utils";

interface DraggableImageOverlayProps {
  overlay: ImageOverlay;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (handle: Position, e: React.MouseEvent) => void;
}

const DraggableImageOverlay: React.FC<DraggableImageOverlayProps> = ({
  overlay,
  isSelected,
  onMouseDown,
  onResizeStart,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);

  const objectUrl = useRef(URL.createObjectURL(overlay.file));

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl.current);
    };
  }, [objectUrl]);

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
        "absolute top-0 left-0 cursor-move select-none",
        "[transform:translate3d(0,0,0)]",
        "w-[var(--width)] h-[var(--height)]",
        isSelected && "ring-2 ring-primary ring-opacity-50"
      )}
      style={
        {
          "--width": `${overlay.width}px`,
          "--height": `${overlay.height}px`,
        } as React.CSSProperties
      }
      onMouseDown={onMouseDown}
    >
      <img
        src={objectUrl.current}
        alt={overlay.file.name}
        className={cn(
          "w-full h-full object-cover pointer-events-none",
          "opacity-[var(--opacity)]",
          "rotate-[var(--rotation)] scale-[var(--scale)]"
        )}
        style={
          {
            "--opacity": overlay.opacity,
            "--rotation": `${overlay.rotation}deg`,
            "--scale": overlay.scale,
          } as React.CSSProperties
        }
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
        </>
      )}
    </div>
  );
};

export { DraggableImageOverlay };
