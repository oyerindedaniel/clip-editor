import React, {
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  memo,
  useEffect,
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
import { useTimelineTooltip } from "@/hooks/app/use-timeline-tooltip";
import { TimelineTooltip } from "./timeline-tooltip";
import InfoTooltip from "./info-tooltip";
import { Scissors } from "lucide-react";
import { msToSecondsRate } from "@/utils/timeline-utils";

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
  const { primaryTrim, primaryTrimRef, setPrimaryTrim } = useShallowSelector(
    ClipContext,
    (state) => ({
      primaryTrim: state.primaryTrim,
      primaryTrimRef: state.primaryTrimRef,
      setPrimaryTrim: state.setPrimaryTrim,
    })
  );

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const leftHandleRef = useRef<HTMLDivElement>(null);
  const rightHandleRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const rafIdRef = useRef<number | null>(null);

  const trimValuesRef = useRef({
    start: primaryTrim.trimStart,
    end: primaryTrim.trimEnd || duration,
  });

  const trimOverlayRef = React.useRef<HTMLDivElement>(null);

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

  const { updateTooltip, lastTooltipState } = useTimelineTooltip({
    tooltipRef,
    scrollContainerRef,
    edgeThreshold: EDGE_THRESHOLD,
  });

  const [showTooltip, setShowTooltip] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const pxPerSecond = msToSecondsRate(pxPerMs);
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

      if (spacerRef.current) spacerRef.current.style.height = "90px"; // ruler + track

      const left = leftHandleRef.current;
      const right = rightHandleRef.current;

      if (left && right) {
        const leftPos = Math.max(
          0,
          msToPx(primaryTrimRef.current.trimStart, pxPerMs)
        );
        const rightPos = Math.max(
          pxPerSecond,
          msToPx(primaryTrimRef.current.trimEnd, pxPerMs) || maxContentWidth
        );

        left.style.left = `${leftPos}px`;
        right.style.left = `${rightPos}px`;
        trimValuesRef.current.start = primaryTrimRef.current.trimStart;
        trimValuesRef.current.end = primaryTrimRef.current.trimEnd || duration;
      }
    });

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [duration, drawRuler, renderBlock, pxPerSecond, maxContentWidth, pxPerMs]);

  useEffect(() => {
    renderStrip();
  }, [renderStrip]);

  useEffect(() => {
    const { trimStart, trimEnd } = primaryTrim;
    const { start, end } = trimValuesRef.current;

    if (trimStart === start && trimEnd === end) return;

    trimValuesRef.current = { start: trimStart, end: trimEnd };

    const leftEl = leftHandleRef.current;
    const rightEl = rightHandleRef.current;
    const overlayEl = trimOverlayRef.current;

    if (!leftEl || !rightEl || !overlayEl) return;

    const leftPos = Math.max(0, msToPx(trimStart, pxPerMs));
    const rightPos = Math.max(
      pxPerSecond,
      msToPx(trimEnd, pxPerMs) || maxContentWidth
    );

    leftEl.style.left = `${leftPos}px`;
    rightEl.style.left = `${rightPos}px`;

    const overlayWidth = Math.max(0, msToPx(trimEnd - trimStart, pxPerMs));
    overlayEl.style.left = `${leftPos}px`;
    overlayEl.style.width = `${overlayWidth}px`;
  }, [primaryTrim, pxPerMs, pxPerSecond, maxContentWidth]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, handleType: Dir) => {
      const timelineEl = timelineRef.current;
      const scrollEl = scrollContainerRef.current;
      const leftHandle = leftHandleRef.current;
      const rightHandle = rightHandleRef.current;
      if (!timelineEl || !scrollEl || !leftHandle || !rightHandle) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      let isDragging = true;
      setIsDragging(true);
      setShowTooltip(true);

      const updateTooltipForHandle = (handleType: Dir) => {
        const leftPos = parseFloat(leftHandle.style.left || "0");
        const rightPos = parseFloat(
          rightHandle.style.left || `${maxContentWidth}`
        );

        const markerX = handleType === "left" ? leftPos : rightPos;
        const displayText = `Start: ${formatDurationDisplay(
          trimValuesRef.current.start
        )} • End: ${formatDurationDisplay(trimValuesRef.current.end)}`;

        updateTooltip(markerX - scrollEl.scrollLeft, displayText);
      };

      updateTooltipForHandle(handleType);

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
          updateTooltipForHandle(handleType);
        } else {
          const newRight = Math.max(
            leftPos + pxPerSecond,
            Math.min(rightPos + scrollDelta, maxContentWidth)
          );
          rightHandle.style.left = `${newRight}px`;
          const newEnd = pxToMs(newRight, pxPerMs);
          trimValuesRef.current.end = newEnd;
          updateTooltipForHandle(handleType);
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
          const needsLeftScroll = mouseX <= EDGE_THRESHOLD && canScrollLeft;
          const needsRightScroll =
            mouseX >= containerWidth - EDGE_THRESHOLD && canScrollRight;

          if (needsLeftScroll || needsRightScroll) handleAutoScroll(ev);

          if (!needsLeftScroll && !needsRightScroll) {
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
              updateTooltipForHandle(handleType);
            } else {
              const left = parseFloat(leftHandle.style.left || "0");
              const minRight =
                pxToMs(left, pxPerMs) + pxToMs(pxPerSecond, pxPerMs);
              const newEnd = Math.min(duration, Math.max(newTime, minRight));
              trimValuesRef.current.end = newEnd;
              rightHandle.style.left = `${msToPx(newEnd, pxPerMs)}px`;
              updateTooltipForHandle(handleType);
            }
          }
        });
      };

      const onPointerUp = () => {
        isDragging = false;
        setIsDragging(false);
        stopAutoScroll();
        setShowTooltip(false);

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
      updateTooltip,
      setPrimaryTrim,
    ]
  );

  const timelineWidth = `${duration * rawPxPerMs}px`;

  return (
    <div className="flex relative flex-col gap-2 w-full h-[150px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xs text-foreground-subtle">
            <Scissors size={14} />
          </div>
          <div className="text-xs text-foreground-muted">
            Drag handles to trim
          </div>
        </div>
        <InfoTooltip content="Drag the left and right handles to set the start and end points of your trimmed video. The minimum duration is 1 second." />
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
              className="absolute h-full rounded-md border border-default overflow-hidden shadow-inner focus:outline-none focus-visible:border-2 focus-visible:border-primary"
            >
              <div
                ref={stripRef}
                className="absolute inset-0 flex items-stretch"
              />

              {!isDragging && (
                <div
                  ref={trimOverlayRef}
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: `${msToPx(trimValuesRef.current.start, pxPerMs)}px`,
                    width: `${Math.max(
                      0,
                      msToPx(
                        Math.max(
                          0,
                          trimValuesRef.current.end -
                            trimValuesRef.current.start
                        ),
                        pxPerMs
                      )
                    )}px`,
                  }}
                >
                  <div className="absolute inset-0 bg-primary/15 border-2 border-primary rounded-none" />
                </div>
              )}
            </div>
          </div>

          {keyframes.map((kf) => (
            <Keyframe.Marker
              key={kf.id}
              keyframeId={kf.id}
              scrollRef={scrollContainerRef!}
              pxPerMs={pxPerMs}
              edgeThreshold={EDGE_THRESHOLD}
            />
          ))}

          <div
            ref={leftHandleRef}
            className={cn(
              "absolute w-(--width) h-full cursor-ew-resize z-20 top-0 left-0 hover:scale-105"
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
              "absolute w-(--width) h-full cursor-ew-resize top-0 z-20 right-0 hover:scale-105"
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

      <TimelineTooltip
        ref={tooltipRef}
        tooltipState={lastTooltipState}
        visible={showTooltip}
        container={scrollContainerRef.current}
      />
    </div>
  );
};

export default memo(Timeline);
