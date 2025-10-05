"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { debounce } from "@/utils/app";

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
        "absolute will-change-transform pointer-events-auto border border-primary bg-primary/10 shadow-lg",
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
        const containerEl = containerRef.current;
        if (!containerEl) return { x, y };

        const { width: cw, height: ch } = containerEl.getBoundingClientRect();
        const maxX = cw - width;
        const maxY = ch - height;

        return {
          x: Math.max(0, Math.min(x, maxX)),
          y: Math.max(0, Math.min(y, maxY)),
        };
      },
      [containerRef]
    );

    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        const overlayEl = overlayRef.current;
        const containerEl = containerRef.current;
        if (!overlayEl || !containerEl) return;

        e.preventDefault();
        e.stopPropagation();
        const targetEl = e.target as HTMLElement;
        targetEl.setPointerCapture(e.pointerId);

        const overlayRect = overlayEl.getBoundingClientRect();
        const state = dragStateRef.current;

        state.isDragging = true;
        state.offsetX = e.clientX - overlayRect.left;
        state.offsetY = e.clientY - overlayRect.top;

        const move = (ev: PointerEvent) => {
          if (!state.isDragging) return;

          if (state.rafId) cancelAnimationFrame(state.rafId);

          state.rafId = requestAnimationFrame(() => {
            const containerRect = containerEl.getBoundingClientRect();
            const { offsetX, offsetY } = state;

            const x = ev.clientX - containerRect.left - offsetX;
            const y = ev.clientY - containerRect.top - offsetY;

            const width = overlayEl.offsetWidth;
            const height = overlayEl.offsetHeight;
            const { x: clampedX, y: clampedY } = clampPosition(
              x,
              y,
              width,
              height
            );

            overlayEl.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
          });
        };

        const up = (ev: PointerEvent) => {
          state.isDragging = false;
          targetEl.releasePointerCapture(ev.pointerId);

          if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
          }

          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);

          const overlayRect = overlayEl.getBoundingClientRect();
          const containerRect = containerEl.getBoundingClientRect();

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
          "absolute inset-0 cursor-move pointer-events-none select-none touch-none",
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
        const overlayEl = overlayRef.current;
        const containerEl = containerRef.current;
        if (!overlayEl || !containerEl) return;

        e.preventDefault();
        e.stopPropagation();

        const targetEl = e.target as HTMLElement;
        targetEl.setPointerCapture(e.pointerId);

        const overlayRect = overlayEl.getBoundingClientRect();
        const containerRect = containerEl.getBoundingClientRect();

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
          const state = resizeStateRef.current;
          if (!state.isResizing) return;

          if (state.rafId) cancelAnimationFrame(state.rafId);

          state.rafId = requestAnimationFrame(() => {
            const { startX, startWidth, startHeight, startPosX, startPosY } =
              state;
            const containerRect = containerEl.getBoundingClientRect();
            const dx = ev.clientX - startX;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newX = startPosX;
            let newY = startPosY;

            switch (side) {
              case "bottom-right":
                newWidth = startWidth + dx;
                newHeight = newWidth / ratio;
                break;
              case "bottom-left":
                newWidth = startWidth - dx;
                newHeight = newWidth / ratio;
                newX = startPosX + (startWidth - newWidth);
                break;
              case "top-right":
                newWidth = startWidth + dx;
                newHeight = newWidth / ratio;
                newY = startPosY - (newHeight - startHeight);
                break;
              case "top-left":
                newWidth = startWidth - dx;
                newHeight = newWidth / ratio;
                newX = startPosX + (startWidth - newWidth);
                newY = startPosY - (newHeight - startHeight);
                break;
            }

            const maxWidthRight = containerRect.width - newX;
            const maxHeightBottom = containerRect.height - newY;
            const maxWidthLeft = startPosX + startWidth;
            const maxHeightTop = startPosY + startHeight;

            if (side.includes("right")) {
              newWidth = Math.min(newWidth, maxWidthRight);
              newHeight = newWidth / ratio;
            }
            if (side.includes("left")) {
              newWidth = Math.min(newWidth, maxWidthLeft);
              newHeight = newWidth / ratio;
              newX = startPosX + (startWidth - newWidth);
            }
            if (side.includes("bottom")) {
              newHeight = Math.min(newHeight, maxHeightBottom);
              newWidth = newHeight * ratio;
            }
            if (side.includes("top")) {
              newHeight = Math.min(newHeight, maxHeightTop);
              newWidth = newHeight * ratio;
              newY = startPosY + (startHeight - newHeight);
            }

            newWidth = Math.max(newWidth, MIN_OVERLAY_WIDTH);
            newHeight = Math.max(newHeight, MIN_OVERLAY_WIDTH / ratio);

            overlayEl.style.width = `${newWidth}px`;
            overlayEl.style.height = `${newHeight}px`;
            overlayEl.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
          });
        };

        const up = (ev: PointerEvent) => {
          const state = resizeStateRef.current;
          state.isResizing = false;
          targetEl.releasePointerCapture(ev.pointerId);

          if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
          }

          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);

          const overlayRect = overlayEl.getBoundingClientRect();
          const containerRect = containerEl.getBoundingClientRect();

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

    const debouncedUpdateTransform = React.useMemo(
      () =>
        debounce((x: number, y: number, width: number, height: number) => {
          setTransform({ x, y, width, height });
        }, 150),
      [setTransform]
    );

    React.useEffect(() => {
      const containerEl = containerRef.current;
      const overlayEl = overlayRef.current;
      if (!containerEl || !overlayEl) return;

      const update = () => {
        if (resizeStateRef.current.rafId)
          cancelAnimationFrame(resizeStateRef.current.rafId);

        resizeStateRef.current.rafId = requestAnimationFrame(() => {
          const containerRect = containerEl.getBoundingClientRect();
          const overlayRect = overlayEl.getBoundingClientRect();

          let newX = overlayRect.left - containerRect.left;
          let newY = overlayRect.top - containerRect.top;
          let newWidth = overlayRect.width;
          let newHeight = overlayRect.height;

          if (
            newWidth > containerRect.width ||
            newHeight > containerRect.height
          ) {
            const scale = Math.min(
              containerRect.width / newWidth,
              containerRect.height / newHeight
            );
            newWidth *= scale;
            newHeight *= scale;
          }

          if (newX + newWidth > containerRect.width)
            newX = containerRect.width - newWidth;
          if (newY + newHeight > containerRect.height)
            newY = containerRect.height - newHeight;
          if (newX < 0) newX = 0;
          if (newY < 0) newY = 0;

          overlayEl.style.width = `${newWidth}px`;
          overlayEl.style.height = `${newHeight}px`;
          overlayEl.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;

          debouncedUpdateTransform(newX, newY, newWidth, newHeight);
        });
      };

      const resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(containerEl);
      window.addEventListener("resize", update);

      return () => {
        if (resizeStateRef.current.rafId)
          cancelAnimationFrame(resizeStateRef.current.rafId);
        resizeObserver.disconnect();
        window.removeEventListener("resize", update);
      };
    }, [containerRef, overlayRef, debouncedUpdateTransform]);

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
          "absolute w-2.5 h-2.5 bg-primary pointer-events-auto border border-surface-primary shadow-md hover:scale-110 transition-transform z-10",
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
