"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { flushSync } from "react-dom";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";

interface DualVideoTracksProps {
  primaryDurationMs: number;
  secondaryDurationMs: number;
  initialOffsetMs: number; // secondary relative to primary; positive means secondary starts later
  onOffsetChange?: (offsetMs: number) => void; // live as user drags
  onCommitOffset?: (offsetMs: number) => void; // when drag ends
  onCutSecondaryAt?: (timeMs: number) => void;
  primaryPreviewFrames?: string[];
  secondaryPreviewFrames?: string[];
}

export const DualVideoTracks: React.FC<DualVideoTracksProps> = ({
  primaryDurationMs,
  secondaryDurationMs,
  initialOffsetMs,
  primaryPreviewFrames,
  secondaryPreviewFrames,
}) => {
  const { onOffsetChange: onCommitOffset, onCutSecondaryAt } =
    useShallowSelector(OverlaysContext, (state) => ({
      onCutSecondaryAt: state.onCutSecondaryAt,
      onOffsetChange: state.onOffsetChange,
    }));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const primaryBlockRef = useRef<HTMLDivElement | null>(null);
  const secondaryBlockRef = useRef<HTMLDivElement | null>(null);
  const primaryStripRef = useRef<HTMLDivElement | null>(null);
  const secondaryStripRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);

  const currentOffsetRef = useRef<number>(initialOffsetMs);
  const draggingSecondaryRef = useRef<boolean>(false);
  const draggingPlayheadRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipContentRef = useRef<HTMLSpanElement>(null);
  const lastSecondaryTooltipRef = useRef<string>("");
  const lastPlayheadTooltipRef = useRef<string>("");

  const maxDurationMs = Math.max(primaryDurationMs, secondaryDurationMs);
  const FIXED_PX_PER_SECOND = 100;
  const EDGE_THRESHOLD = 30;

  const { pxPerMsRef, recalc } = useScale({
    containerRef,
    durationMs: maxDurationMs,
    type: "fixed",
    fixedPxPerSecond: FIXED_PX_PER_SECOND,
  });

  const pxPerSecond = pxPerMsRef.current * 1000; // in px

  const { handleAutoScroll, startAutoScroll, stopAutoScroll } = useAutoScroll({
    edgeThreshold: EDGE_THRESHOLD,
    maxScrollSpeed: 10,
    acceleration: 1.2,
  });

  const renderStrips = useCallback(() => {
    const pxPerMs = pxPerMsRef.current;
    if (pxPerMs <= 0) return;

    renderTimelineStrips({
      pxPerMs,
      durationMs: primaryDurationMs,
      frames: primaryPreviewFrames,
      container: primaryStripRef.current,
    });

    renderTimelineStrips({
      pxPerMs,
      durationMs: secondaryDurationMs,
      frames: secondaryPreviewFrames,
      container: secondaryStripRef.current,
    });
  }, [
    primaryPreviewFrames,
    secondaryPreviewFrames,
    primaryDurationMs,
    secondaryDurationMs,
  ]);

  const renderRuler = useCallback(() => {
    const pxPerMs = pxPerMsRef.current;
    if (pxPerMs <= 0) return;

    renderTimelineRuler({
      pxPerMs,
      durationMs: maxDurationMs,
      container: rulerRef.current,
    });
  }, [maxDurationMs]);

  const renderBlocks = useCallback(() => {
    const pxPerMs = pxPerMsRef.current;
    const offsetMs = currentOffsetRef.current;

    if (primaryBlockRef.current) {
      const width = Math.max(0, msToPx(primaryDurationMs, pxPerMs));
      primaryBlockRef.current.style.width = `${width}px`;
      primaryBlockRef.current.style.left = `0px`;
    }

    if (secondaryBlockRef.current) {
      const width = Math.max(0, msToPx(secondaryDurationMs, pxPerMs));
      const left = Math.max(0, msToPx(offsetMs, pxPerMs));
      secondaryBlockRef.current.style.width = `${width}px`;
      secondaryBlockRef.current.style.left = `${left}px`;
    }
  }, [primaryDurationMs, secondaryDurationMs]);

  useEffect(() => {
    currentOffsetRef.current = initialOffsetMs;
    recalc();
    rafIdRef.current = requestAnimationFrame(() => {
      renderBlocks();
      renderRuler();

      if (spacerRef.current) spacerRef.current.style.height = "160px"; // ruler + two tracks
    });
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [initialOffsetMs, recalc, renderBlocks, renderStrips, renderRuler]);

  useEffect(() => {
    renderStrips();
  }, [renderStrips]);

  const onSecondaryMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const scrollContainer = scrollContainerRef.current;
      const container = containerRef.current;
      if (!scrollContainer || !container) return;

      const containerRect = container.getBoundingClientRect();

      let isDragging = true;
      const startOffset = currentOffsetRef.current;

      const moveEvent = e;
      const startMouseX = moveEvent.clientX - containerRect.left;

      const maxOffsetMs =
        primaryDurationMs - pxToMs(pxPerSecond, pxPerMsRef.current);

      draggingSecondaryRef.current = true;

      startAutoScroll(scrollContainerRef.current, (scrollDelta) => {
        const primaryMaxPx = msToPx(maxOffsetMs, pxPerMsRef.current);
        const { canScrollLeft, canScrollRight } = getScrollState(
          scrollContainer,
          undefined,
          primaryMaxPx
        );

        const isScrollingLeft = scrollDelta < 0;
        const isScrollingRight = scrollDelta > 0;

        const shouldAllowAutoScroll =
          (isScrollingLeft && canScrollLeft) ||
          (isScrollingRight && canScrollRight);

        // if (!shouldAllowAutoScroll) {
        //   // TODO: find a way to stop it
        //   // stopAutoScroll();
        //   return;
        // }

        if (Math.abs(scrollDelta) > 0 && shouldAllowAutoScroll) {
          const deltaMs = pxToMs(scrollDelta, pxPerMsRef.current);
          const newOffset = Math.max(
            0,
            Math.min(currentOffsetRef.current + deltaMs, maxOffsetMs)
          );

          currentOffsetRef.current = newOffset;
          renderBlocks();

          // onOffsetChange?.(newOffset);

          if (tooltipContentRef.current) {
            const text = `Offset: ${formatDurationDisplay(newOffset)}`;
            tooltipContentRef.current.textContent = text;
            lastSecondaryTooltipRef.current = text;
          }
        }
      });

      flushSync(() => {
        setShowTooltip(true);
      });

      if (tooltipContentRef.current) {
        const text = `Offset: ${formatDurationDisplay(startOffset)}`;
        tooltipContentRef.current.textContent = text;
        lastSecondaryTooltipRef.current = text;
      }

      const onMove = (moveEvent: MouseEvent) => {
        if (!isDragging) return;

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

        rafIdRef.current = requestAnimationFrame(() => {
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          if (!scrollContainerRect || !containerRect) return;

          const maxContentWidth = msToPx(maxDurationMs, pxPerMsRef.current);

          const { containerWidth, canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer, maxContentWidth);

          const mouseXRelativeToContainer =
            moveEvent.clientX - scrollContainerRect.left;

          const needsLeftScroll =
            mouseXRelativeToContainer <= EDGE_THRESHOLD && canScrollLeft;
          const needsRightScroll =
            mouseXRelativeToContainer >= containerWidth - EDGE_THRESHOLD &&
            canScrollRight;

          const shouldControlSecondary = !needsLeftScroll && !needsRightScroll;

          if (needsLeftScroll || needsRightScroll) {
            handleAutoScroll(moveEvent);
          }

          if (shouldControlSecondary) {
            const mouseX = moveEvent.clientX - containerRect.left;
            const deltaX = mouseX - startMouseX;

            const deltaMs = pxToMs(deltaX, pxPerMsRef.current);
            const newOffset = Math.max(
              0,
              Math.min(startOffset + deltaMs, maxOffsetMs)
            );

            currentOffsetRef.current = newOffset;
            renderBlocks();
            // onOffsetChange?.(newOffset);

            if (tooltipContentRef.current) {
              const text = `Offset: ${formatDurationDisplay(newOffset)}`;
              tooltipContentRef.current.textContent = text;
              lastSecondaryTooltipRef.current = text;
            }
          }
        });
      };

      const onUp = () => {
        isDragging = false;
        draggingSecondaryRef.current = false;
        stopAutoScroll();
        setShowTooltip(false);

        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }

        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);

        onCommitOffset?.(currentOffsetRef.current);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [
      // onOffsetChange,
      onCommitOffset,
      pxPerMsRef,
      renderBlocks,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      primaryDurationMs,
    ]
  );

  const onPlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const scrollContainer = scrollContainerRef.current;
      const playhead = playheadRef.current;
      const container = containerRef.current;

      if (!scrollContainer || !container || !playhead) return;

      let isDragging = true;
      const startPlayheadPos = parseFloat(playhead.style.left || "0");
      draggingPlayheadRef.current = true;
      const secondaryWidth = msToPx(secondaryDurationMs, pxPerMsRef.current);

      startAutoScroll(scrollContainerRef.current, (scrollDelta) => {
        const { canScrollLeft, canScrollRight } =
          getScrollState(scrollContainer);
        const isScrollingLeft = scrollDelta < 0;
        const isScrollingRight = scrollDelta > 0;
        const shouldAllowAutoScroll =
          (isScrollingLeft && canScrollLeft) ||
          (isScrollingRight && canScrollRight);

        if (Math.abs(scrollDelta) > 0 && shouldAllowAutoScroll) {
          const currentLeft = parseFloat(playhead.style.left || "0");
          const newLeft = Math.max(
            0,
            Math.min(currentLeft + scrollDelta, secondaryWidth)
          );

          playhead.style.left = `${newLeft}px`;
          const timeMs = pxToMs(newLeft, pxPerMsRef.current);
          if (tooltipContentRef.current) {
            const text = `Playhead: ${formatDurationDisplay(timeMs)}`;
            tooltipContentRef.current.textContent = text;
            lastPlayheadTooltipRef.current = text;
          }
        }
      });

      flushSync(() => {
        setShowTooltip(true);
      });

      if (tooltipContentRef.current) {
        const timeMs = pxToMs(startPlayheadPos, pxPerMsRef.current);
        const text = `Playhead: ${formatDurationDisplay(timeMs)}`;
        tooltipContentRef.current.textContent = text;
        lastPlayheadTooltipRef.current = text;
      }

      const onMove = (moveEvent: MouseEvent) => {
        const playhead = playheadRef.current;
        if (!isDragging || !playhead) return;

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const { containerWidth, canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer);
          const mouseXRelativeToContainer =
            moveEvent.clientX - scrollContainerRect.left;
          const needsLeftScroll =
            mouseXRelativeToContainer <= EDGE_THRESHOLD && canScrollLeft;
          const needsRightScroll =
            mouseXRelativeToContainer >= containerWidth - EDGE_THRESHOLD &&
            canScrollRight;
          const shouldControlPlayhead = !needsLeftScroll && !needsRightScroll;

          if (needsLeftScroll || needsRightScroll) {
            handleAutoScroll(moveEvent);
          }

          if (shouldControlPlayhead) {
            const mouseX = moveEvent.clientX;
            let newX = mouseX - containerRect.left;
            newX = Math.max(0, Math.min(newX, secondaryWidth));

            playhead.style.left = `${newX}px`;
            const timeMs = pxToMs(newX, pxPerMsRef.current);
            if (tooltipContentRef.current) {
              const text = `Playhead: ${formatDurationDisplay(timeMs)}`;
              tooltipContentRef.current.textContent = text;
              lastPlayheadTooltipRef.current = text;
            }
          }
        });
      };

      const onUp = () => {
        isDragging = false;
        draggingPlayheadRef.current = false;
        stopAutoScroll();
        setShowTooltip(false);
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [
      pxPerMsRef,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      maxDurationMs,
    ]
  );

  const handleCutSecondary = useCallback(() => {
    if (!containerRef.current || !playheadRef.current) return;
    const playheadLeft = parseFloat(playheadRef.current.style.left || "0");
    const timeMs = pxToMs(playheadLeft, pxPerMsRef.current);
    onCutSecondaryAt?.(Math.round(timeMs));
  }, [onCutSecondaryAt, onCutSecondaryAt, pxPerMsRef]);

  return (
    <div className="flex relative flex-col gap-2 w-full h-[250px]">
      <div className="flex items-center justify-between">
        <div className="text-xs text-foreground-subtle">🎞️</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleCutSecondary}>
            <Scissors className="mr-1" size={14} /> Cut Secondary
          </Button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="relative w-full rounded-md bg-surface-secondary overflow-x-auto overflow-y-hidden"
      >
        <div
          ref={containerRef}
          className="relative min-w-full"
          style={{
            width: `${(maxDurationMs / 1000) * pxPerSecond}px`,
          }}
        >
          <div ref={spacerRef} />
          <div className="absolute inset-x-0 top-0 h-5" ref={rulerRef} />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-primary/40 to-transparent pointer-events-none" />

          <div
            ref={playheadRef}
            onMouseDown={onPlayheadMouseDown}
            className="absolute top-0 left-0 bottom-0 w-px bg-primary z-20 cursor-ew-resize"
          >
            <div className="absolute -top-2 -left-2 h-4 w-4 bg-primary rotate-45" />
          </div>

          <div className="absolute left-0 right-0 top-6 h-14">
            <div className="absolute inset-y-0 left-0 right-0 mx-2 rounded bg-surface-tertiary/60" />
            <div
              ref={primaryBlockRef}
              className={cn(
                "absolute top-0 h-14 rounded-md border border-default overflow-hidden",
                "shadow-inner"
              )}
              title="Primary video"
            >
              <div
                ref={primaryStripRef}
                className="absolute inset-0 flex items-stretch"
              />
            </div>
          </div>

          <div className="absolute left-0 right-0 top-24 h-14">
            <div className="absolute inset-y-0 left-0 right-0 rounded bg-surface-tertiary/60" />
            <div
              ref={secondaryBlockRef}
              onMouseDown={onSecondaryMouseDown}
              className={cn(
                "absolute top-0 h-14 rounded-md border border-default overflow-hidden",
                "shadow-inner cursor-grab active:cursor-grabbing ring-0 focus:outline-none focus:ring-0"
              )}
              title="Secondary video (drag to align)"
            >
              <div
                ref={secondaryStripRef}
                className="absolute inset-0 flex items-stretch"
              />
            </div>
          </div>
        </div>
      </div>

      {showTooltip && (
        <div className="absolute z-50 pointer-events-none translate-x-2/4">
          <div className="bg-surface-secondary text-foreground-default px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium whitespace-nowrap">
            <span className="text-primary" ref={tooltipContentRef} />
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-secondary" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DualVideoTracks;
