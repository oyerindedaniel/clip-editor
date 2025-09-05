import React, { useRef, useCallback, useState, memo, useEffect } from "react";
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

interface TimelineProps {
  duration: number;
  onTrim: (startTime: number, endTime: number) => void;
  frames?: string[];
}

type Dir = "left" | "right";

const Timeline: React.FC<TimelineProps> = ({ duration, onTrim, frames }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const leftHandleRef = useRef<HTMLDivElement>(null);
  const rightHandleRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);

  const blockRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const leftTooltipContentRef = useRef<HTMLSpanElement>(null);
  const rightTooltipContentRef = useRef<HTMLSpanElement>(null);

  const trimValuesRef = useRef({ start: 0, end: duration });
  const rafIdRef = useRef<number | null>(null);

  const FIXED_PX_PER_SECOND = 50;
  const HANDLE_WIDTH = 12;
  const EDGE_THRESHOLD = 30;

  const { pxPerMsRef, recalc } = useScale({
    containerRef: timelineRef,
    durationMs: duration,
    type: "auto",
    fixedPxPerSecond: FIXED_PX_PER_SECOND,
    maxPxPerSecond: 100,
  });

  const { handleAutoScroll, startAutoScroll, stopAutoScroll } = useAutoScroll({
    edgeThreshold: EDGE_THRESHOLD,
    maxScrollSpeed: 10,
    acceleration: 1.2,
  });

  const [showTooltip, setShowTooltip] = useState(false);
  const [activeHandle, setActiveHandle] = useState<Dir | null>(null);

  const maxContentWidth = duration * pxPerMsRef.current;
  const pxPerSecond = pxPerMsRef.current * 1000; // in px

  const drawRuler = useCallback(() => {
    const pxPerMs = pxPerMsRef.current;
    if (pxPerMs <= 0) return;

    renderTimelineRuler({
      pxPerMs,
      durationMs: duration,
      container: rulerRef.current,
    });
  }, [duration]);

  const renderStrip = useCallback(() => {
    const pxPerMs = pxPerMsRef.current;
    if (pxPerMs <= 0) return;

    renderTimelineStrips({
      pxPerMs,
      durationMs: duration,
      frames,
      container: stripRef.current,
    });
  }, [duration, frames]);

  const renderBlock = useCallback(() => {
    if (blockRef.current) {
      const width = Math.max(0, maxContentWidth);
      blockRef.current.style.width = `${width}px`;
      blockRef.current.style.left = `0px`;
    }
  }, [duration, maxContentWidth]);

  useEffect(() => {
    recalc();
    rafIdRef.current = requestAnimationFrame(() => {
      drawRuler();
      renderBlock();

      if (spacerRef.current) spacerRef.current.style.height = "90px"; // ruler + track

      if (leftHandleRef.current && rightHandleRef.current) {
        const rightPos = Math.max(pxPerSecond, maxContentWidth);

        leftHandleRef.current.style.left = "0px";
        rightHandleRef.current.style.left = `${rightPos}px`;

        trimValuesRef.current.start = 0;
        trimValuesRef.current.end = duration;
      }
    });

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [duration, maxContentWidth, recalc, drawRuler, pxPerSecond, renderBlock]);

  useEffect(() => {
    renderStrip();
  }, [renderStrip]);

  const updateTooltipContent = useCallback(
    (trimStart: number, trimEnd: number) => {
      if (leftTooltipContentRef.current) {
        leftTooltipContentRef.current.textContent = `Start: ${formatDurationDisplay(
          trimStart
        )}`;
      }

      if (rightTooltipContentRef.current) {
        rightTooltipContentRef.current.textContent = `End: ${formatDurationDisplay(
          trimEnd
        )}`;
      }
    },
    []
  );

  const handleDrag = useCallback(
    (event: MouseEvent, handleType: Dir) => {
      event.preventDefault();
      const timelineRect = timelineRef.current?.getBoundingClientRect();
      const scrollContainer = scrollContainerRef.current;
      const leftHandle = leftHandleRef.current;
      const rightHandle = rightHandleRef.current;

      if (!timelineRect || !scrollContainer || !leftHandle || !rightHandle)
        return;

      let isDragging = true;
      setShowTooltip(true);
      setActiveHandle(handleType);

      startAutoScroll(scrollContainer, (scrollDelta) => {
        const { canScrollLeft, canScrollRight } =
          getScrollState(scrollContainer);

        const isScrollingLeft = scrollDelta < 0;
        const isScrollingRight = scrollDelta > 0;

        const shouldAllowAutoScroll =
          (isScrollingLeft && canScrollLeft) ||
          (isScrollingRight && canScrollRight);

        if (Math.abs(scrollDelta) > 0 && shouldAllowAutoScroll) {
          const currentLeftPos = parseFloat(leftHandle.style.left || "0");
          const currentRightPos = parseFloat(
            rightHandle.style.left || `${maxContentWidth}`
          );

          if (handleType === "left") {
            const newLeftPos = currentLeftPos + scrollDelta;
            const maxLeftPos = currentRightPos - pxPerSecond;
            const clampedLeftPos = Math.max(
              0,
              Math.min(newLeftPos, maxLeftPos)
            );

            leftHandle.style.left = `${clampedLeftPos}px`;
            const newStartTime = pxToMs(clampedLeftPos, pxPerMsRef.current);
            trimValuesRef.current.start = newStartTime;
            updateTooltipContent(newStartTime, trimValuesRef.current.end);
          } else if (handleType === "right") {
            const newRightPos = currentRightPos + scrollDelta;
            const minRightPos = currentLeftPos + pxPerSecond;
            const clampedRightPos = Math.max(
              minRightPos,
              Math.min(newRightPos, maxContentWidth)
            );

            rightHandle.style.left = `${clampedRightPos}px`;
            const newEndTime = pxToMs(clampedRightPos, pxPerMsRef.current);
            trimValuesRef.current.end = newEndTime;
            updateTooltipContent(trimValuesRef.current.start, newEndTime);
          }
        }
      });

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging) return;

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

        rafIdRef.current = requestAnimationFrame(() => {
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const timelineRect = timelineRef.current?.getBoundingClientRect();
          if (!timelineRect || !scrollContainerRect) return;

          const { containerWidth, canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer);

          const mouseXRelativeToContainer =
            moveEvent.clientX - scrollContainerRect.left;

          const needsLeftScroll =
            mouseXRelativeToContainer <= EDGE_THRESHOLD && canScrollLeft;
          const needsRightScroll =
            mouseXRelativeToContainer >= containerWidth - EDGE_THRESHOLD &&
            canScrollRight;

          const shouldControlHandle = !needsLeftScroll && !needsRightScroll;

          if (needsLeftScroll || needsRightScroll) {
            handleAutoScroll(moveEvent);
          }

          if (shouldControlHandle) {
            const mouseX = moveEvent.clientX;
            let newX = mouseX - timelineRect.left;
            newX = Math.max(0, Math.min(newX, timelineRect.width));

            const newTime = pxToMs(newX, pxPerMsRef.current);

            if (handleType === "left") {
              const currentRightPos = parseFloat(
                rightHandle.style.left || `${maxContentWidth}`
              );
              const maxLeftTime =
                pxToMs(currentRightPos, pxPerMsRef.current) -
                pxToMs(pxPerSecond, pxPerMsRef.current);
              const newTrimStart = Math.max(
                0,
                Math.min(newTime, Math.max(0, maxLeftTime))
              );

              trimValuesRef.current.start = newTrimStart;
              const newLeftPos = newTrimStart * pxPerMsRef.current;

              leftHandle.style.left = `${newLeftPos}px`;

              updateTooltipContent(newTrimStart, trimValuesRef.current.end);
            } else if (handleType === "right") {
              const currentLeftPos = parseFloat(leftHandle.style.left || "0");
              const minRightTime =
                pxToMs(currentLeftPos, pxPerMsRef.current) +
                pxToMs(pxPerSecond, pxPerMsRef.current);
              const newTrimEnd = Math.min(
                duration,
                Math.max(newTime, minRightTime)
              );

              trimValuesRef.current.end = newTrimEnd;
              const newRightPos = msToPx(newTrimEnd, pxPerMsRef.current);

              rightHandle.style.left = `${newRightPos}px`;

              updateTooltipContent(trimValuesRef.current.start, newTrimEnd);
            }
          }
        });
      };

      const onMouseUp = () => {
        isDragging = false;
        setShowTooltip(false);
        setActiveHandle(null);
        stopAutoScroll();

        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        onTrim(trimValuesRef.current.start, trimValuesRef.current.end);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [
      duration,
      maxContentWidth,
      pxPerSecond,
      onTrim,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      updateTooltipContent,
      pxPerMsRef,
    ]
  );

  return (
    <div className="flex relative flex-col gap-2 w-full h-[150px]">
      <div className="flex items-center justify-between">
        <div className="text-xs text-foreground-subtle">✂️</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-foreground-muted">
            Drag handles to trim video
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="relative w-full rounded-md bg-surface-secondary overflow-x-auto overflow-y-hidden"
      >
        <div
          ref={timelineRef}
          className="relative min-w-full"
          style={{
            width: `${(duration / 1000) * pxPerSecond}px`,
          }}
        >
          <div ref={spacerRef} />
          <div className="absolute inset-x-0 top-0 h-5" ref={rulerRef} />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-primary/40 to-transparent pointer-events-none" />

          <div className="absolute left-0 right-0 top-6 h-14">
            <div className="absolute inset-y-0 left-0 right-0 rounded bg-surface-tertiary/60" />
            <div
              ref={blockRef}
              className="absolute top-0 h-14 rounded-md border border-default overflow-hidden shadow-inner"
              title="Video timeline"
            >
              <div
                ref={stripRef}
                className="absolute inset-0 flex items-stretch"
              />
            </div>
          </div>

          <div
            ref={leftHandleRef}
            className={cn(
              "absolute w-[var(--width)] h-full cursor-ew-resize z-20 top-0 left-0",
              activeHandle === "left" ? "scale-110" : "hover:scale-105"
            )}
            onMouseDown={(e) => handleDrag(e.nativeEvent, "left")}
            style={
              {
                "--width": `${HANDLE_WIDTH}px`,
              } as React.CSSProperties
            }
          >
            <div className="absolute inset-0 bg-primary rounded-md shadow-lg opacity-20 blur-sm" />
            <div
              className={cn(
                "relative w-full h-full bg-gradient-to-b from-primary to-primary-active rounded-md shadow-md border border-primary/50 flex items-center justify-center transition-all duration-200",
                activeHandle === "left"
                  ? "shadow-lg shadow-primary/25"
                  : "hover:shadow-md hover:shadow-primary/20"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent rounded-md" />
              <GripVertical
                size={10}
                className="text-foreground-on-accent drop-shadow-sm relative z-10"
              />
            </div>
          </div>

          <div
            ref={rightHandleRef}
            className={cn(
              "absolute w-[var(--width)] h-full cursor-ew-resize top-0 z-20 right-0",
              activeHandle === "right" ? "scale-110" : "hover:scale-105"
            )}
            onMouseDown={(e) => handleDrag(e.nativeEvent, "right")}
            style={
              {
                "--width": `${HANDLE_WIDTH}px`,
              } as React.CSSProperties
            }
          >
            <div className="absolute inset-0 bg-primary rounded-md shadow-lg opacity-20 blur-sm" />
            <div
              className={cn(
                "relative w-full h-full bg-gradient-to-b from-primary to-primary-active rounded-md shadow-md border border-primary/50 flex items-center justify-center transition-all duration-200",
                activeHandle === "right"
                  ? "shadow-lg shadow-primary/25"
                  : "hover:shadow-md hover:shadow-primary/20"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent rounded-md" />
              <GripVertical
                size={10}
                className="text-foreground-on-accent drop-shadow-sm relative z-10"
              />
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
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-secondary" />
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(Timeline);
