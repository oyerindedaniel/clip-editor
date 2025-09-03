import React, { useRef, useCallback, useState, memo, useEffect } from "react";
import { GripVertical } from "lucide-react";
import { useScale } from "@/hooks/app/use-scale";
import { useAutoScroll } from "@/hooks/app/use-auto-scroll";
import { formatDurationDisplay } from "@/utils/app";
import {
  renderTimelineStrips,
  renderTimelineRuler,
} from "@/utils/timeline-utils";
import { flushSync } from "react-dom";
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

  const PX_PER_SECOND = 50;
  const HANDLE_WIDTH = 12;
  const EDGE_THRESHOLD = 60;

  const { pxPerMsRef, recalc } = useScale({
    containerRef: timelineRef,
    durationMs: duration,
    type: "auto",
    fixedPxPerSecond: PX_PER_SECOND,
    maxPxPerSecond: 100,
  });

  const getMinGap = useCallback(() => {
    return pxPerMsRef.current * 1000;
  }, []);

  // console.log(getMinGap());

  const {
    handleDragMove: handleAutoScroll,
    startAutoScroll,
    stopAutoScroll,
  } = useAutoScroll({
    edgeThreshold: EDGE_THRESHOLD,
    maxScrollSpeed: 10,
    acceleration: 1.2,
  });

  const [showTooltip, setShowTooltip] = useState(false);
  const [activeHandle, setActiveHandle] = useState<Dir | null>(null);

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
      const width = Math.max(0, duration * pxPerMsRef.current);
      blockRef.current.style.width = `${width}px`;
      blockRef.current.style.left = `0px`;
    }
  }, [duration]);

  useEffect(() => {
    recalc();
    rafIdRef.current = requestAnimationFrame(() => {
      drawRuler();
      renderBlock();

      if (spacerRef.current) spacerRef.current.style.height = "90px";

      if (leftHandleRef.current && rightHandleRef.current) {
        const minGap = getMinGap();
        const maxWidth = duration * pxPerMsRef.current;

        const rightPos = Math.max(minGap, maxWidth);

        leftHandleRef.current.style.left = "0px";
        rightHandleRef.current.style.left = `${rightPos}px`;

        trimValuesRef.current.start = 0;
        trimValuesRef.current.end = rightPos / pxPerMsRef.current;
      }
    });

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [duration, recalc, drawRuler, getMinGap, renderBlock]);

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
      if (!timelineRect || !scrollContainer) return;

      let isDragging = true;
      setShowTooltip(true);
      setActiveHandle(handleType);

      startAutoScroll(scrollContainerRef.current, (scrollDelta) => {
        if (
          Math.abs(scrollDelta) > 0 &&
          leftHandleRef.current &&
          rightHandleRef.current
        ) {
          const currentLeftPos = parseFloat(
            leftHandleRef.current.style.left || "0"
          );
          const currentRightPos = parseFloat(
            rightHandleRef.current.style.left ||
              `${duration * pxPerMsRef.current}`
          );
          const minGap = getMinGap();
          const maxContentWidth = duration * pxPerMsRef.current;

          if (handleType === "left") {
            const newLeftPos = currentLeftPos + scrollDelta;
            const maxLeftPos = currentRightPos - minGap;
            const clampedLeftPos = Math.max(
              0,
              Math.min(newLeftPos, maxLeftPos)
            );

            if (
              clampedLeftPos !== currentLeftPos &&
              clampedLeftPos >= 0 &&
              clampedLeftPos <= maxLeftPos
            ) {
              leftHandleRef.current.style.left = `${clampedLeftPos}px`;
              const newStartTime = clampedLeftPos / pxPerMsRef.current;
              trimValuesRef.current.start = newStartTime;
              updateTooltipContent(newStartTime, trimValuesRef.current.end);
            }
          } else if (handleType === "right") {
            const newRightPos = currentRightPos + scrollDelta;
            const minRightPos = currentLeftPos + minGap;
            const clampedRightPos = Math.max(
              minRightPos,
              Math.min(newRightPos, maxContentWidth)
            );

            if (
              clampedRightPos !== currentRightPos &&
              clampedRightPos >= minRightPos &&
              clampedRightPos <= maxContentWidth
            ) {
              rightHandleRef.current.style.left = `${clampedRightPos}px`;
              const newEndTime = clampedRightPos / pxPerMsRef.current;
              trimValuesRef.current.end = newEndTime;
              updateTooltipContent(trimValuesRef.current.start, newEndTime);
            }
          }
        }
      });

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging) return;

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

        rafIdRef.current = requestAnimationFrame(() => {
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const timelineRect = timelineRef.current?.getBoundingClientRect();
          if (!timelineRect) return;

          const scrollLeft = scrollContainer.scrollLeft;
          const scrollWidth = scrollContainer.scrollWidth;
          const containerWidth = scrollContainer.clientWidth;
          const maxScrollLeft = scrollWidth - containerWidth;

          const mouseXRelativeToContainer =
            moveEvent.clientX - scrollContainerRect.left;

          const needsLeftScroll =
            mouseXRelativeToContainer <= EDGE_THRESHOLD && scrollLeft > 0;
          const needsRightScroll =
            mouseXRelativeToContainer >= containerWidth - EDGE_THRESHOLD &&
            scrollLeft < maxScrollLeft;

          const shouldControlHandle = !needsLeftScroll && !needsRightScroll;

          handleAutoScroll(moveEvent);

          if (shouldControlHandle) {
            const mouseX = moveEvent.clientX;
            let newX = mouseX - timelineRect.left;
            newX = Math.max(0, Math.min(newX, timelineRect.width));
            const newTime = newX / pxPerMsRef.current;
            const minGap = getMinGap();

            if (handleType === "left") {
              const currentRightPos = parseFloat(
                rightHandleRef.current?.style.left ||
                  `${duration * pxPerMsRef.current}`
              );
              const maxLeftTime = currentRightPos / pxPerMsRef.current - minGap;
              const newTrimStart = Math.max(
                0,
                Math.min(newTime, Math.max(0, maxLeftTime))
              );

              trimValuesRef.current.start = newTrimStart;
              const newLeftPos = newTrimStart * pxPerMsRef.current;

              if (leftHandleRef.current) {
                leftHandleRef.current.style.left = `${newLeftPos}px`;
              }
              updateTooltipContent(newTrimStart, trimValuesRef.current.end);
            } else if (handleType === "right") {
              const currentLeftPos = parseFloat(
                leftHandleRef.current?.style.left || "0"
              );
              const minRightTime = currentLeftPos / pxPerMsRef.current + minGap;
              const newTrimEnd = Math.min(
                duration,
                Math.max(newTime, minRightTime)
              );

              trimValuesRef.current.end = newTrimEnd;
              const newRightPos = newTrimEnd * pxPerMsRef.current;

              if (rightHandleRef.current) {
                rightHandleRef.current.style.left = `${newRightPos}px`;
              }
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
      onTrim,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      getMinGap,
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
            width: `${(duration / 1000) * PX_PER_SECOND}px`,
          }}
        >
          <div ref={spacerRef} />
          <div className="absolute inset-x-0 top-0 h-5" ref={rulerRef} />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-primary/40 to-transparent pointer-events-none" />

          <div className="absolute left-0 right-0 top-6 h-14">
            <div className="absolute inset-y-0 left-0 right-0 mx-2 rounded bg-surface-secondary/60" />
            <div
              ref={blockRef}
              className="absolute top-0 h-14 rounded-md border border-default overflow-hidden shadow-inner bg-surface-primary/20"
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
