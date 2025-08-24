"use client";
import React, { useRef, useEffect, useMemo } from "react";
import { ImageOverlay } from "@/types/app";
import { ResizeHandle } from "./resize-handle";
import { cn } from "@/lib/utils";

interface DraggableImageOverlayProps {
  overlay: ImageOverlay;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (handle: string, e: React.MouseEvent) => void;
}

const DraggableImageOverlay: React.FC<DraggableImageOverlayProps> = ({
  overlay,
  isSelected,
  onMouseDown,
  onResizeStart,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);

  const rafId = useRef<number | null>(null);

  const objectUrl = useMemo(
    () => URL.createObjectURL(overlay.file),
    [overlay.file]
  );

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.style.transform = `translate3d(${overlay.x * 100}%, ${
        overlay.y * 100
      }%, 0)`;
      elementRef.current.style.width = `${overlay.width}px`;
      elementRef.current.style.height = `${overlay.height}px`;

      rafId.current = requestAnimationFrame(() => {
        elementRef.current!.style.transform = `translate3d(${
          overlay.x * 100
        }%, ${overlay.y * 100}%, 0)`;
      });
    }

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [overlay.x, overlay.y, overlay.width, overlay.height]);

  const resizeHandles = [
    { position: "nw", cursor: "nw-resize" },
    { position: "n", cursor: "n-resize" },
    { position: "ne", cursor: "ne-resize" },
    { position: "e", cursor: "e-resize" },
    { position: "se", cursor: "se-resize" },
    { position: "s", cursor: "s-resize" },
    { position: "sw", cursor: "sw-resize" },
    { position: "w", cursor: "w-resize" },
  ];

  return (
    <div
      ref={elementRef}
      className={cn(
        "absolute top-0 left-0 cursor-move select-none",
        "[transform:translate3d(var(--x),var(--y),0)]",
        "w-[var(--width)] h-[var(--height)]",
        isSelected && "ring-2 ring-primary ring-opacity-50"
      )}
      style={
        {
          "--x": `${overlay.x * 100}%`,
          "--y": `${overlay.y * 100}%`,
          "--width": `${overlay.width}px`,
          "--height": `${overlay.height}px`,
        } as React.CSSProperties
      }
      onMouseDown={onMouseDown}
    >
      <img
        src={objectUrl}
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
