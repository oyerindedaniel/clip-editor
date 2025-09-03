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
} from "@/utils/timeline-utils";
import { flushSync } from "react-dom";

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
  onOffsetChange,
  onCommitOffset,
  onCutSecondaryAt,
  primaryPreviewFrames,
  secondaryPreviewFrames,
}) => {
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
  const PX_PER_SECOND = 100;

  const { pxPerMsRef, recalc } = useScale({
    containerRef,
    durationMs: maxDurationMs,
    type: "fixed",
    fixedPxPerSecond: PX_PER_SECOND,
  });

  const {
    handleDragMove: handleAutoScroll,
    startAutoScroll,
    stopAutoScroll,
  } = useAutoScroll({
    edgeThreshold: 60,
    maxScrollSpeed: 20,
    acceleration: 2.2,
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
      const width = Math.max(0, primaryDurationMs * pxPerMs);
      primaryBlockRef.current.style.width = `${width}px`;
      primaryBlockRef.current.style.left = `0px`;
    }

    if (secondaryBlockRef.current) {
      const width = Math.max(0, secondaryDurationMs * pxPerMs);
      const left = Math.max(0, offsetMs * pxPerMs);
      secondaryBlockRef.current.style.width = `${width}px`;
      secondaryBlockRef.current.style.left = `${left}px`;
    }
  }, [primaryDurationMs, secondaryDurationMs]);

  useEffect(() => {
    currentOffsetRef.current = initialOffsetMs;
    recalc();
    rafIdRef.current = requestAnimationFrame(() => {
      renderBlocks();
      renderStrips();
      renderRuler();

      if (spacerRef.current) spacerRef.current.style.height = "160px"; // ruler + two tracks
    });
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [initialOffsetMs, recalc, renderBlocks, renderStrips, renderRuler]);

  const onSecondaryMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const scrollContainer = scrollContainerRef.current;
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!scrollContainer || !containerRect) return;

      let isDragging = true;
      const startX = e.clientX;
      const startOffset = currentOffsetRef.current;
      draggingSecondaryRef.current = true;

      startAutoScroll(scrollContainerRef.current, (scrollDelta) => {
        if (Math.abs(scrollDelta) > 0) {
          const pxPerMs = pxPerMsRef.current;
          if (pxPerMs > 0) {
            const deltaMs = scrollDelta / pxPerMs;
            const newOffset = Math.max(0, currentOffsetRef.current + deltaMs);
            currentOffsetRef.current = newOffset;
            renderBlocks();
            onOffsetChange?.(newOffset);

            if (tooltipContentRef.current) {
              const text = `Offset: ${formatDurationDisplay(newOffset)}`;
              tooltipContentRef.current.textContent = text;
              lastSecondaryTooltipRef.current = text;
            }
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

          handleAutoScroll(moveEvent);

          const scrollLeft = scrollContainer.scrollLeft;
          const scrollWidth = scrollContainer.scrollWidth;
          const containerWidth = scrollContainer.clientWidth;
          const maxScrollLeft = scrollWidth - containerWidth;

          const mouseXRelativeToContainer =
            moveEvent.clientX - scrollContainerRect.left;

          const needsLeftScroll =
            mouseXRelativeToContainer <= 60 && scrollLeft > 0;
          const needsRightScroll =
            mouseXRelativeToContainer >= containerWidth - 60 &&
            scrollLeft < maxScrollLeft;

          const shouldControlSecondary = !needsLeftScroll && !needsRightScroll;

          if (shouldControlSecondary) {
            const dx = moveEvent.clientX - startX;
            const pxPerMs = pxPerMsRef.current;
            const deltaMs = pxPerMs > 0 ? dx / pxPerMs : 0;
            const newOffset = Math.max(0, startOffset + deltaMs);

            currentOffsetRef.current = newOffset;
            renderBlocks();
            onOffsetChange?.(newOffset);

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
      onOffsetChange,
      onCommitOffset,
      pxPerMsRef,
      renderBlocks,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      maxDurationMs,
    ]
  );

  const onPlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const scrollContainer = scrollContainerRef.current;
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!scrollContainer || !containerRect) return;

      let isDragging = true;
      const startX = e.clientX;
      const startPlayheadPos = parseFloat(
        playheadRef.current?.style.left || "0"
      );
      draggingPlayheadRef.current = true;

      startAutoScroll(scrollContainerRef.current, (scrollDelta) => {
        if (Math.abs(scrollDelta) > 0 && playheadRef.current) {
          const currentLeft = parseFloat(playheadRef.current.style.left || "0");
          const maxContentWidth = maxDurationMs * pxPerMsRef.current;
          const newLeft = Math.max(
            0,
            Math.min(currentLeft + scrollDelta, maxContentWidth)
          );

          playheadRef.current.style.left = `${newLeft}px`;

          const pxPerMs = pxPerMsRef.current;
          const timeMs = pxPerMs > 0 ? newLeft / pxPerMs : 0;
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
        const pxPerMs = pxPerMsRef.current;
        const timeMs = pxPerMs > 0 ? startPlayheadPos / pxPerMs : 0;
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

          handleAutoScroll(moveEvent);

          const scrollLeft = scrollContainer.scrollLeft;
          const scrollWidth = scrollContainer.scrollWidth;
          const containerWidth = scrollContainer.clientWidth;
          const maxScrollLeft = scrollWidth - containerWidth;

          const mouseXRelativeToContainer =
            moveEvent.clientX - scrollContainerRect.left;

          const needsLeftScroll =
            mouseXRelativeToContainer <= 60 && scrollLeft > 0;
          const needsRightScroll =
            mouseXRelativeToContainer >= containerWidth - 60 &&
            scrollLeft < maxScrollLeft;

          const shouldControlPlayhead = !needsLeftScroll && !needsRightScroll;

          if (shouldControlPlayhead) {
            let x = moveEvent.clientX - containerRect.left;
            const maxContentWidth = maxDurationMs * pxPerMsRef.current;
            x = Math.max(0, Math.min(x, maxContentWidth));

            playhead.style.left = `${x}px`;

            const pxPerMs = pxPerMsRef.current;
            const timeMs = pxPerMs > 0 ? x / pxPerMs : 0;
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
    const pxPerMs = pxPerMsRef.current;
    const timeMs = pxPerMs > 0 ? playheadLeft / pxPerMs : 0;
    onCutSecondaryAt?.(Math.round(timeMs));
  }, [onCutSecondaryAt, pxPerMsRef]);

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
            width: `${(maxDurationMs / 1000) * PX_PER_SECOND}px`,
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
            <div className="absolute inset-y-0 left-0 right-0 mx-2 rounded bg-surface-tertiary/60" />
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
          <div className="bg-surface-secondary text-foreground-default px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium whitespace-nowrap border border-border">
            <span className="text-primary" ref={tooltipContentRef} />
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-secondary" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DualVideoTracks;
