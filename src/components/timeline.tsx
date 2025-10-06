import React, {
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  memo,
} from "react";
import { GripVertical } from "lucide-react";
import { useScale } from "@/hooks/app/use-scale";
import { useAutoScroll } from "@/hooks/app/use-auto-scroll";
import { formatDurationDisplay } from "@/utils/app";
import {
  renderTimelineStrips,
  renderTimelineRuler,
  msToPx,
  pxToMs,
  getScrollState,
} from "@/utils/timeline-utils";
import { cn } from "@/lib/utils";
import { ClipContext } from "@/contexts/clip-context";
import { useShallowSelector } from "react-shallow-store";
import type { KeyframeData } from "@/utils/keyframe";
import { Keyframe } from "./keyframe";

interface TimelineProps {
  duration: number;
  onTrim: (startTime: number, endTime: number) => void;
  frames?: string[];
  keyframes: KeyframeData[];
}

type Dir = "left" | "right";

const Timeline: React.FC<TimelineProps> = ({
  duration,
  onTrim,
  frames,
  keyframes,
}) => {
  const { setPrimaryTrim } = useShallowSelector(ClipContext, (state) => ({
    setPrimaryTrim: state.setPrimaryTrim,
  }));

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const leftHandleRef = useRef<HTMLDivElement>(null);
  const rightHandleRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  const leftTooltipContentRef = useRef<HTMLSpanElement>(null);
  const rightTooltipContentRef = useRef<HTMLSpanElement>(null);

  const rafIdRef = useRef<number | null>(null);
  const trimValuesRef = useRef({ start: 0, end: duration });

  const FIXED_PX_PER_SECOND = 50;
  const HANDLE_WIDTH = 12;
  const EDGE_THRESHOLD = 30;

  const { pxPerMs, rawPxPerMs } = useScale({
    containerRef: scrollContainerRef,
    durationMs: duration,
    type: "auto",
    fixedPxPerSecond: FIXED_PX_PER_SECOND,
    maxPxPerSecond: 100,
    paddingPx: HANDLE_WIDTH,
  });

  const { handleAutoScroll, startAutoScroll, stopAutoScroll } = useAutoScroll({
    edgeThreshold: EDGE_THRESHOLD,
    maxScrollSpeed: 10,
    acceleration: 1.2,
  });

  const [showTooltip, setShowTooltip] = useState(false);
  const [activeHandle, setActiveHandle] = useState<Dir | null>(null);

  const pxPerSecond = pxPerMs * 1000; // in px
  const maxContentWidth = duration * pxPerMs;

  const drawRuler = useCallback(() => {
    if (pxPerMs > 0) {
      renderTimelineRuler({
        pxPerMs,
        durationMs: duration,
        container: rulerRef.current,
      });
    }
  }, [duration, pxPerMs]);

  const renderStrip = useCallback(() => {
    if (pxPerMs > 0) {
      renderTimelineStrips({
        pxPerMs,
        durationMs: duration,
        frames,
        container: stripRef.current,
      });
    }
  }, [duration, frames, pxPerMs]);

  const renderBlock = useCallback(() => {
    const el = blockRef.current;
    if (!el) return;
    const width = Math.max(0, maxContentWidth);
    el.style.width = `${width}px`;
    el.style.left = `0px`;
  }, [maxContentWidth]);

  useLayoutEffect(() => {
    rafIdRef.current = requestAnimationFrame(() => {
      drawRuler();
      renderBlock();
      renderStrip();

      if (spacerRef.current) spacerRef.current.style.height = "90px"; // ruler + track

      const left = leftHandleRef.current;
      const right = rightHandleRef.current;

      if (left && right) {
        const rightPos = Math.max(pxPerSecond, maxContentWidth);
        left.style.left = "0px";
        right.style.left = `${rightPos}px`;
        trimValuesRef.current.start = 0;
        trimValuesRef.current.end = duration;
      }
    });

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [
    duration,
    drawRuler,
    renderBlock,
    renderStrip,
    pxPerSecond,
    maxContentWidth,
  ]);

  const updateTooltipContent = useCallback((start: number, end: number) => {
    const startText = `Start: ${formatDurationDisplay(start)}`;
    const endText = `End: ${formatDurationDisplay(end)}`;
    if (leftTooltipContentRef.current)
      leftTooltipContentRef.current.textContent = startText;
    if (rightTooltipContentRef.current)
      rightTooltipContentRef.current.textContent = endText;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, handleType: Dir) => {
      const timelineEl = timelineRef.current;
      const scrollEl = scrollContainerRef.current;
      const leftHandle = leftHandleRef.current;
      const rightHandle = rightHandleRef.current;
      if (!timelineEl || !scrollEl || !leftHandle || !rightHandle) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      let isDragging = true;
      setShowTooltip(true);
      setActiveHandle(handleType);

      startAutoScroll(scrollEl, (scrollDelta) => {
        const { canScrollLeft, canScrollRight } = getScrollState(scrollEl);
        const isLeft = scrollDelta < 0;
        const isRight = scrollDelta > 0;
        const canScroll =
          (isLeft && canScrollLeft) || (isRight && canScrollRight);
        if (!canScroll) return;

        const leftPos = parseFloat(leftHandle.style.left || "0");
        const rightPos = parseFloat(
          rightHandle.style.left || `${maxContentWidth}`
        );

        if (handleType === "left") {
          const newLeft = Math.max(
            0,
            Math.min(leftPos + scrollDelta, rightPos - pxPerSecond)
          );
          leftHandle.style.left = `${newLeft}px`;
          const newStart = pxToMs(newLeft, pxPerMs);
          trimValuesRef.current.start = newStart;
          updateTooltipContent(newStart, trimValuesRef.current.end);
        } else {
          const newRight = Math.max(
            leftPos + pxPerSecond,
            Math.min(rightPos + scrollDelta, maxContentWidth)
          );
          rightHandle.style.left = `${newRight}px`;
          const newEnd = pxToMs(newRight, pxPerMs);
          trimValuesRef.current.end = newEnd;
          updateTooltipContent(trimValuesRef.current.start, newEnd);
        }
      });

      const onPointerMove = (ev: PointerEvent) => {
        if (!isDragging) return;
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

        rafIdRef.current = requestAnimationFrame(() => {
          const scrollRect = scrollEl.getBoundingClientRect();
          const timelineRect = timelineEl.getBoundingClientRect();
          const { containerWidth, canScrollLeft, canScrollRight } =
            getScrollState(scrollEl);

          const mouseX = ev.clientX - scrollRect.left;
          const needsLeft = mouseX <= EDGE_THRESHOLD && canScrollLeft;
          const needsRight =
            mouseX >= containerWidth - EDGE_THRESHOLD && canScrollRight;

          if (needsLeft || needsRight) handleAutoScroll(ev);

          if (!needsLeft && !needsRight) {
            const mouseXAbs = ev.clientX - timelineRect.left;
            const newX = Math.max(0, Math.min(mouseXAbs, timelineRect.width));
            const newTime = pxToMs(newX, pxPerMs);

            if (handleType === "left") {
              const right = parseFloat(rightHandle.style.left || "0");
              const maxLeft =
                pxToMs(right, pxPerMs) - pxToMs(pxPerSecond, pxPerMs);
              const newStart = Math.max(0, Math.min(newTime, maxLeft));
              trimValuesRef.current.start = newStart;
              leftHandle.style.left = `${newStart * pxPerMs}px`;
              updateTooltipContent(newStart, trimValuesRef.current.end);
            } else {
              const left = parseFloat(leftHandle.style.left || "0");
              const minRight =
                pxToMs(left, pxPerMs) + pxToMs(pxPerSecond, pxPerMs);
              const newEnd = Math.min(duration, Math.max(newTime, minRight));
              trimValuesRef.current.end = newEnd;
              rightHandle.style.left = `${msToPx(newEnd, pxPerMs)}px`;
              updateTooltipContent(trimValuesRef.current.start, newEnd);
            }
          }
        });
      };

      const onPointerUp = () => {
        isDragging = false;
        stopAutoScroll();
        setShowTooltip(false);
        setActiveHandle(null);

        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }

        const { start, end } = trimValuesRef.current;
        onTrim(start, end);
        setPrimaryTrim({ timelineOffset: 0, trimStart: start, trimEnd: end });

        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [
      duration,
      maxContentWidth,
      onTrim,
      pxPerSecond,
      pxPerMs,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      updateTooltipContent,
      setPrimaryTrim,
    ]
  );

  const timelineWidth = `${duration * rawPxPerMs}px`;

  return (
    <div className="flex relative flex-col gap-2 w-full h-[150px]">
      <div className="flex items-center justify-between">
        <div className="text-xs text-foreground-subtle">✂️</div>
        <div className="text-xs text-foreground-muted">
          Drag handles to trim
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="relative w-full rounded-md overflow-x-auto bg-surface-secondary overflow-y-hidden"
      >
        <div
          ref={timelineRef}
          className="relative"
          style={{ width: timelineWidth }}
        >
          <div ref={spacerRef} />
          <div className="absolute inset-x-0 top-0 h-5" ref={rulerRef} />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-primary/40 to-transparent pointer-events-none" />

          <div className="absolute left-0 right-0 top-6 h-14">
            <div className="absolute inset-0 rounded bg-surface-tertiary" />
            <div
              ref={blockRef}
              className="absolute inset-0 rounded-md border border-default overflow-hidden shadow-inner"
            >
              <div
                ref={stripRef}
                className="absolute inset-0 flex items-stretch"
              />
            </div>
          </div>

          {keyframes.map((kf) => (
            <Keyframe.Marker
              key={kf.id}
              keyframeId={kf.id}
              timelineRef={timelineRef!}
              pxPerMs={pxPerMs}
              edgeThreshold={EDGE_THRESHOLD}
            />
          ))}

          <div
            ref={leftHandleRef}
            className={cn(
              "absolute w-(--width) h-full cursor-ew-resize z-20 top-0 left-0",
              activeHandle === "left" ? "scale-110" : "hover:scale-105"
            )}
            onPointerDown={(e) => handlePointerDown(e, "left")}
            style={{ "--width": `${HANDLE_WIDTH}px` } as React.CSSProperties}
          >
            <div className="absolute inset-0 bg-primary rounded-md opacity-20 blur-sm" />
            <div className="relative w-full h-full bg-gradient-to-b from-primary to-primary-active rounded-md border border-primary/50 flex items-center justify-center shadow-md transition-all duration-200">
              <GripVertical size={10} className="text-foreground-on-accent" />
            </div>
          </div>

          <div
            ref={rightHandleRef}
            className={cn(
              "absolute w-(--width) h-full cursor-ew-resize top-0 z-20 right-0",
              activeHandle === "right" ? "scale-110" : "hover:scale-105"
            )}
            onPointerDown={(e) => handlePointerDown(e, "right")}
            style={{ "--width": `${HANDLE_WIDTH}px` } as React.CSSProperties}
          >
            <div className="absolute inset-0 bg-primary rounded-md opacity-20 blur-sm" />
            <div className="relative w-full h-full bg-gradient-to-b from-primary to-primary-active rounded-md border border-primary/50 flex items-center justify-center shadow-md transition-all duration-200">
              <GripVertical size={10} className="text-foreground-on-accent" />
            </div>
          </div>
        </div>
      </div>

      {showTooltip && (
        <div className="absolute z-50 pointer-events-none translate-x-2/4">
          <div className="bg-surface-secondary text-foreground-default px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium whitespace-nowrap">
            <div className="flex gap-3">
              <span className="text-primary" ref={leftTooltipContentRef}>
                {formatDurationDisplay(trimValuesRef.current.start)}
              </span>
              <span className="text-foreground-muted">•</span>
              <span className="text-primary" ref={rightTooltipContentRef}>
                {formatDurationDisplay(trimValuesRef.current.end)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(Timeline);
