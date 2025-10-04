"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useComposedRefs } from "@/hooks/use-composed-refs";

const DEFAULT_VIDEO_WIDTH = 1920;
const DEFAULT_VIDEO_HEIGHT = 1080;
const OVERLAY_SCALE_FACTOR = 0.8;
const MIN_OVERLAY_WIDTH = 100;

export type ScreenSize = "16:9" | "9:16";
export type AspectRatio169 = "9:16" | "1:1" | "4:3" | "3:4";
export type AspectRatio916 = "16:9" | "1:1" | "4:3" | "21:9" | "3:4";
export type AspectRatio = AspectRatio169 | AspectRatio916;

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BoundaryBoxContextValue {
  screenSize: ScreenSize;
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  videoWidth: number;
  videoHeight: number;
  transform: Transform;
  setTransform: (t: Transform) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
  setVisible: (v: boolean) => void;
}

const ASPECT_RATIOS: Record<AspectRatio, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "21:9": 21 / 9,
};

const BoundaryBoxContext = React.createContext<BoundaryBoxContextValue | null>(
  null
);

function useBoundaryBoxContext() {
  const ctx = React.useContext(BoundaryBoxContext);
  if (!ctx) throw new Error("BoundaryBox context missing");
  return ctx;
}

interface BoundaryBoxRootProps {
  children: React.ReactNode;
  screenSize: ScreenSize;
  videoWidth?: number;
  videoHeight?: number;
  aspectRatio?: AspectRatio;
  defaultAspectRatio?: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  transform?: Transform;
  defaultTransform?: Transform;
  onTransformChange?: (t: Transform) => void;
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (v: boolean) => void;
}

export const BoundaryBoxRoot = ({
  children,
  screenSize,
  videoWidth = DEFAULT_VIDEO_WIDTH,
  videoHeight = DEFAULT_VIDEO_HEIGHT,
  aspectRatio: controlledAspectRatio,
  defaultAspectRatio,
  onAspectRatioChange,
  transform: controlledTransform,
  defaultTransform,
  onTransformChange,
  visible: controlledVisible,
  defaultVisible = false,
  onVisibleChange,
}: BoundaryBoxRootProps) => {
  const [aspectRatio, setAspectRatio] = useControllableState<AspectRatio>({
    defaultValue:
      defaultAspectRatio || (screenSize === "16:9" ? "9:16" : "16:9"),
    controlled: controlledAspectRatio,
    onChange: onAspectRatioChange,
  });

  const [transform, setTransform] = useControllableState<Transform>({
    defaultValue: defaultTransform || { x: 0, y: 0, width: 0, height: 0 },
    controlled: controlledTransform,
    onChange: onTransformChange,
  });

  const [visible, setVisible] = useControllableState<boolean>({
    defaultValue: defaultVisible,
    controlled: controlledVisible,
    onChange: onVisibleChange,
  });

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);

  const value = React.useMemo(
    () => ({
      screenSize,
      aspectRatio,
      setAspectRatio,
      videoWidth,
      videoHeight,
      transform,
      setTransform,
      containerRef,
      overlayRef,
      visible,
      setVisible,
    }),
    [
      screenSize,
      aspectRatio,
      setAspectRatio,
      videoWidth,
      videoHeight,
      transform,
      setTransform,
      visible,
      setVisible,
    ]
  );

  return (
    <BoundaryBoxContext.Provider value={value}>
      {children}
    </BoundaryBoxContext.Provider>
  );
};

interface BoundaryBoxContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const BoundaryBoxContent = React.forwardRef<
  HTMLDivElement,
  BoundaryBoxContentProps
>(({ className, children, ...props }, ref) => {
  const { screenSize, containerRef } = useBoundaryBoxContext();
  const composedRef = useComposedRefs(ref, containerRef);

  return (
    <div
      ref={composedRef}
      className={cn(
        "relative overflow-hidden",
        screenSize === "16:9" ? "aspect-video" : "aspect-[9/16]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
BoundaryBoxContent.displayName = "BoundaryBoxContent";

interface BoundaryBoxOverlayProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const BoundaryBoxOverlay = React.forwardRef<
  HTMLDivElement,
  BoundaryBoxOverlayProps
>((props, ref) => {
  const { className, children, ...rest } = props;
  const { aspectRatio, containerRef, overlayRef, setTransform, visible } =
    useBoundaryBoxContext();

  const composedRef = useComposedRefs(ref, overlayRef);
  const targetAspectRatio = ASPECT_RATIOS[aspectRatio];

  const calculateInitialSize = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return { width: 0, height: 0 };

    const rect = container.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;

    let width: number;
    let height: number;

    if (targetAspectRatio >= 1) {
      height = ch * 0.8;
      width = height * targetAspectRatio;
      if (width > cw) {
        width = cw * 0.8;
        height = width / targetAspectRatio;
      }
    } else {
      width = cw * 0.8;
      height = width / targetAspectRatio;
      if (height > ch) {
        height = ch * 0.8;
        width = height * targetAspectRatio;
      }
    }

    return { width, height };
  }, [containerRef, targetAspectRatio]);

  const initializeOverlay = React.useCallback(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    requestAnimationFrame(() => {
      const { width, height } = calculateInitialSize();
      const { width: cw, height: ch } = container.getBoundingClientRect();

      const x = (cw - width) / 2;
      const y = (ch - height) / 2;

      overlay.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;

      setTransform({ x, y, width, height });
    });
  }, [containerRef, overlayRef, calculateInitialSize, setTransform]);

  React.useLayoutEffect(() => {
    if (visible) initializeOverlay();
  }, [initializeOverlay, aspectRatio, visible]);

  if (!visible) return null;

  return (
    <div
      ref={composedRef}
      className={cn(
        "absolute will-change-transform pointer-events-auto border-2 border-primary bg-primary/10 shadow-lg",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

BoundaryBoxOverlay.displayName = "BoundaryBoxOverlay";

interface DraggableProps extends React.HTMLAttributes<HTMLDivElement> {}

const BoundaryBoxDraggable = React.forwardRef<HTMLDivElement, DraggableProps>(
  function BoundaryBoxDraggable({ className, children, ...props }, ref) {
    const { containerRef, overlayRef, setTransform } = useBoundaryBoxContext();

    const dragStateRef = React.useRef({
      isDragging: false,
      offsetX: 0,
      offsetY: 0,
      rafId: null as number | null,
    });

    const clampPosition = React.useCallback(
      (x: number, y: number, width: number, height: number) => {
        const container = containerRef.current;
        if (!container) return { x, y };

        const { width: containerWidth, height: containerHeight } =
          container.getBoundingClientRect();

        const maxX = containerWidth - width;
        const maxY = containerHeight - height;

        return {
          x: Math.max(0, Math.min(x, maxX)),
          y: Math.max(0, Math.min(y, maxY)),
        };
      },
      [containerRef]
    );

    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        const overlay = overlayRef.current;
        const container = containerRef.current;
        if (!overlay || !container) return;

        e.preventDefault();
        e.stopPropagation();

        const overlayRect = overlay.getBoundingClientRect();

        dragStateRef.current.isDragging = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        dragStateRef.current.offsetX = e.clientX - overlayRect.left;
        dragStateRef.current.offsetY = e.clientY - overlayRect.top;

        const move = (ev: PointerEvent) => {
          if (!dragStateRef.current.isDragging) return;

          if (dragStateRef.current.rafId) {
            cancelAnimationFrame(dragStateRef.current.rafId);
          }

          dragStateRef.current.rafId = requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();

            let x =
              ev.clientX - containerRect.left - dragStateRef.current.offsetX;
            let y =
              ev.clientY - containerRect.top - dragStateRef.current.offsetY;

            const width = overlay.offsetWidth;
            const height = overlay.offsetHeight;

            const clamped = clampPosition(x, y, width, height);

            overlay.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0)`;
          });
        };

        const up = (ev: PointerEvent) => {
          dragStateRef.current.isDragging = false;
          (e.target as HTMLElement).releasePointerCapture(ev.pointerId);

          if (dragStateRef.current.rafId) {
            cancelAnimationFrame(dragStateRef.current.rafId);
            dragStateRef.current.rafId = null;
          }

          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);

          const overlayRect = overlay.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          setTransform({
            x: overlayRect.left - containerRect.left,
            y: overlayRect.top - containerRect.top,
            width: overlayRect.width,
            height: overlayRect.height,
          });
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      },
      [overlayRef, containerRef, clampPosition, setTransform]
    );

    return (
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        className={cn(
          "absolute inset-0 cursor-move pointer-events-auto select-none touch-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

BoundaryBoxDraggable.displayName = "BoundaryBoxDraggable";

type ResizeSide = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface ResizableProps extends React.HTMLAttributes<HTMLDivElement> {
  side: ResizeSide;
}

const BoundaryBoxResizable = React.forwardRef<HTMLDivElement, ResizableProps>(
  (props, ref) => {
    const { className, side, ...rest } = props;
    const { setTransform, aspectRatio, containerRef, overlayRef } =
      useBoundaryBoxContext();

    const ratio = ASPECT_RATIOS[aspectRatio];
    const resizeStateRef = React.useRef({
      isResizing: false,
      rafId: null as number | null,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      startPosX: 0,
      startPosY: 0,
    });

    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        const overlay = overlayRef.current;
        const container = containerRef.current;
        if (!overlay || !container) return;

        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        const overlayRect = overlay.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        resizeStateRef.current = {
          isResizing: true,
          rafId: null,
          startX: e.clientX,
          startY: e.clientY,
          startWidth: overlayRect.width,
          startHeight: overlayRect.height,
          startPosX: overlayRect.left - containerRect.left,
          startPosY: overlayRect.top - containerRect.top,
        };

        const move = (ev: PointerEvent) => {
          if (!resizeStateRef.current.isResizing) return;

          if (resizeStateRef.current.rafId) {
            cancelAnimationFrame(resizeStateRef.current.rafId);
          }

          resizeStateRef.current.rafId = requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();
            const dx = ev.clientX - resizeStateRef.current.startX;
            const dy = ev.clientY - resizeStateRef.current.startY;

            let delta: number;
            switch (side) {
              case "top-left":
                delta = -Math.max(dx, dy);
                break;
              case "top-right":
                delta = Math.max(dx, -dy);
                break;
              case "bottom-left":
                delta = Math.max(-dx, dy);
                break;
              case "bottom-right":
              default:
                delta = Math.max(dx, dy);
                break;
            }

            const minWidth = 100;
            let newWidth = Math.max(
              minWidth,
              resizeStateRef.current.startWidth + delta
            );
            let newHeight = newWidth / ratio;

            let newX = resizeStateRef.current.startPosX;
            let newY = resizeStateRef.current.startPosY;

            switch (side) {
              case "top-left":
                newX -= newWidth - resizeStateRef.current.startWidth;
                newY -= newHeight - resizeStateRef.current.startHeight;
                break;
              case "top-right":
                newY -= newHeight - resizeStateRef.current.startHeight;
                break;
              case "bottom-left":
                newX -= newWidth - resizeStateRef.current.startWidth;
                break;
            }

            const maxX = containerRect.width - newWidth;
            const maxY = containerRect.height - newHeight;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            overlay.style.width = `${newWidth}px`;
            overlay.style.height = `${newHeight}px`;
            overlay.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
          });
        };

        const up = (ev: PointerEvent) => {
          resizeStateRef.current.isResizing = false;
          (e.target as HTMLElement).releasePointerCapture(ev.pointerId);

          if (resizeStateRef.current.rafId) {
            cancelAnimationFrame(resizeStateRef.current.rafId);
            resizeStateRef.current.rafId = null;
          }

          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);

          const overlayRect = overlay.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          setTransform({
            x: overlayRect.left - containerRect.left,
            y: overlayRect.top - containerRect.top,
            width: overlayRect.width,
            height: overlayRect.height,
          });
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      },
      [ratio, side, setTransform, containerRef, overlayRef]
    );

    const positionClass = React.useMemo(() => {
      switch (side) {
        case "top-left":
          return "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize";
        case "top-right":
          return "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize";
        case "bottom-left":
          return "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize";
        case "bottom-right":
        default:
          return "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize";
      }
    }, [side]);

    return (
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        className={cn(
          "absolute w-3 h-3 bg-primary rounded-full pointer-events-auto border-2 border-surface-primary shadow-md hover:scale-125 transition-transform z-10",
          positionClass,
          className
        )}
        {...rest}
      />
    );
  }
);

BoundaryBoxResizable.displayName = "BoundaryBoxResizable";

export const BoundaryBox = Object.assign(BoundaryBoxRoot, {
  Container: BoundaryBoxContent,
  Overlay: BoundaryBoxOverlay,
  Draggable: BoundaryBoxDraggable,
  Resizable: BoundaryBoxResizable,
});
