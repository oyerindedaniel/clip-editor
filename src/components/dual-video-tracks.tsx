"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
  useLayoutEffect,
} from "react";
import { Redo2, Scissors, Undo2, X, Film } from "lucide-react";
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
import { HitArea } from "./hit-area";
import type { KeyframeData } from "@/utils/keyframe";
import { Keyframe } from "./keyframe";
import { useTimelineTooltip } from "@/hooks/app/use-timeline-tooltip";
import { TimelineTooltip } from "./timeline-tooltip";
import { getStorageKey } from "@/utils/app";
import { filterKeyframesByTarget } from "@/utils/keyframe";
import { msToSeconds } from "@/utils/video";
import { msToSecondsRate } from "@/utils/timeline-utils";

interface DualVideoTracksProps {
  primaryDurationMs: number;
  secondaryDurationMs: number;
  initialOffsetMs: number; // secondary relative to primary; positive means secondary starts later
  onOffsetChange?: (offsetMs: number) => void; // live as user drags
  onCommitOffset?: (offsetMs: number) => void; // when drag ends
  onCutSecondaryAt?: (trimData: { trimStart: number; trimEnd: number }) => void;
  primaryPreviewFrames?: string[];
  secondaryPreviewFrames?: string[];
  keyframes?: KeyframeData[];
  videoId?: string;
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
  onOffsetChange,
  onCutSecondaryAt,
  onCommitOffset,
  primaryPreviewFrames,
  secondaryPreviewFrames,
  keyframes,
  videoId,
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

  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const [trimStart, setTrimStart] = useState<number | null>(null);
  const [trimEnd, setTrimEnd] = useState<number | null>(null);

  const hasBothMarkers = trimStart !== null && trimEnd !== null;

  const markers = useMemo(() => {
    return [trimStart, trimEnd].filter((m): m is number => m !== null);
  }, [trimStart, trimEnd]);

  const markerCount = markers.length;

  const [editHistory, setEditHistory] = useState<Array<HistoryState>>(() => {
    const defaultState: Array<HistoryState> = [
      {
        trimStart: null,
        trimEnd: null,
        secondaryDurationMs,
        action: "init",
      },
    ];

    if (!videoId || typeof window === "undefined") {
      return defaultState;
    }

    try {
      const storageKey = getStorageKey(`${videoId}:dual-video-history`);
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Array<HistoryState>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    return defaultState;
  });

  const editHistoryRef = useLatestValue(editHistory);

  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useLatestValue(historyIndex);

  const currentState = editHistory[historyIndex];

  const currentSecondaryDurationMs = currentState
    ? currentState.secondaryDurationMs
    : secondaryDurationMs;

  const primaryKeyframes = useMemo(() => {
    return keyframes ? filterKeyframesByTarget(keyframes, "primary") : [];
  }, [keyframes]);

  const secondaryKeyframes = useMemo(() => {
    return keyframes ? filterKeyframesByTarget(keyframes, "secondary") : [];
  }, [keyframes]);

  const currentOffsetRef = useRef<number>(initialOffsetMs);
  const draggingSecondaryRef = useRef<boolean>(false);
  const draggingPlayheadRef = useRef<boolean>(false);

  const rafIdRef = useRef<number | null>(null);
  const moveRafIdRef = useRef<number | null>(null);

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

  const pxPerSecond = msToSecondsRate(pxPerMs);

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

  useLayoutEffect(() => {
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

  const saveHistoryToStorage = useCallback(
    (history: Array<HistoryState>) => {
      if (!videoId) return;

      try {
        const storageKey = getStorageKey(`${videoId}:dual-video-history`);
        localStorage.setItem(storageKey, JSON.stringify(history));
      } catch {}
    },
    [videoId]
  );

  const addToHistory = useCallback(
    (newState: HistoryState) => {
      setEditHistory((prev) => {
        const truncated = prev.slice(0, historyIndex + 1);
        const updated = [...truncated, newState];
        const finalHistory =
          updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;

        setHistoryIndex(finalHistory.length - 1);
        saveHistoryToStorage(finalHistory);

        return finalHistory;
      });
    },
    [historyIndex, saveHistoryToStorage]
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
        saveHistoryToStorage(editHistory);
      }
    }
  }, [editHistory, applyHistoryState, onCutSecondaryAt, saveHistoryToStorage]);

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
        saveHistoryToStorage(editHistory);
      }
    }
  }, [editHistory, applyHistoryState, onCutSecondaryAt, saveHistoryToStorage]);

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
      const target = e.target as HTMLElement;
      if (target.closest("[data-keyframe-marker]")) {
        return;
      }

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
          onOffsetChange?.(newOffset);
          renderBlocks();

          const markerX =
            msToPx(newOffset, pxPerMs) - scrollContainer.scrollLeft;
          updateTooltip(markerX, `Offset: ${formatDurationDisplay(newOffset)}`);
        }
      });

      flushSync(() => {
        setShowTooltip(true);
      });

      const markerX = msToPx(startOffset, pxPerMs) - scrollContainer.scrollLeft;
      updateTooltip(markerX, `Offset: ${formatDurationDisplay(startOffset)}`);

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
            onOffsetChange?.(newOffset);
            renderBlocks();

            const markerX =
              msToPx(newOffset, pxPerMs) - scrollContainer.scrollLeft;
            updateTooltip(
              markerX,
              `Offset: ${formatDurationDisplay(newOffset)}`
            );
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
      maxDurationMs,
      pxPerSecond,
      updateTooltip,
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
          const markerX = newLeft - scrollContainer.scrollLeft;
          updateTooltip(markerX, `Playhead: ${formatDurationDisplay(timeMs)}`);
        }
      });

      flushSync(() => {
        setShowTooltip(true);
      });

      const timeMs = pxToMs(startPlayheadPos, pxPerMs);
      const markerX = startPlayheadPos - scrollContainer.scrollLeft;
      updateTooltip(markerX, `Playhead: ${formatDurationDisplay(timeMs)}`);

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
            const markerX = newX - scrollContainer.scrollLeft;
            updateTooltip(
              markerX,
              `Playhead: ${formatDurationDisplay(timeMs)}`
            );
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
    [
      pxPerMs,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      currentSecondaryDurationMs,
      updateTooltip,
    ]
  );

  return (
    <div className="flex relative flex-col gap-2 w-full h-[250px]">
      <div className="flex items-center justify-between">
        <div className="text-sm md:text-[0.8rem] text-foreground-subtle">
          <Film size={14} />
        </div>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRedo}
                disabled={historyIndex >= editHistory.length - 1}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
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
            width: `${msToSeconds(maxDurationMs) * pxPerSecond}px`,
          }}
        >
          <div ref={spacerRef} />
          <div className="absolute inset-x-0 top-0 h-5" ref={rulerRef} />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-primary/40 to-transparent pointer-events-none" />

          <div
            ref={playheadRef}
            className="absolute top-0 left-0 bottom-0 z-[10] cursor-ew-resize"
          >
            <HitArea variant="x" onMouseDown={onPlayheadMouseDown}>
              <div className="relative h-full">
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-primary" />
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 bg-primary rotate-45" />
              </div>
            </HitArea>
          </div>

          {markers.map((markerTime, index) => (
            <div
              key={`marker-${index}-${markerTime}`}
              className="absolute top-0 bottom-0 z-5"
              style={{ left: `${msToPx(markerTime, pxPerMs)}px` }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <HitArea variant="x" className="relative h-full">
                    <div className="relative h-full">
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-yellow-500" />
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 bg-yellow-500 rounded-full" />
                    </div>
                  </HitArea>
                </TooltipTrigger>

                <TooltipContent side="top" className="flex items-center gap-2">
                  <span className="text-sm md:text-[0.8rem]">
                    Marker at {msToSeconds(markerTime).toFixed(1)}s
                  </span>
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

          <div className="absolute inset-x-0 top-6 h-14">
            <div className="absolute inset-0 rounded bg-surface-tertiary/60" />
            <div
              aria-label="primary video"
              tabIndex={0}
              ref={primaryBlockRef}
              className={cn(
                "absolute top-0 h-full rounded-md border border-default overflow-hidden",
                "shadow-inner focus:outline-none focus-visible:border-2 focus-visible:border-primary"
              )}
              title="Primary video"
            >
              <div
                ref={primaryStripRef}
                className="absolute inset-0 flex items-stretch"
              />

              {primaryKeyframes.map((kf) => (
                <Keyframe.Marker
                  key={kf.id}
                  keyframeId={kf.id}
                  scrollRef={scrollContainerRef!}
                  pxPerMs={pxPerMs}
                  edgeThreshold={EDGE_THRESHOLD}
                />
              ))}
            </div>
          </div>

          <div className="absolute inset-x-0 top-24 h-14">
            <div className="absolute inset-0 rounded bg-surface-tertiary/60" />
            <div
              aria-label="secondary video"
              tabIndex={0}
              ref={secondaryBlockRef}
              onMouseDown={onSecondaryMouseDown}
              className={cn(
                "absolute top-0 h-full rounded-md border border-default overflow-hidden",
                "shadow-inner cursor-grab active:cursor-grabbing focus:outline-none focus-visible:border-2 focus-visible:border-primary"
              )}
              title="Secondary video (drag to align)"
            >
              <div
                ref={secondaryStripRef}
                className="absolute inset-0 flex items-stretch"
              />

              {secondaryKeyframes.map((kf) => (
                <Keyframe.Marker
                  key={kf.id}
                  keyframeId={kf.id}
                  scrollRef={scrollContainerRef!}
                  pxPerMs={pxPerMs}
                  edgeThreshold={EDGE_THRESHOLD}
                />
              ))}

              {trimStart !== null && trimEnd !== null && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: `${msToPx(trimStart, pxPerMs)}px`,
                    width: `${Math.max(
                      0,
                      msToPx(trimEnd - trimStart, pxPerMs)
                    )}px`,
                  }}
                >
                  <div className="absolute inset-0 bg-primary/15 border-2 border-primary" />
                </div>
              )}
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

export default DualVideoTracks;
