"use client";

import * as React from "react";
import { X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import type { KeyframeData, KeyframeTarget } from "@/utils/keyframe";
import { useAutoScroll } from "@/hooks/app/use-auto-scroll";
import { TimelineTooltip } from "./timeline-tooltip";
import { getState, useAnimatePresence } from "@/hooks/use-animate-presence";
import type { AnimationState } from "@/hooks/use-animate-presence";
import type { Color } from "./color-palette";
import { getScrollState } from "@/utils/timeline-utils";
import { HitArea } from "./hit-area";
import { useTimelineTooltip } from "@/hooks/app/use-timeline-tooltip";

export type KeyframeBounds = { start: number; end: number };

interface KeyframeContextValue {
  keyframes: KeyframeData[];
  currentKeyframeId: string | null;
  setCurrentKeyframeId: (id: string | null) => void;
  addKeyframe: (data: Omit<KeyframeData, "id">) => string;
  updateKeyframe: (id: string, updates: Partial<KeyframeData>) => void;
  deleteKeyframe: (id: string) => void;
  getKeyframe: (id: string) => KeyframeData | undefined;
  updateColors: (id: string, color: Color) => void;
  getKeyframeBounds: (
    keyframes: KeyframeData[]
  ) => Record<KeyframeTarget, KeyframeBounds>;
  maxTime: number;
}

const KeyframeContext = React.createContext<KeyframeContextValue | null>(null);

export function useKeyframeContext() {
  const ctx = React.useContext(KeyframeContext);
  if (!ctx) throw new Error("Must be within Keyframe.Root");
  return ctx;
}

interface KeyframeRootProps {
  children:
    | React.ReactNode
    | ((context: KeyframeContextValue) => React.ReactNode);
  maxTime?: number;
  defaultKeyframes?: KeyframeData[];
  keyframes?: KeyframeData[];
  onKeyframesChange?: (keyframes: KeyframeData[]) => void;
  currentKeyframeId?: string | null;
  onCurrentKeyframeIdChange?: (id: string | null) => void;
}

function KeyframeRoot({
  children,
  maxTime = 20000,
  defaultKeyframes = [],
  keyframes: controlledKeyframes,
  onKeyframesChange,
  currentKeyframeId: controlledCurrentId,
  onCurrentKeyframeIdChange,
}: KeyframeRootProps) {
  const [keyframes, setKeyframes] = useControllableState<KeyframeData[]>({
    defaultValue: defaultKeyframes,
    controlled: controlledKeyframes,
    onChange: onKeyframesChange,
  });

  const [currentKeyframeId, setCurrentKeyframeId] = useControllableState<
    string | null
  >({
    defaultValue: null,
    controlled: controlledCurrentId,
    onChange: onCurrentKeyframeIdChange,
  });

  const getKeyframeBounds = React.useCallback(
    (keyframes: KeyframeData[]): Record<KeyframeTarget, KeyframeBounds> => {
      if (keyframes.length === 0) {
        return {
          primary: { start: 0, end: 0 },
          secondary: { start: 0, end: 0 },
        };
      }

      const grouped: Record<KeyframeTarget, KeyframeData[]> = {
        primary: [],
        secondary: [],
      };

      for (let i = 0; i < keyframes.length; i++) {
        const kf = keyframes[i];
        grouped[kf.target].push(kf);
      }

      const result: Record<KeyframeTarget, KeyframeBounds> = {
        primary: { start: 0, end: 0 },
        secondary: { start: 0, end: 0 },
      };

      (Object.keys(grouped) as KeyframeTarget[]).forEach((target) => {
        const frames = grouped[target];
        if (frames.length === 0) return;

        const sorted = frames.slice().sort((a, b) => a.time - b.time);
        result[target] = {
          start: sorted[0].time,
          end: sorted[sorted.length - 1].time,
        };
      });

      return result;
    },
    []
  );

  const addKeyframe = React.useCallback(
    (data: Omit<KeyframeData, "id">) => {
      const id = `kf-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      setKeyframes((prev) => {
        const count = prev.length + 1;
        const newKeyframe: KeyframeData = {
          ...data,
          id,
          name: `#keyframe${count}`,
        };
        return [...prev, newKeyframe];
      });

      setCurrentKeyframeId(id);
      return id;
    },
    [setKeyframes, setCurrentKeyframeId]
  );

  const updateKeyframe = React.useCallback(
    (id: string, updates: Partial<KeyframeData>) => {
      setKeyframes((prev) =>
        prev.map((kf) => (kf.id === id ? { ...kf, ...updates } : kf))
      );
    },
    [setKeyframes]
  );

  const deleteKeyframe = React.useCallback(
    (id: string) => {
      setKeyframes((prev) => prev.filter((kf) => kf.id !== id));
      if (currentKeyframeId === id) {
        setCurrentKeyframeId(null);
      }
    },
    [setKeyframes, currentKeyframeId, setCurrentKeyframeId]
  );

  const getKeyframe = React.useCallback(
    (id: string) => keyframes.find((kf) => kf.id === id),
    [keyframes]
  );

  const updateColors = React.useCallback(
    (id: string, color: Color) => {
      setKeyframes((prev) =>
        prev.map((kf) => (kf.id === id ? { ...kf, color } : kf))
      );
    },
    [setKeyframes]
  );

  const value = React.useMemo(
    () => ({
      keyframes,
      currentKeyframeId,
      setCurrentKeyframeId,
      addKeyframe,
      updateKeyframe,
      deleteKeyframe,
      getKeyframe,
      updateColors,
      maxTime,
      getKeyframeBounds,
    }),
    [
      keyframes,
      currentKeyframeId,
      setCurrentKeyframeId,
      addKeyframe,
      updateKeyframe,
      deleteKeyframe,
      getKeyframe,
      updateColors,
      maxTime,
      getKeyframeBounds,
    ]
  );

  return (
    <KeyframeContext.Provider value={value}>
      {typeof children === "function" ? children(value) : children}
    </KeyframeContext.Provider>
  );
}

KeyframeRoot.displayName = "Keyframe.Root";

interface KeyframeMarkerProps extends React.HTMLAttributes<HTMLDivElement> {
  keyframeId: string;
  color?: Color;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  pxPerMs: number;
  edgeThreshold?: number;
}

const KeyframeMarker = React.forwardRef<HTMLDivElement, KeyframeMarkerProps>(
  (
    {
      keyframeId,
      color,
      className,
      style,
      scrollRef,
      pxPerMs,
      edgeThreshold = 50,
      ...props
    },
    forwardedRef
  ) => {
    const { getKeyframe, updateKeyframe, setCurrentKeyframeId } =
      useKeyframeContext();

    const keyframe = getKeyframe(keyframeId);
    const resolvedColor = color ?? keyframe?.color ?? "#3b82f6";

    const markerRef = React.useRef<HTMLDivElement>(null);
    const tooltipRef = React.useRef<HTMLDivElement>(null);
    const composedRef = useComposedRefs(forwardedRef, markerRef);
    const scrollEl = scrollRef?.current;

    const isDragging = React.useRef(false);
    const dragStartX = React.useRef(0);
    const startTimeRef = React.useRef(0);
    const dragTimeRef = React.useRef(0);
    const rafId = React.useRef(0);
    const moved = React.useRef(false);

    const [visible, setVisible] = React.useState(false);

    const { handleAutoScroll, startAutoScroll, stopAutoScroll } = useAutoScroll(
      {
        edgeThreshold,
        maxScrollSpeed: 10,
        acceleration: 1.2,
      }
    );

    const { updateTooltip, lastTooltipState } = useTimelineTooltip({
      tooltipRef,
      scrollContainerRef: scrollRef,
      edgeThreshold,
    });

    // keyframe.time is stored in seconds; convert to milliseconds for layout math
    const keyframeTimeMs = keyframe ? keyframe.time * 1000 : 0;
    const left = keyframeTimeMs * pxPerMs;

    React.useLayoutEffect(() => {
      const el = markerRef.current;
      if (el) el.style.transform = `translate3d(${left}px,0,0)`;
    }, [left]);

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!keyframe || !scrollEl) return;

        const marker = markerRef.current;
        if (!marker) return;

        marker.setPointerCapture(e.pointerId);

        isDragging.current = true;
        moved.current = false;
        dragStartX.current = e.clientX;

        startTimeRef.current = keyframeTimeMs;
        dragTimeRef.current = keyframeTimeMs;

        setVisible(true);

        updateTooltip(
          startTimeRef.current * pxPerMs,
          `${keyframe.time.toFixed(2)}s`
        );

        startAutoScroll(scrollEl, (scrollDelta) => {
          const el = markerRef.current;
          const container = scrollEl;
          if (!isDragging.current || !el || !container) return;

          const { canScrollLeft, canScrollRight } = getScrollState(container);
          const { scrollLeft } = container;

          const isLeft = scrollDelta < 0;
          const isRight = scrollDelta > 0;

          if ((isLeft && canScrollLeft) || (isRight && canScrollRight)) return;

          const newTimeMs = Math.max(
            0,
            dragTimeRef.current + scrollDelta / pxPerMs
          );
          const newLeftPx = Math.min(
            Math.max(0, newTimeMs * pxPerMs),
            container.scrollWidth
          );

          el.style.transform = `translate3d(${newLeftPx}px,0,0)`;
          updateTooltip(
            newLeftPx - scrollLeft,
            `${(newTimeMs / 1000).toFixed(2)}s`
          );

          dragTimeRef.current = newTimeMs;
        });

        const onPointerMove = (moveEvent: PointerEvent) => {
          if (!isDragging.current) return;

          cancelAnimationFrame(rafId.current);
          rafId.current = requestAnimationFrame(() => {
            const container = scrollEl;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const { scrollLeft } = container;

            const { containerWidth, canScrollLeft, canScrollRight } =
              getScrollState(container);

            const mouseX = moveEvent.clientX - rect.left;

            const needsLeftScroll = mouseX <= edgeThreshold && canScrollLeft;
            const needsRightScroll =
              mouseX >= containerWidth - edgeThreshold && canScrollRight;

            const shouldControlMarker = !needsLeftScroll && !needsRightScroll;

            if (needsLeftScroll || needsRightScroll) {
              handleAutoScroll(moveEvent);
            }

            if (shouldControlMarker) {
              const deltaPx = moveEvent.clientX - dragStartX.current;
              const newTimeMs = Math.max(
                0,
                startTimeRef.current + deltaPx / pxPerMs
              );
              dragTimeRef.current = newTimeMs;

              const newLeftPx = Math.min(
                Math.max(0, newTimeMs * pxPerMs + scrollLeft),
                container.scrollWidth
              );

              const el = markerRef.current;
              if (el) el.style.transform = `translate3d(${newLeftPx}px,0,0)`;

              moved.current = true;
              updateTooltip(
                newLeftPx - scrollLeft,
                `${(newTimeMs / 1000).toFixed(2)}s`
              );
            }
          });
        };

        const onPointerUp = (upEvent: PointerEvent) => {
          if (!isDragging.current) return;

          isDragging.current = false;
          cancelAnimationFrame(rafId.current);
          stopAutoScroll();
          setVisible(false);

          const el = markerRef.current;
          if (el) el.releasePointerCapture(upEvent.pointerId);

          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);

          if (!moved.current) return;

          const newTimeSec = Math.max(0, dragTimeRef.current / 1000);
          updateKeyframe(keyframeId, { time: newTimeSec });
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      },
      [
        keyframe,
        keyframeId,
        pxPerMs,
        scrollEl,
        startAutoScroll,
        stopAutoScroll,
        handleAutoScroll,
        updateTooltip,
        updateKeyframe,
      ]
    );

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.defaultPrevented) return;
        if (moved.current) return;
        setCurrentKeyframeId(keyframeId);
      },
      [keyframeId, setCurrentKeyframeId]
    );

    return (
      <>
        <div
          ref={composedRef}
          className={cn(
            "absolute top-0 bottom-0 flex flex-col items-center cursor-ew-resize z-10 will-change-transform",
            className
          )}
          style={{
            ...style,
            transform: `translate3d(${left}px,0,0)`,
          }}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          {...props}
        >
          <HitArea variant="x">
            <div className="relative h-full">
              <div
                className="w-0.5 h-full transition-all group-hover:w-1 bg-(--color)"
                style={{ "--color": resolvedColor } as React.CSSProperties}
              />
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-(--color) border border-surface-primary shadow-lg hover:scale-110 transition-transform"
                style={{ "--color": resolvedColor } as React.CSSProperties}
              />
            </div>
          </HitArea>
        </div>

        <TimelineTooltip
          ref={tooltipRef}
          tooltipState={lastTooltipState}
          visible={visible}
          container={scrollEl}
        />
      </>
    );
  }
);

KeyframeMarker.displayName = "KeyframeMarker";

interface KeyframeBoxContextValue {
  keyframeId: string;
  boxRef: React.RefObject<HTMLDivElement | null>;
  boxId: string;
  boxHeaderId: string;
  boxContentId: string;
  handleClose: () => void;
}

const KeyframeBoxContext = React.createContext<KeyframeBoxContextValue | null>(
  null
);

function useKeyframeBoxContext() {
  const ctx = React.useContext(KeyframeBoxContext);
  if (!ctx) throw new Error("Must be within Keyframe.Box");
  return ctx;
}

interface KeyframeBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const KeyframeBox = React.forwardRef<HTMLDivElement, KeyframeBoxProps>(
  ({ className, children, triggerRef, ...props }, forwardedRef) => {
    const { currentKeyframeId, getKeyframe, setCurrentKeyframeId } =
      useKeyframeContext();

    const keyframe = currentKeyframeId ? getKeyframe(currentKeyframeId) : null;

    const boxId = React.useId();
    const boxHeaderId = `${boxId}-header`;
    const boxContentId = `${boxId}-content`;

    const boxRef = React.useRef<HTMLDivElement>(null);
    const composedRefs = useComposedRefs(boxRef, forwardedRef);

    const positionRef = React.useRef({ x: 100, y: 100 });

    const [isClosing, setIsClosing] = React.useState(false);

    const handleClose = React.useCallback(() => {
      if (isClosing) return;
      setIsClosing(true);
    }, [isClosing]);

    const trapFocus = React.useCallback((reverse = false) => {
      const container = boxRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusables.length) return;
      (reverse ? focusables.at(-1) : focusables.at(0))?.focus();
    }, []);

    const [animationState, setAnimationState] =
      React.useState<AnimationState>("idle");

    const handleAnimation = (presence: boolean) => {
      return new Promise<void>((resolve) => {
        const box = boxRef.current!;

        if (presence) {
          setAnimationState("entering");
          resolve();
          return;
        }

        if (!box) return;

        setAnimationState("exiting");

        const onEnd = () => {
          setAnimationState("idle");
          box.removeEventListener("animationend", onEnd);
          resolve();
          setIsClosing(false);
          setCurrentKeyframeId(null);
        };

        box.addEventListener("animationend", onEnd);
      });
    };

    const isVisible = !!keyframe && !isClosing;

    const shouldRender = useAnimatePresence(isVisible, handleAnimation, {
      initial: false,
    });

    React.useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setCurrentKeyframeId(null);
        }
      };
      document.addEventListener("keydown", handleKey, { capture: true });
      return () =>
        document.removeEventListener("keydown", handleKey, { capture: true });
    }, [setCurrentKeyframeId]);

    React.useEffect(() => {
      if (!shouldRender || !boxRef.current) return;
      const el = boxRef.current;
      const focusable = el.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable ?? el).focus();
    }, [shouldRender]);

    React.useLayoutEffect(() => {
      if (!triggerRef?.current) return;
      const trigger = triggerRef.current;
      const rect = trigger.getBoundingClientRect();

      positionRef.current = {
        x: rect.left + trigger.offsetWidth / 2,
        y: rect.bottom + 8,
      };
    }, []);

    const state = getState(animationState);

    const value = React.useMemo(
      () => ({
        keyframeId: currentKeyframeId || "",
        boxRef,
        boxId,
        boxHeaderId,
        boxContentId,
        handleClose,
      }),
      [currentKeyframeId, boxId, boxHeaderId, boxContentId, handleClose]
    );

    if (!shouldRender) return null;

    return (
      <KeyframeBoxContext.Provider value={value}>
        <div tabIndex={0} aria-hidden="true" onFocus={() => trapFocus(true)} />
        <div
          ref={composedRefs}
          role="dialog"
          aria-modal="true"
          aria-labelledby={boxHeaderId}
          aria-describedby={boxContentId}
          data-state={state}
          tabIndex={-1}
          className={cn(
            "fixed bg-surface-primary left-0 top-0 rounded-3xl overflow-hidden shadow-2xl border border-subtle w-[260px] z-50 will-change-transform",
            "origin-top-left data-[state=open]:animate-box-enter data-[state=closed]:animate-box-exit",
            className
          )}
          style={{
            transform: `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0) scale(1)`,
          }}
          {...props}
        >
          {children}
        </div>
        <div tabIndex={0} aria-hidden="true" onFocus={() => trapFocus(false)} />
      </KeyframeBoxContext.Provider>
    );
  }
);

KeyframeBox.displayName = "Keyframe.Box";

interface KeyframeBoxHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const KeyframeBoxHeader = React.forwardRef<
  HTMLDivElement,
  KeyframeBoxHeaderProps
>(({ children, className, onPointerDown, ...props }, forwardedRef) => {
  const { boxRef, boxHeaderId } = useKeyframeBoxContext();
  const boxHeaderRef = React.useRef<HTMLDivElement>(null);
  const composedRefs = useComposedRefs(boxHeaderRef, forwardedRef);
  const isDraggingRef = React.useRef(false);
  const offsetRef = React.useRef({ x: 0, y: 0 });
  const rafRef = React.useRef<number | null>(null);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();

      const header = boxHeaderRef.current;
      const box = boxRef.current;
      if (!header || !box) return;

      isDraggingRef.current = true;
      header.setPointerCapture(event.pointerId);

      const rect = box.getBoundingClientRect();
      offsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      const handleMove = (e: PointerEvent) => {
        if (!isDraggingRef.current) return;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        rafRef.current = requestAnimationFrame(() => {
          const x = e.clientX - offsetRef.current.x;
          const y = e.clientY - offsetRef.current.y;
          box.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1)`;
        });
      };

      const handleUp = (e: PointerEvent) => {
        isDraggingRef.current = false;
        header.releasePointerCapture(e.pointerId);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
      };

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    []
  );

  return (
    <div
      id={boxHeaderId}
      ref={composedRefs}
      onPointerDown={handlePointerDown}
      className={cn(
        "flex items-center justify-between pl-4 pr-2 py-2 w-full border-b border-subtle bg-surface-secondary rounded-t-3xl cursor-move",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 w-full">
        <GripVertical className="w-4 h-4 text-foreground-muted" />
        <div className="font-semibold flex items-center justify-between w-full text-sm text-foreground-default">
          {children}
        </div>
      </div>
    </div>
  );
});

KeyframeBoxHeader.displayName = "Keyframe.BoxHeader";

interface KeyframeBoxCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const KeyframeBoxClose = React.forwardRef<
  HTMLButtonElement,
  KeyframeBoxCloseProps
>((props, forwardedRef) => {
  const { handleClose } = useKeyframeBoxContext();

  return (
    <Button
      ref={forwardedRef}
      variant="ghost"
      size="icon"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={handleClose}
      aria-label="Close keyframe"
      className="ml-auto cursor-pointer active:cursor-pointer"
      {...props}
    >
      <X className="w-4 h-4" />
    </Button>
  );
});

KeyframeBoxClose.displayName = "Keyframe.BoxClose";

interface KeyframeBoxContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const KeyframeBoxContent = React.forwardRef<
  HTMLDivElement,
  KeyframeBoxContentProps
>(({ className, ...props }, forwardedRef) => {
  const { boxContentId } = useKeyframeBoxContext();
  return (
    <div
      ref={forwardedRef}
      id={boxContentId}
      className={cn("p-4 space-y-3 text-foreground-default", className)}
      {...props}
    />
  );
});

KeyframeBoxContent.displayName = "Keyframe.BoxContent";

export const Keyframe = {
  Root: KeyframeRoot,
  Marker: KeyframeMarker,
  Box: KeyframeBox,
  BoxHeader: KeyframeBoxHeader,
  BoxClose: KeyframeBoxClose,
  BoxContent: KeyframeBoxContent,
};
