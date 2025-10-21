import * as React from "react";
import { cn } from "@/lib/utils";
import { ASPECT_RATIOS, type AspectRatio } from "@/utils/aspect-ratios";
import { useComposedRefs } from "@/hooks/use-composed-refs";

const DEFAULT_PIP_WIDTH = 240;
const DEFAULT_PIP_HEIGHT = 135;
const DEFAULT_MIN_WIDTH = 160;
const DEFAULT_MIN_HEIGHT = 90;
const CONTAINER_PADDING = 16;

interface PiPPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PiPConstraints {
  minWidth?: number;
  minHeight?: number;
}

interface PiPProps {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  aspectRatio: AspectRatio;
  initialPosition?: Partial<PiPPosition>;
  constraints?: PiPConstraints;
  onPositionChange?: (position: PiPPosition) => void;
}

type ResizeHandle = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  finalLeft: number;
  finalTop: number;
  rafId: number | null;
}

interface ResizeState {
  isResizing: boolean;
  handle: ResizeHandle | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startPosX: number;
  startPosY: number;
  finalWidth: number;
  finalHeight: number;
  finalLeft: number;
  finalTop: number;
  rafId: number | null;
}

export const PiP = React.forwardRef<HTMLDivElement, PiPProps>(
  (
    {
      children,
      containerRef,
      aspectRatio,
      initialPosition,
      constraints,
      onPositionChange,
    },
    forwardedRef
  ) => {
    const pipRef = React.useRef<HTMLDivElement>(null);
    const composedRefs = useComposedRefs(pipRef, forwardedRef);

    const aspectRatioValue = ASPECT_RATIOS[aspectRatio];
    const minWidth = constraints?.minWidth ?? DEFAULT_MIN_WIDTH;
    const minHeight = constraints?.minHeight ?? DEFAULT_MIN_HEIGHT;

    const [position, setPosition] = React.useState<PiPPosition>(() => ({
      x: initialPosition?.x ?? 0,
      y: initialPosition?.y ?? 0,
      width: initialPosition?.width ?? DEFAULT_PIP_WIDTH,
      height: initialPosition?.height ?? DEFAULT_PIP_HEIGHT,
    }));

    const dragRef = React.useRef<DragState>({
      isDragging: false,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      finalLeft: 0,
      finalTop: 0,
      rafId: null,
    });

    const resizeRef = React.useRef<ResizeState>({
      isResizing: false,
      handle: null,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      startPosX: 0,
      startPosY: 0,
      finalWidth: 0,
      finalHeight: 0,
      finalLeft: 0,
      finalTop: 0,
      rafId: null,
    });

    React.useEffect(() => {
      const container = containerRef.current;
      const pip = pipRef.current;
      if (!container || !pip) return;

      const { width, height } = position;
      const x = CONTAINER_PADDING;
      const y = CONTAINER_PADDING;

      const newPosition = { ...position, x, y };

      pip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      pip.style.width = `${width}px`;
      pip.style.height = `${height}px`;

      setPosition(newPosition);
      onPositionChange?.(newPosition);
    }, []);

    const handleDragStart = React.useCallback(
      (e: React.MouseEvent) => {
        const pip = pipRef.current;
        const container = containerRef.current;
        if (!pip || !container || resizeRef.current.isResizing) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = pip.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        dragRef.current = {
          isDragging: true,
          startX: e.clientX,
          startY: e.clientY,
          offsetX: rect.left - containerRect.left,
          offsetY: rect.top - containerRect.top,
          finalLeft: rect.left - containerRect.left,
          finalTop: rect.top - containerRect.top,
          rafId: null,
        };

        const onMouseMove = (ev: MouseEvent) => {
          const drag = dragRef.current;
          if (!drag.isDragging || !pip) return;

          const container = containerRef.current;
          if (!container) return;

          const containerRect = container.getBoundingClientRect();
          const dx = ev.clientX - drag.startX;
          const dy = ev.clientY - drag.startY;

          let newLeft = drag.offsetX + dx;
          let newTop = drag.offsetY + dy;

          const pipRect = pip.getBoundingClientRect();
          const elementWidth = pipRect.width;
          const elementHeight = pipRect.height;

          newLeft = Math.max(
            0,
            Math.min(containerRect.width - elementWidth, newLeft)
          );
          newTop = Math.max(
            0,
            Math.min(containerRect.height - elementHeight, newTop)
          );

          drag.finalLeft = newLeft;
          drag.finalTop = newTop;

          if (drag.rafId) cancelAnimationFrame(drag.rafId);
          drag.rafId = requestAnimationFrame(() => {
            if (pip) {
              pip.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0)`;
            }
          });
        };

        const onMouseUp = () => {
          const drag = dragRef.current;
          drag.isDragging = false;

          if (drag.rafId) {
            cancelAnimationFrame(drag.rafId);
            drag.rafId = null;
          }

          const finalPosition = {
            ...position,
            x: drag.finalLeft,
            y: drag.finalTop,
          };

          setPosition(finalPosition);
          onPositionChange?.(finalPosition);

          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      },
      [position, onPositionChange]
    );

    const handleResizeStart = React.useCallback(
      (e: React.MouseEvent, handle: ResizeHandle) => {
        const pip = pipRef.current;
        const container = containerRef.current;
        if (!pip || !container) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = pip.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        resizeRef.current = {
          isResizing: true,
          handle,
          startX: e.clientX,
          startY: e.clientY,
          startWidth: rect.width,
          startHeight: rect.height,
          startPosX: rect.left - containerRect.left,
          startPosY: rect.top - containerRect.top,
          finalWidth: rect.width,
          finalHeight: rect.height,
          finalLeft: rect.left - containerRect.left,
          finalTop: rect.top - containerRect.top,
          rafId: null,
        };

        const onMouseMove = (ev: MouseEvent) => {
          const resize = resizeRef.current;
          if (!resize.isResizing || !pip) return;

          const container = containerRef.current;
          if (!container) return;

          const containerRect = container.getBoundingClientRect();
          const dx = ev.clientX - resize.startX;

          let newWidth = resize.startWidth;
          let newHeight = resize.startHeight;
          let newX = resize.startPosX;
          let newY = resize.startPosY;

          switch (resize.handle) {
            case "bottom-right":
              newWidth = resize.startWidth + dx;
              newHeight = newWidth / aspectRatioValue;
              break;
            case "bottom-left":
              newWidth = resize.startWidth - dx;
              newHeight = newWidth / aspectRatioValue;
              newX = resize.startPosX + (resize.startWidth - newWidth);
              break;
            case "top-right":
              newWidth = resize.startWidth + dx;
              newHeight = newWidth / aspectRatioValue;
              newY = resize.startPosY - (newHeight - resize.startHeight);
              break;
            case "top-left":
              newWidth = resize.startWidth - dx;
              newHeight = newWidth / aspectRatioValue;
              newX = resize.startPosX + (resize.startWidth - newWidth);
              newY = resize.startPosY - (newHeight - resize.startHeight);
              break;
          }

          if (newWidth < minWidth) {
            newWidth = minWidth;
            newHeight = newWidth / aspectRatioValue;
          }
          if (newHeight < minHeight) {
            newHeight = minHeight;
            newWidth = newHeight * aspectRatioValue;
          }

          const widthDiff = resize.startWidth - newWidth;
          const heightDiff = resize.startHeight - newHeight;

          if (resize.handle === "top-left" || resize.handle === "bottom-left") {
            newX = resize.startPosX + widthDiff;
          }
          if (resize.handle === "top-left" || resize.handle === "top-right") {
            newY = resize.startPosY + heightDiff;
          }

          newX = Math.max(0, Math.min(containerRect.width - newWidth, newX));
          newY = Math.max(0, Math.min(containerRect.height - newHeight, newY));

          resize.finalWidth = newWidth;
          resize.finalHeight = newHeight;
          resize.finalLeft = newX;
          resize.finalTop = newY;

          if (resize.rafId) cancelAnimationFrame(resize.rafId);
          resize.rafId = requestAnimationFrame(() => {
            if (pip) {
              pip.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
              pip.style.width = `${newWidth}px`;
              pip.style.height = `${newHeight}px`;
            }
          });
        };

        const onMouseUp = () => {
          const resize = resizeRef.current;
          resize.isResizing = false;

          if (resize.rafId) {
            cancelAnimationFrame(resize.rafId);
            resize.rafId = null;
          }

          const finalPosition = {
            x: resize.finalLeft,
            y: resize.finalTop,
            width: resize.finalWidth,
            height: resize.finalHeight,
          };

          setPosition(finalPosition);
          onPositionChange?.(finalPosition);

          resize.handle = null;
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      },
      [aspectRatioValue, minWidth, minHeight, onPositionChange]
    );

    return (
      <div
        ref={composedRefs}
        className={cn(
          "absolute will-change-transform pointer-events-auto z-20",
          "border-2 rounded-lg",
          "backdrop-blur-sm bg-black/10"
        )}
      >
        <div
          onMouseDown={handleDragStart}
          className="absolute top-0 left-0 right-0 h-8 cursor-move touch-none z-11 hover:bg-white/10 transition-colors flex items-center justify-center"
        >
          <div className="w-12 h-1 rounded-full bg-white/40" />
        </div>

        <div className="relative w-full h-full z-2 pointer-events-none">
          {children}
        </div>

        <div
          onMouseDown={(e) => handleResizeStart(e, "top-left")}
          className="absolute top-0 left-0 w-3 h-3 bg-white/90 z-12 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize hover:scale-125 transition-transform rounded-full"
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, "top-right")}
          className="absolute top-0 right-0 w-3 h-3 bg-white/90 z-12 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize hover:scale-125 transition-transform rounded-full"
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
          className="absolute bottom-0 left-0 w-3 h-3 bg-white/90 z-12 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize hover:scale-125 transition-transform rounded-full"
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
          className="absolute bottom-0 right-0 w-3 h-3 bg-white/90 z-12 translate-x-1/2 translate-y-1/2 cursor-nwse-resize hover:scale-125 transition-transform rounded-full"
        />
      </div>
    );
  }
);

PiP.displayName = "PiP";
