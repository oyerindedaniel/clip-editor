"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useComposedRefs } from "@/hooks/use-composed-refs";

interface KeyframeTransform {
  x: number;
  y: number;
  scale: number;
}

interface KeyframeData {
  id: string;
  time: number;
  transform: KeyframeTransform;
  easing: string;
}

interface KeyframeContextValue {
  keyframes: Map<string, KeyframeData>;
  updateKeyframe: (id: string, updates: Partial<KeyframeData>) => void;
  getKeyframe: (id: string) => KeyframeData | undefined;
  openBoxes: Set<string>;
  toggleBox: (id: string) => void;
  closeBox: (id: string) => void;
  maxTime: number;
  pxPerMs: number;
}

interface KeyframeBoxContextValue {
  keyframeId: string;
  parentRef: React.RefObject<HTMLDivElement | null>;
}

const KeyframeContext = React.createContext<KeyframeContextValue | null>(null);
const KeyframeBoxContext = React.createContext<KeyframeBoxContextValue | null>(
  null
);

function useKeyframeContext() {
  const ctx = React.useContext(KeyframeContext);
  if (!ctx) throw new Error("Must be used within Keyframe.Root");
  return ctx;
}

function useKeyframeBoxContext() {
  const ctx = React.useContext(KeyframeBoxContext);
  if (!ctx) throw new Error("Must be used within Keyframe.Box");
  return ctx;
}

interface KeyframeRootProps {
  children: React.ReactNode;
  maxTime?: number;
  pxPerMs?: number;
  defaultKeyframes?: KeyframeData[];
  keyframes?: Map<string, KeyframeData>;
  onKeyframesChange?: (keyframes: Map<string, KeyframeData>) => void;
}

function KeyframeRoot({
  children,
  maxTime = 20000,
  pxPerMs = 0.05,
  defaultKeyframes = [],
  keyframes: controlledKeyframes,
  onKeyframesChange,
}: KeyframeRootProps) {
  const [keyframes, setKeyframes] = useControllableState<
    Map<string, KeyframeData>
  >({
    defaultValue: new Map(defaultKeyframes.map((kf) => [kf.id, kf])),
    controlled: controlledKeyframes,
    onChange: onKeyframesChange,
  });

  const [openBoxes, setOpenBoxes] = React.useState<Set<string>>(new Set());

  const updateKeyframe = React.useCallback(
    (id: string, updates: Partial<KeyframeData>) => {
      setKeyframes((prev) => {
        const next = new Map(prev);
        const current = next.get(id);
        if (current) next.set(id, { ...current, ...updates });
        else
          next.set(id, {
            id,
            time: 0,
            transform: { x: 0, y: 0, scale: 1 },
            easing: "ease-in-out",
            ...updates,
          });
        return next;
      });
    },
    [setKeyframes]
  );

  const getKeyframe = React.useCallback(
    (id: string) => keyframes.get(id),
    [keyframes]
  );

  const toggleBox = React.useCallback((id: string) => {
    setOpenBoxes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const closeBox = React.useCallback((id: string) => {
    setOpenBoxes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({
      keyframes,
      updateKeyframe,
      getKeyframe,
      openBoxes,
      toggleBox,
      closeBox,
      maxTime,
      pxPerMs,
    }),
    [
      keyframes,
      updateKeyframe,
      getKeyframe,
      openBoxes,
      toggleBox,
      closeBox,
      maxTime,
      pxPerMs,
    ]
  );

  return (
    <KeyframeContext.Provider value={value}>
      {children}
    </KeyframeContext.Provider>
  );
}

interface KeyframeMarkerProps {
  keyframeId: string;
  time: number;
  color?: string;
  transform?: KeyframeTransform;
  easing?: string;
  onTimeChange?: (time: number) => void;
}

export const KeyframeMarker = React.forwardRef<
  HTMLDivElement,
  KeyframeMarkerProps
>(
  (
    {
      keyframeId,
      time: initialTime,
      color = "#3b82f6",
      transform = { x: 0, y: 0, scale: 1 },
      easing = "ease-in-out",
      onTimeChange,
      ...props
    },
    forwardedRef
  ) => {
    const { updateKeyframe, toggleBox, maxTime } = useKeyframeContext();
    const localRef = React.useRef<HTMLDivElement>(null);
    const markerRef = useComposedRefs(localRef, forwardedRef);
    const isDraggingRef = React.useRef(false);
    const rafRef = React.useRef<number | null>(null);
    const timelineRef = React.useRef<HTMLElement | null>(null);
    const [time, setTime] = React.useState(initialTime);

    const setTimelineRef = React.useCallback((el: HTMLElement | null) => {
      timelineRef.current = el;
    }, []);

    React.useLayoutEffect(() => {
      updateKeyframe(keyframeId, {
        id: keyframeId,
        time: initialTime,
        transform,
        easing,
      });
    }, [keyframeId, initialTime, transform, easing, updateKeyframe]);

    const handlePointerDown = React.useCallback(
      (event: React.PointerEvent) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();

        const marker = localRef.current;
        const timeline = timelineRef.current;
        if (!marker || !timeline) return;

        isDraggingRef.current = true;
        marker.setPointerCapture(event.pointerId);

        const rect = timeline.getBoundingClientRect();

        const handleMove = (e: PointerEvent) => {
          if (!isDraggingRef.current) return;
          if (rafRef.current) cancelAnimationFrame(rafRef.current);

          rafRef.current = requestAnimationFrame(() => {
            const x = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, x / rect.width));
            const newTime = Math.round((ratio * maxTime) / 100) * 100;
            setTime(newTime);
            const left = (newTime / maxTime) * 100;
            marker.style.transform = `translate3d(calc(${left}% - 50%),0,0)`;
          });
        };

        const handleUp = (e: PointerEvent) => {
          isDraggingRef.current = false;
          marker.releasePointerCapture(e.pointerId);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          document.removeEventListener("pointermove", handleMove);
          document.removeEventListener("pointerup", handleUp);
          updateKeyframe(keyframeId, { time });
          onTimeChange?.(time);
        };

        document.addEventListener("pointermove", handleMove);
        document.addEventListener("pointerup", handleUp);
      },
      [keyframeId, maxTime, updateKeyframe, onTimeChange, time]
    );

    const left = (time / maxTime) * 100;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={markerRef}
            data-timeline-ref-capture={setTimelineRef}
            className={cn(
              "absolute top-0 bottom-0 flex flex-col items-center cursor-ew-resize group z-10 will-change-transform"
            )}
            style={{ transform: `translate3d(calc(${left}% - 50%),0,0)` }}
            onPointerDown={handlePointerDown}
            onClick={(e) => {
              if (e.defaultPrevented) return;
              e.stopPropagation();
              toggleBox(keyframeId);
            }}
            {...props}
          >
            <div
              className="w-0.5 h-full transition-all group-hover:w-1 bg-(--color)"
              style={{ "--color": color } as React.CSSProperties}
            />
            <div
              className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-(--color) rounded-full border-2 border-surface-primary shadow-lg transition-transform group-hover:scale-125"
              style={{ "--color": color } as React.CSSProperties}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent sideOffset={10}>
          {(time / 1000).toFixed(1)}s
        </TooltipContent>
      </Tooltip>
    );
  }
);

interface KeyframeBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  keyframeId: string;
  defaultOpen?: boolean;
}

const KeyframeBox = React.forwardRef<HTMLDivElement, KeyframeBoxProps>(
  ({ keyframeId, defaultOpen = false, className, children }, forwardedRef) => {
    const { openBoxes, getKeyframe, toggleBox } = useKeyframeContext();
    const parentRef = React.useRef<HTMLDivElement>(null);
    const localRef = React.useRef<HTMLDivElement>(null);
    const boxRef = useComposedRefs(localRef, forwardedRef, parentRef);
    const positionRef = React.useRef({ x: 100, y: 100 });

    React.useEffect(() => {
      if (defaultOpen) toggleBox(keyframeId);
    }, [defaultOpen, keyframeId, toggleBox]);

    const isOpen = openBoxes.has(keyframeId);
    const keyframe = getKeyframe(keyframeId);
    if (!isOpen || !keyframe) return null;

    const value = React.useMemo(
      () => ({ keyframeId, parentRef }),
      [keyframeId]
    );

    return (
      <KeyframeBoxContext.Provider value={value}>
        <div
          ref={boxRef}
          className={cn(
            "fixed bg-surface-primary rounded-lg shadow-2xl border border-subtle min-w-[280px] z-50 will-change-transform",
            className
          )}
          style={{
            transform: `translate3d(${positionRef.current.x}px,${positionRef.current.y}px,0)`,
          }}
        >
          {children}
        </div>
      </KeyframeBoxContext.Provider>
    );
  }
);

interface KeyframeBoxHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const KeyframeBoxHeader = React.forwardRef<
  HTMLDivElement,
  KeyframeBoxHeaderProps
>(({ children, className, ...props }, forwardedRef) => {
  const { parentRef } = useKeyframeBoxContext();
  const localRef = React.useRef<HTMLDivElement>(null);
  const boxRef = useComposedRefs(localRef, forwardedRef);
  const isDraggingRef = React.useRef(false);
  const offsetRef = React.useRef({ x: 0, y: 0 });
  const rafRef = React.useRef<number | null>(null);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent) => {
      if ((event.target as HTMLElement).dataset.closeButton !== undefined)
        return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      const header = localRef.current;
      const box = parentRef.current;
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
          box.style.transform = `translate3d(${x}px,${y}px,0)`;
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
    [parentRef]
  );

  return (
    <div
      ref={boxRef}
      onPointerDown={handlePointerDown}
      className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-subtle bg-surface-secondary rounded-t-lg cursor-move",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-foreground-muted" />
        <div className="font-semibold text-sm text-foreground-default">
          {children}
        </div>
      </div>
    </div>
  );
});

interface KeyframeBoxCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const KeyframeBoxClose = React.forwardRef<
  HTMLButtonElement,
  KeyframeBoxCloseProps
>((props, forwardedRef) => {
  const { keyframeId } = useKeyframeBoxContext();
  const { closeBox } = useKeyframeContext();
  return (
    <Button
      ref={forwardedRef}
      data-close-button
      variant="ghost"
      size="icon"
      onClick={() => closeBox(keyframeId)}
      className="ml-auto"
      {...props}
    >
      <X className="w-4 h-4" />
    </Button>
  );
});

interface KeyframeBoxContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const KeyframeBoxContent = React.forwardRef<
  HTMLDivElement,
  KeyframeBoxContentProps
>(({ className, ...props }, forwardedRef) => {
  const composedRef = useComposedRefs(forwardedRef);
  return (
    <div
      ref={composedRef}
      className={cn("p-4 space-y-3", className)}
      {...props}
    />
  );
});

export const Keyframe = Object.assign(KeyframeRoot, {
  Marker: KeyframeMarker,
  Box: KeyframeBox,
  BoxHeader: KeyframeBoxHeader,
  BoxClose: KeyframeBoxClose,
  BoxContent: KeyframeBoxContent,
});
