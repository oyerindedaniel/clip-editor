"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useScale } from "@/hooks/app/use-scale";

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
  const tooltipPositionRef = useRef({ x: 0, y: 0 });

  function formatDurationDisplay(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  const maxDurationMs = Math.max(primaryDurationMs, secondaryDurationMs);
  const PX_PER_SECOND = 100;

  console.log(maxDurationMs);
  console.log({ primaryDurationMs, secondaryDurationMs });
  const { pxPerMsRef, recalc } = useScale({
    containerRef,
    durationMs: maxDurationMs,
    fixedPxPerSecond: PX_PER_SECOND,
    useFixedScaling: true,
  });

  const renderStrips = useCallback(() => {
    const renderInto = (
      container: HTMLDivElement | null,
      durationMs: number,
      frames?: string[]
    ) => {
      if (!container) return;
      container.innerHTML = "";

      const pxPerMs = pxPerMsRef.current;
      if (pxPerMs <= 0) return;

      if (frames && frames.length > 0) {
        // Calculate how many frames we need based on duration and fixed scaling
        const totalWidth = durationMs * pxPerMs;
        const frameWidth = 48; // Each thumbnail is 48px wide
        const numFrames = Math.ceil(totalWidth / frameWidth);

        for (let i = 0; i < numFrames; i++) {
          const thumb = document.createElement("div");
          thumb.style.width = "48px";
          thumb.style.height = "100%";

          // Use frame from array if available, otherwise use fallback
          const frameIndex = Math.min(i, frames.length - 1);
          if (frames[frameIndex]) {
            thumb.style.backgroundImage = `url(${frames[frameIndex]})`;
            thumb.style.backgroundSize = "cover";
            thumb.style.backgroundPosition = "center";
          } else {
            thumb.style.background =
              i % 2 === 0
                ? "var(--color-surface-tertiary)"
                : "var(--color-surface-hover)";
          }

          thumb.style.borderRight = "1px solid var(--color-subtle)";
          container.appendChild(thumb);
        }
      } else {
        // Fallback pattern - create enough blocks to fill the duration
        const totalWidth = durationMs * pxPerMs;
        const blockWidth = 48;
        const numBlocks = Math.ceil(totalWidth / blockWidth);

        for (let i = 0; i < numBlocks; i++) {
          const block = document.createElement("div");
          block.style.width = "48px";
          block.style.height = "100%";
          block.style.background =
            i % 2 === 0
              ? "var(--color-surface-tertiary)"
              : "var(--color-surface-hover)";
          block.style.borderRight = "1px solid var(--color-subtle)";
          container.appendChild(block);
        }
      }
    };

    renderInto(
      primaryStripRef.current,
      primaryDurationMs,
      primaryPreviewFrames
    );
    renderInto(
      secondaryStripRef.current,
      secondaryDurationMs,
      secondaryPreviewFrames
    );
  }, [
    primaryPreviewFrames,
    secondaryPreviewFrames,
    primaryDurationMs,
    secondaryDurationMs,
    pxPerMsRef,
  ]);

  const renderRuler = useCallback(() => {
    const el = rulerRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    el.innerHTML = "";
    const pxPerMs = pxPerMsRef.current;
    if (pxPerMs <= 0) return;

    const totalSeconds = Math.ceil(maxDurationMs / 1000);
    console.log(totalSeconds, maxDurationMs);
    for (let s = 0; s <= totalSeconds; s++) {
      const x = Math.round(s * 1000 * pxPerMs);
      const tick = document.createElement("div");
      tick.style.position = "absolute";
      tick.style.left = `${x}px`;
      tick.style.top = "0";
      tick.style.bottom = "0";
      tick.style.width = "1px";
      tick.style.background = "var(--color-subtle)";

      const label = document.createElement("div");
      label.style.position = "absolute";
      label.style.left = `${x + 2}px`;
      label.style.top = "0";
      label.style.fontSize = "10px";
      label.style.color = "var(--color-foreground-muted)";
      label.textContent = `${s}s`;

      el.appendChild(tick);
      el.appendChild(label);
    }
  }, [maxDurationMs, pxPerMsRef]);

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
  }, [primaryDurationMs, secondaryDurationMs, pxPerMsRef]);

  useEffect(() => {
    currentOffsetRef.current = initialOffsetMs;
    recalc();
    rafIdRef.current = requestAnimationFrame(() => {
      renderBlocks();
      renderStrips();
      renderRuler();
      // Ensure the container reserves height via spacer
      if (spacerRef.current) spacerRef.current.style.height = "160px"; // ruler + two tracks
    });
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [initialOffsetMs, recalc, renderBlocks, renderStrips, renderRuler]);

  const onSecondaryMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startOffset = currentOffsetRef.current;
      draggingSecondaryRef.current = true;
      setShowTooltip(true);

      const onMove = (ev: MouseEvent) => {
        if (!draggingSecondaryRef.current) return;
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          const dx = ev.clientX - startX;
          const pxPerMs = pxPerMsRef.current;
          const deltaMs = pxPerMs > 0 ? dx / pxPerMs : 0;
          const next = Math.max(0, startOffset + deltaMs);
          currentOffsetRef.current = next;
          renderBlocks();
          onOffsetChange?.(next);

          if (tooltipContentRef.current) {
            tooltipContentRef.current.textContent = `Offset: ${formatDurationDisplay(
              next
            )}`;
          }
          tooltipPositionRef.current = { x: ev.clientX, y: ev.clientY - 30 };
        });
      };

      const onUp = () => {
        draggingSecondaryRef.current = false;
        setShowTooltip(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        onCommitOffset?.(currentOffsetRef.current);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [onOffsetChange, onCommitOffset, pxPerMsRef, renderBlocks]
  );

  const onPlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      draggingPlayheadRef.current = true;
      setShowTooltip(true);

      const onMove = (ev: MouseEvent) => {
        if (!draggingPlayheadRef.current || !playheadRef.current) return;
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          let x = ev.clientX - rect.left;
          x = Math.max(0, Math.min(x, rect.width));
          playheadRef.current!.style.left = `${x}px`;

          const pxPerMs = pxPerMsRef.current;
          const timeMs = pxPerMs > 0 ? x / pxPerMs : 0;
          if (tooltipContentRef.current) {
            tooltipContentRef.current.textContent = `Playhead: ${formatDurationDisplay(
              timeMs
            )}`;
          }
          tooltipPositionRef.current = { x: ev.clientX, y: ev.clientY - 30 };
        });
      };

      const onUp = () => {
        draggingPlayheadRef.current = false;
        setShowTooltip(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [pxPerMsRef]
  );

  const handleCutSecondary = useCallback(() => {
    if (!containerRef.current || !playheadRef.current) return;
    const playheadLeft = parseFloat(playheadRef.current.style.left || "0");
    const pxPerMs = pxPerMsRef.current;
    const timeMs = pxPerMs > 0 ? playheadLeft / pxPerMs : 0;
    onCutSecondaryAt?.(Math.round(timeMs));
  }, [onCutSecondaryAt, pxPerMsRef]);

  return (
    <div className="flex flex-col gap-2 w-full h-[250px]">
      <div className="flex items-center justify-between">
        <div className="text-xs text-foreground-subtle">🎞️</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleCutSecondary}>
            <Scissors className="mr-1" size={14} /> Cut Secondary
          </Button>
        </div>
      </div>

      <div className="relative w-full rounded-md border border-border bg-surface-secondary overflow-x-auto overflow-y-hidden">
        <div
          ref={containerRef}
          className="relative min-w-full"
          style={{
            width: `${Math.max(
              1000,
              (maxDurationMs / 1000) * PX_PER_SECOND
            )}px`,
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
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltipPositionRef.current.x,
            top: tooltipPositionRef.current.y,
            transform: "translateX(-50%)",
          }}
        >
          <div className="bg-surface-secondary text-foreground-default px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium whitespace-nowrap border border-border">
            <span className="text-primary" ref={tooltipContentRef}>
              {formatDurationDisplay(maxDurationMs)}
            </span>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-secondary" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DualVideoTracks;
