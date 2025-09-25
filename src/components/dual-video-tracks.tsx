"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { Redo2, Scissors, Undo2, X } from "lucide-react";
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
import logger from "@/utils/logger";
import { useLatestValue } from "@/hooks/use-latest-value";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { MAX_HISTORY } from "@/constants/app";
import { useShallowSelector } from "react-shallow-store";
import { ClipContext } from "@/contexts/clip-context";
import { HitArea } from "./hit-area";

interface DualVideoTracksProps {
  primaryDurationMs: number;
  secondaryDurationMs: number;
  initialOffsetMs: number; // secondary relative to primary; positive means secondary starts later
  onOffsetChange?: (offsetMs: number) => void; // live as user drags
  onCommitOffset?: (offsetMs: number) => void; // when drag ends
  onCutSecondaryAt?: (trimData: { trimStart: number; trimEnd: number }) => void;
  primaryPreviewFrames?: string[];
  secondaryPreviewFrames?: string[];
}

type HistoryAction = "init" | "mark" | "cut";

interface HistoryState {
  trimStart: number | null;
  trimEnd: number | null;
  secondaryDurationMs: number;
  action: HistoryAction;
  prevSecondaryDurationMs?: number;
}

export const DualVideoTracks: React.FC<DualVideoTracksProps> = ({
  primaryDurationMs,
  secondaryDurationMs,
  initialOffsetMs,
  onCutSecondaryAt,
  onCommitOffset,
  primaryPreviewFrames,
  secondaryPreviewFrames,
}) => {
  const { setVideoOffsetMs } = useShallowSelector(ClipContext, (state) => ({
    setVideoOffsetMs: state.setVideoOffsetMs,
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

  const [trimStart, setTrimStart] = useState<number | null>(null);
  const [trimEnd, setTrimEnd] = useState<number | null>(null);

  const hasBothMarkers = trimStart !== null && trimEnd !== null;

  const markers = useMemo(() => {
    return [trimStart, trimEnd].filter((m): m is number => m !== null);
  }, [trimStart, trimEnd]);

  const markerCount = markers.length;

  const [editHistory, setEditHistory] = useState<Array<HistoryState>>([
    {
      trimStart: null,
      trimEnd: null,
      secondaryDurationMs,
      action: "init",
    },
  ]);
  const editHistoryRef = useLatestValue(editHistory);

  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useLatestValue(historyIndex);

  const currentState = editHistory[historyIndex];

  const currentSecondaryDurationMs = currentState
    ? currentState.secondaryDurationMs
    : secondaryDurationMs;

  const currentOffsetRef = useRef<number>(initialOffsetMs);
  const draggingSecondaryRef = useRef<boolean>(false);
  const draggingPlayheadRef = useRef<boolean>(false);

  const rafIdRef = useRef<number | null>(null);
  const moveRafIdRef = useRef<number | null>(null);

  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipContentRef = useRef<HTMLSpanElement>(null);
  const lastSecondaryTooltipRef = useRef<string>("");
  const lastPlayheadTooltipRef = useRef<string>("");

  const primaryStripInitialized = useRef(false);

  const maxDurationMs = Math.max(primaryDurationMs, currentSecondaryDurationMs);

  const maxDurationMsRef = useLatestValue(maxDurationMs);

  const FIXED_PX_PER_SECOND = 100;
  const EDGE_THRESHOLD = 30;

  const { pxPerMs } = useScale({
    containerRef,
    durationMs: maxDurationMs,
    type: "fixed",
    fixedPxPerSecond: FIXED_PX_PER_SECOND,
  });

  const pxPerSecond = pxPerMs * 1000; // in px

  const { handleAutoScroll, startAutoScroll, stopAutoScroll } = useAutoScroll({
    edgeThreshold: EDGE_THRESHOLD,
    maxScrollSpeed: 10,
    acceleration: 1.2,
  });

  const getVisualState = useCallback((state: HistoryState) => {
    let visualDuration = state.secondaryDurationMs;
    let visualOffset = 0;

    if (
      state.action === "cut" &&
      state.trimStart !== null &&
      state.trimEnd !== null
    ) {
      visualDuration = state.trimEnd - state.trimStart;
      visualOffset = state.trimStart;
    }

    return { visualDuration, visualOffset };
  }, []);

  const renderRuler = useCallback(() => {
    if (pxPerMs <= 0) return;

    renderTimelineRuler({
      pxPerMs,
      durationMs: maxDurationMsRef.current,
      container: rulerRef.current,
    });
  }, [pxPerMs]);

  const renderStrips = useCallback(() => {
    if (pxPerMs <= 0) return;

    // Primary strips
    if (!primaryStripInitialized.current) {
      renderTimelineStrips({
        pxPerMs,
        durationMs: primaryDurationMs,
        frames: primaryPreviewFrames,
        container: primaryStripRef.current,
      });
      primaryStripInitialized.current = true;
    }

    const state = editHistoryRef.current[historyIndexRef.current];

    if (!state) return;

    const { visualDuration } = getVisualState(state);
    let trimmedFrames = secondaryPreviewFrames;

    const trimStart = state.trimStart;
    const trimEnd = state.trimEnd;

    if (
      secondaryPreviewFrames &&
      secondaryPreviewFrames.length > 0 &&
      trimStart !== null &&
      trimEnd !== null
    ) {
      const startRatio = trimStart / state.secondaryDurationMs;
      const endRatio = trimEnd / state.secondaryDurationMs;

      const startFrameIndex = Math.floor(
        startRatio * secondaryPreviewFrames.length
      );
      const endFrameIndex = Math.ceil(endRatio * secondaryPreviewFrames.length);

      trimmedFrames = secondaryPreviewFrames.slice(
        startFrameIndex,
        endFrameIndex
      );
    }

    // Secondary strips

    renderTimelineStrips({
      pxPerMs,
      durationMs: visualDuration,
      frames: trimmedFrames,
      container: secondaryStripRef.current,
    });
  }, [
    primaryDurationMs,
    pxPerMs,
    primaryPreviewFrames,
    secondaryPreviewFrames,
  ]);

  const renderBlocks = useCallback(() => {
    if (pxPerMs <= 0) return;

    const offsetMs = currentOffsetRef.current;
    const state = editHistoryRef.current[historyIndexRef.current];
    if (!state) return;

    const { visualDuration, visualOffset } = getVisualState(state);

    if (primaryBlockRef.current) {
      const width = Math.max(0, msToPx(primaryDurationMs, pxPerMs));
      primaryBlockRef.current.style.width = `${width}px`;
      primaryBlockRef.current.style.left = `0px`;
    }

    if (secondaryBlockRef.current) {
      const width = Math.max(0, msToPx(visualDuration, pxPerMs));
      const left = Math.max(0, msToPx(offsetMs + visualOffset, pxPerMs));

      secondaryBlockRef.current.style.width = `${width}px`;
      secondaryBlockRef.current.style.left = `${left}px`;

      if (playheadRef.current) {
        const playheadLeft = parseFloat(playheadRef.current.style.left || "0");
        const blockEnd = left + width;

        if (playheadLeft > blockEnd) {
          playheadRef.current.style.left = `${blockEnd}px`;
        }
      }
    }
  }, [primaryDurationMs, pxPerMs]);

  useEffect(() => {
    currentOffsetRef.current = initialOffsetMs;

    rafIdRef.current = requestAnimationFrame(() => {
      renderBlocks();
      renderRuler();

      if (spacerRef.current) spacerRef.current.style.height = "160px"; // ruler + two tracks
    });
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [initialOffsetMs, renderBlocks, renderStrips, renderRuler]);

  useEffect(() => {
    renderStrips();
  }, [renderStrips]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && e.key === "Z") || e.key === "y")
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const addToHistory = useCallback(
    (newState: HistoryState) => {
      setEditHistory((prev) => {
        const truncated = prev.slice(0, historyIndex + 1);
        const updated = [...truncated, newState];
        const finalHistory =
          updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;

        setHistoryIndex(finalHistory.length - 1);
        return finalHistory;
      });
    },
    [historyIndex]
  );

  const applyHistoryState = useCallback(
    (state: HistoryState, withRender: boolean = true) => {
      if (!state) {
        logger.warn("Attempted to apply undefined history state");
        return;
      }

      setTrimStart(state.trimStart);
      setTrimEnd(state.trimEnd);

      if (withRender) {
        rafIdRef.current = requestAnimationFrame(() => {
          renderBlocks();
          renderRuler();
          renderStrips();
        });
      }
    },
    [renderBlocks, renderRuler, renderStrips]
  );

  const handleUndo = useCallback(() => {
    let newIndex: number | null = null;

    flushSync(() => {
      setHistoryIndex((prevIndex) => {
        if (prevIndex > 0) {
          newIndex = prevIndex - 1;
          return newIndex;
        }
        return prevIndex;
      });
    });

    if (newIndex !== null) {
      const stateToApply = editHistory[newIndex];
      const prevState = editHistory[newIndex + 1];

      if (stateToApply) {
        if (prevState?.action === "cut" && prevState.prevSecondaryDurationMs) {
          onCutSecondaryAt?.({
            trimStart: 0,
            trimEnd: Math.round(prevState.prevSecondaryDurationMs),
          });
        }

        const needsRender =
          !prevState ||
          stateToApply.secondaryDurationMs !== prevState.secondaryDurationMs ||
          stateToApply.action === "cut";

        applyHistoryState(stateToApply, needsRender);
      }
    }
  }, [editHistory, applyHistoryState, onCutSecondaryAt]);

  const handleRedo = useCallback(() => {
    let newIndex: number | null = null;

    flushSync(() => {
      setHistoryIndex((prevIndex) => {
        if (prevIndex < editHistory.length - 1) {
          newIndex = prevIndex + 1;
          return newIndex;
        }
        return prevIndex;
      });
    });

    if (newIndex !== null) {
      const stateToApply = editHistory[newIndex];

      if (stateToApply) {
        if (
          stateToApply.action === "cut" &&
          stateToApply.trimStart !== null &&
          stateToApply.trimEnd !== null
        ) {
          onCutSecondaryAt?.({
            trimStart: Math.round(stateToApply.trimStart),
            trimEnd: Math.round(stateToApply.trimEnd),
          });
        }

        const prevState = editHistory[newIndex - 1];
        const needsRender =
          !prevState ||
          stateToApply.secondaryDurationMs !== prevState.secondaryDurationMs ||
          stateToApply.action === "cut";

        applyHistoryState(stateToApply, needsRender);
      }
    }
  }, [editHistory, applyHistoryState, onCutSecondaryAt]);

  const handleAddMarker = useCallback(() => {
    if (!containerRef.current || !playheadRef.current) return;

    const playheadLeft = parseFloat(playheadRef.current.style.left || "0");
    const timeMs = pxToMs(playheadLeft, pxPerMs);

    let nextStart = trimStart;
    let nextEnd = trimEnd;

    if (trimStart !== null && trimEnd === null) {
      if (trimStart <= timeMs) {
        nextStart = trimStart;
        nextEnd = timeMs;
      } else {
        nextStart = timeMs;
        nextEnd = trimStart;
      }
    } else {
      nextStart = timeMs;
      nextEnd = null;
    }

    const state = {
      trimStart: nextStart,
      trimEnd: nextEnd,
      secondaryDurationMs: currentSecondaryDurationMs,
      action: "mark",
    } satisfies HistoryState;

    addToHistory(state);

    applyHistoryState(state, false);
  }, [pxPerMs, addToHistory, currentSecondaryDurationMs, trimStart, trimEnd]);

  const handleCutSecondary = useCallback(() => {
    if (trimStart === null || trimEnd === null) {
      logger.warn("Both trim markers must be set before cutting");
      return;
    }

    onCutSecondaryAt?.({
      trimStart: Math.round(trimStart),
      trimEnd: Math.round(trimEnd),
    });

    const newDuration = trimEnd - trimStart;

    const state = {
      trimStart: null,
      trimEnd: null,
      secondaryDurationMs: newDuration,
      action: "cut",
      prevSecondaryDurationMs: currentSecondaryDurationMs,
    } satisfies HistoryState;

    addToHistory(state);

    applyHistoryState(state);
  }, [
    onCutSecondaryAt,
    addToHistory,
    trimStart,
    trimEnd,
    currentSecondaryDurationMs,
    renderStrips,
    renderBlocks,
  ]);

  const onSecondaryMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const scrollContainer = scrollContainerRef.current;
      const container = containerRef.current;

      if (!scrollContainer || !container) return;

      if (hasBothMarkers) {
        toast.warning("Move is disabled while both markers are set");
        return;
      }

      const containerRect = container.getBoundingClientRect();

      let isDragging = true;
      const startOffset = currentOffsetRef.current;

      const moveEvent = e;
      const startMouseX = moveEvent.clientX - containerRect.left;

      const maxOffsetMs = primaryDurationMs - pxToMs(pxPerSecond, pxPerMs);

      draggingSecondaryRef.current = true;

      startAutoScroll(scrollContainerRef.current, (scrollDelta) => {
        const primaryMaxPx = msToPx(maxOffsetMs, pxPerMs);
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

        if (Math.abs(scrollDelta) > 0 && shouldAllowAutoScroll) {
          const deltaMs = pxToMs(scrollDelta, pxPerMs);
          const newOffset = Math.max(
            0,
            Math.min(currentOffsetRef.current + deltaMs, maxOffsetMs)
          );

          currentOffsetRef.current = newOffset;
          setVideoOffsetMs(newOffset);
          renderBlocks();

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

        if (moveRafIdRef.current) cancelAnimationFrame(moveRafIdRef.current);

        moveRafIdRef.current = requestAnimationFrame(() => {
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          if (!scrollContainerRect || !containerRect) return;

          const maxContentWidth = msToPx(maxDurationMs, pxPerMs);

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

            const deltaMs = pxToMs(deltaX, pxPerMs);
            const newOffset = Math.max(
              0,
              Math.min(startOffset + deltaMs, maxOffsetMs)
            );

            currentOffsetRef.current = newOffset;
            setVideoOffsetMs(newOffset);
            renderBlocks();

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

        if (moveRafIdRef.current) {
          cancelAnimationFrame(moveRafIdRef.current);
          moveRafIdRef.current = null;
        }

        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);

        onCommitOffset?.(currentOffsetRef.current);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [
      onCommitOffset,
      pxPerMs,
      renderBlocks,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      primaryDurationMs,
      hasBothMarkers,
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
      const secondaryWidth = msToPx(currentSecondaryDurationMs, pxPerMs);

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
          const timeMs = pxToMs(newLeft, pxPerMs);
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
        const timeMs = pxToMs(startPlayheadPos, pxPerMs);
        const text = `Playhead: ${formatDurationDisplay(timeMs)}`;
        tooltipContentRef.current.textContent = text;
        lastPlayheadTooltipRef.current = text;
      }

      const onMove = (moveEvent: MouseEvent) => {
        const playhead = playheadRef.current;
        if (!isDragging || !playhead) return;

        if (moveRafIdRef.current) cancelAnimationFrame(moveRafIdRef.current);
        moveRafIdRef.current = requestAnimationFrame(() => {
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
            const timeMs = pxToMs(newX, pxPerMs);
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
        if (moveRafIdRef.current) {
          cancelAnimationFrame(moveRafIdRef.current);
          moveRafIdRef.current = null;
        }
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [pxPerMs, handleAutoScroll, startAutoScroll, stopAutoScroll, maxDurationMs]
  );

  return (
    <div className="flex relative flex-col gap-2 w-full h-[250px]">
      <div className="flex items-center justify-between">
        <div className="text-xs text-foreground-subtle">🎞️</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleAddMarker}>
            Add Marker ({markerCount}/2)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCutSecondary}
            disabled={trimStart === null || trimEnd === null}
          >
            <Scissors className="mr-1" size={14} /> Cut Secondary
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRedo}
            disabled={historyIndex >= editHistory.length - 1}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
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

          <HitArea
            buffer={20}
            className="absolute top-0 bottom-0 left-0 z-20 cursor-ew-resize"
            onMouseDown={onPlayheadMouseDown}
          >
            <div ref={playheadRef} className="relative h-full">
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-primary" />
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 bg-primary rotate-45" />
            </div>
          </HitArea>

          {markers.map((markerTime, index) => (
            <div
              key={`marker-${index}-${markerTime}`}
              className="absolute top-0 bottom-0 z-10"
              style={{ left: `${msToPx(markerTime, pxPerMs)}px` }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <HitArea className="relative h-full">
                    <div className="absolute top-0 bottom-0 w-px bg-yellow-500 left-1/2 -translate-x-1/2" />
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 bg-yellow-500 rounded-full" />
                  </HitArea>
                </TooltipTrigger>
                <TooltipContent side="top" className="flex items-center gap-2">
                  <span className="text-xs">Marker at {markerTime}ms</span>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="size-4"
                    onClick={() => {
                      if (trimStart === markerTime) setTrimStart(null);
                      if (trimEnd === markerTime) setTrimEnd(null);
                    }}
                  >
                    <X className="size-3 text-white" />
                  </Button>
                </TooltipContent>
              </Tooltip>
            </div>
          ))}

          <div className="absolute left-0 right-0 top-6 h-14">
            <div className="absolute inset-y-0 left-0 right-0 rounded bg-surface-tertiary/60" />
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
          <div className="bg-surface-secondary text-foreground-default px-3 py-1.5 rounded-3xl shadow-lg text-xs font-medium whitespace-nowrap">
            <span className="text-primary" ref={tooltipContentRef} />
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-secondary" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DualVideoTracks;
