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
import type { KeyframeTransform, KeyframeData } from "@/types/keyframe";

interface KeyframeContextValue {
  keyframes: KeyframeData[];
  currentKeyframeId: string | null;
  setCurrentKeyframeId: (id: string | null) => void;
  addKeyframe: (data: Omit<KeyframeData, "id">) => string;
  updateKeyframe: (id: string, updates: Partial<KeyframeData>) => void;
  deleteKeyframe: (id: string) => void;
  getKeyframe: (id: string) => KeyframeData | undefined;
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

export function useKeyframeContext() {
  const ctx = React.useContext(KeyframeContext);
  if (!ctx) throw new Error("Must be within Keyframe.Root");
  return ctx;
}

function useKeyframeBoxContext() {
  const ctx = React.useContext(KeyframeBoxContext);
  if (!ctx) throw new Error("Must be within Keyframe.Box");
  return ctx;
}

interface KeyframeRootProps {
  children: (context: KeyframeContextValue) => React.ReactNode;
  maxTime?: number;
  pxPerMs?: number;
  defaultKeyframes?: KeyframeData[];
  keyframes?: KeyframeData[];
  onKeyframesChange?: (keyframes: KeyframeData[]) => void;
  currentKeyframeId?: string | null;
  onCurrentKeyframeIdChange?: (id: string | null) => void;
}

function KeyframeRoot({
  children,
  maxTime = 20000,
  pxPerMs = 0.05,
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

  const addKeyframe = React.useCallback(
    (data: Omit<KeyframeData, "id">) => {
      const id = `kf-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      const newKeyframe: KeyframeData = { ...data, id };

      setKeyframes((prev) => [...prev, newKeyframe]);
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

  const value = React.useMemo(
    () => ({
      keyframes,
      currentKeyframeId,
      setCurrentKeyframeId,
      addKeyframe,
      updateKeyframe,
      deleteKeyframe,
      getKeyframe,
      maxTime,
      pxPerMs,
    }),
    [
      keyframes,
      currentKeyframeId,
      setCurrentKeyframeId,
      addKeyframe,
      updateKeyframe,
      deleteKeyframe,
      getKeyframe,
      maxTime,
      pxPerMs,
    ]
  );

  return (
    <KeyframeContext.Provider value={value}>
      {children(value)}
    </KeyframeContext.Provider>
  );
}

KeyframeRoot.displayName = "Keyframe.Root";

interface KeyframeMarkerProps extends React.HTMLAttributes<HTMLDivElement> {
  keyframeId: string;
  color?: string;
}

const KeyframeMarker = React.forwardRef<HTMLDivElement, KeyframeMarkerProps>(
  ({ keyframeId, color = "#3b82f6", className, ...props }, forwardedRef) => {
    const { getKeyframe, updateKeyframe, setCurrentKeyframeId, maxTime } =
      useKeyframeContext();

    const localRef = React.useRef<HTMLDivElement>(null);
    const markerRef = useComposedRefs(localRef, forwardedRef);
    const isDraggingRef = React.useRef(false);
    const rafRef = React.useRef<number | null>(null);
    const timelineRef = React.useRef<HTMLElement | null>(null);

    const keyframe = getKeyframe(keyframeId);
    if (!keyframe) return null;

    const setTimelineRef = React.useCallback((el: HTMLElement | null) => {
      timelineRef.current = el;
    }, []);

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

            const left = (newTime / maxTime) * 100;
            marker.style.transform = `translate3d(calc(${left}% - 50%), 0, 0)`;
          });
        };

        const handleUp = (e: PointerEvent) => {
          isDraggingRef.current = false;
          marker.releasePointerCapture(e.pointerId);

          if (rafRef.current) cancelAnimationFrame(rafRef.current);

          document.removeEventListener("pointermove", handleMove);
          document.removeEventListener("pointerup", handleUp);

          const x = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, x / rect.width));
          const newTime = Math.round((ratio * maxTime) / 100) * 100;

          updateKeyframe(keyframeId, { time: newTime });
        };

        document.addEventListener("pointermove", handleMove);
        document.addEventListener("pointerup", handleUp);
      },
      [keyframeId, maxTime, updateKeyframe]
    );

    const handleClick = React.useCallback(
      (e: React.MouseEvent) => {
        if (e.defaultPrevented) return;
        e.stopPropagation();
        setCurrentKeyframeId(keyframeId);
      },
      [keyframeId, setCurrentKeyframeId]
    );

    const left = (keyframe.time / maxTime) * 100;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={markerRef}
            data-timeline-ref-capture={setTimelineRef}
            className={cn(
              "absolute top-0 bottom-0 flex flex-col items-center cursor-ew-resize group z-10 will-change-transform",
              className
            )}
            style={{ transform: `translate3d(calc(${left}% - 50%), 0, 0)` }}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
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
          {(keyframe.time / 1000).toFixed(1)}s
        </TooltipContent>
      </Tooltip>
    );
  }
);

KeyframeMarker.displayName = "Keyframe.Marker";

interface KeyframeBoxProps extends React.HTMLAttributes<HTMLDivElement> {}

const KeyframeBox = React.forwardRef<HTMLDivElement, KeyframeBoxProps>(
  ({ className, children, ...props }, forwardedRef) => {
    const { currentKeyframeId, getKeyframe } = useKeyframeContext();

    const parentRef = React.useRef<HTMLDivElement>(null);
    const localRef = React.useRef<HTMLDivElement>(null);
    const boxRef = useComposedRefs(localRef, forwardedRef, parentRef);
    const positionRef = React.useRef({ x: 100, y: 100 });

    const keyframe = currentKeyframeId ? getKeyframe(currentKeyframeId) : null;

    const value = React.useMemo(
      () => ({ keyframeId: currentKeyframeId || "", parentRef }),
      [currentKeyframeId]
    );

    if (!keyframe || !currentKeyframeId) return null;

    return (
      <KeyframeBoxContext.Provider value={value}>
        <div
          ref={boxRef}
          className={cn(
            "fixed bg-surface-primary rounded-lg shadow-2xl border border-subtle min-w-[280px] z-50 will-change-transform",
            className
          )}
          style={{
            transform: `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`,
          }}
          {...props}
        >
          {children}
        </div>
      </KeyframeBoxContext.Provider>
    );
  }
);

KeyframeBox.displayName = "Keyframe.Box";

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
          box.style.transform = `translate3d(${x}px, ${y}px, 0)`;
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

KeyframeBoxHeader.displayName = "Keyframe.BoxHeader";

interface KeyframeBoxCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const KeyframeBoxClose = React.forwardRef<
  HTMLButtonElement,
  KeyframeBoxCloseProps
>((props, forwardedRef) => {
  const { setCurrentKeyframeId } = useKeyframeContext();

  return (
    <Button
      ref={forwardedRef}
      data-close-button
      variant="ghost"
      size="icon"
      onClick={() => setCurrentKeyframeId(null)}
      className="ml-auto"
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
  return (
    <div
      ref={forwardedRef}
      className={cn("p-4 space-y-3", className)}
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
