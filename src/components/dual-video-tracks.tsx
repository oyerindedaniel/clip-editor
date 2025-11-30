"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { Redo2, Scissors, Undo2, X, Film, RotateCcw } from "lucide-react";
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
import { ClipContext } from "@/contexts/clip-context";
import { useShallowSelector } from "react-shallow-store";
import { useLazyRef } from "@/hooks/use-lazy-ref";
import { useIsoLayoutEffect } from "@/hooks/use-Isomorphic-layout-effect";
import { useStableHandler } from "@/hooks/use-stable-handler";

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
  id: string;
}

type HistoryAction = "init" | "mark" | "cut";

interface HistoryState {
  trimStart: number | null;
  trimEnd: number | null;
  secondaryDurationMs: number;
  action: HistoryAction;

  // For cut actions, store the trim points that were applied
  cutTrimStart?: number;
  cutTrimEnd?: number;

  accumulatedOffset?: number; // How far into the original video does the current segment start
  trackOffset?: number; // Track alignment offset (secondary relative to primary)
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
  id,
}) => {
  const { clearTrimData, canClearTrim } = useShallowSelector(
    ClipContext,
    (state) => ({
      clearTrimData: state.clearTrimData,
      canClearTrim: state.canClearTrim,
    })
  );

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

  const initialStateRef = useLazyRef(() =>
    getHistoryState(id, secondaryDurationMs)
  );

  const [editHistory, setEditHistory] = useState<HistoryState[]>(
    initialStateRef.current.history
  );
  const editHistoryRef = useLatestValue(editHistory);

  const [historyIndex, setHistoryIndex] = useState<number>(
    initialStateRef.current.index
  );
  const historyIndexRef = useRef(historyIndex);

  const currentState = editHistory[historyIndex];

  const currentSecondaryDurationMs = currentState
    ? currentState.secondaryDurationMs
    : secondaryDurationMs;

  const currentAccumulatedOffset = useMemo(() => {
    return currentState?.accumulatedOffset ?? 0;
  }, [currentState]);

  const [trimStart, setTrimStart] = useState<number | null>(
    initialStateRef.current.trimStart
  );

  const [trimEnd, setTrimEnd] = useState<number | null>(
    initialStateRef.current.trimEnd
  );

  const hasBothMarkers = trimStart !== null && trimEnd !== null;

  const markers = useMemo(() => {
    return [trimStart, trimEnd].filter((m): m is number => m !== null);
  }, [trimStart, trimEnd]);

  const markerCount = markers.length;

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

  const renderPrimaryStrip = useRef(true);

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
      state.cutTrimStart !== undefined &&
      state.cutTrimEnd !== undefined
    ) {
      visualDuration = state.cutTrimEnd - state.cutTrimStart;
      // Visual offset is NOT needed - we're rendering the segment as-is
      visualOffset = 0;
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
    if (renderPrimaryStrip.current) {
      renderTimelineStrips({
        pxPerMs,
        durationMs: primaryDurationMs,
        frames: primaryPreviewFrames,
        container: primaryStripRef.current,
      });

      if (!!primaryPreviewFrames?.length) {
        renderPrimaryStrip.current = false;
      }
    }

    const state = editHistoryRef.current[historyIndexRef.current];
    if (!state) return;

    const { visualDuration } = getVisualState(state);

    // Secondary strips
    renderTimelineStrips({
      pxPerMs,
      durationMs: visualDuration,
      frames: secondaryPreviewFrames,
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

    const { visualDuration } = getVisualState(state);

    if (primaryBlockRef.current) {
      const width = Math.max(0, msToPx(primaryDurationMs, pxPerMs));
      primaryBlockRef.current.style.width = `${width}px`;
      primaryBlockRef.current.style.left = `0px`;
    }

    if (secondaryBlockRef.current) {
      const width = Math.max(0, msToPx(visualDuration, pxPerMs));
      const left = Math.max(0, msToPx(offsetMs, pxPerMs));

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
  }, [primaryDurationMs, pxPerMs, getVisualState]);

  const visualMarkers = useMemo(() => {
    if (trimStart === null && trimEnd === null) return [];

    const offset = currentAccumulatedOffset;
    const trackOffset = currentOffsetRef.current;
    const markers: Array<{ time: number; isInView: boolean }> = [];

    if (trimStart !== null) {
      const relativeTime = trimStart - offset;
      const timelinePosition = relativeTime + trackOffset;
      markers.push({
        time: timelinePosition,
        isInView:
          relativeTime >= 0 && relativeTime <= currentSecondaryDurationMs,
      });
    }

    if (trimEnd !== null) {
      const relativeTime = trimEnd - offset;
      const timelinePosition = relativeTime + trackOffset;
      markers.push({
        time: timelinePosition,
        isInView:
          relativeTime >= 0 && relativeTime <= currentSecondaryDurationMs,
      });
    }

    return markers;
  }, [
    trimStart,
    trimEnd,
    currentAccumulatedOffset,
    currentSecondaryDurationMs,
  ]);

  useIsoLayoutEffect(() => {
    currentOffsetRef.current = initialOffsetMs;

    rafIdRef.current = requestAnimationFrame(() => {
      renderBlocks();
      renderRuler();

      if (spacerRef.current) spacerRef.current.style.height = "160px"; // ruler + two tracks
    });
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [initialOffsetMs, renderBlocks, renderRuler]);

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
      if (!id) return;

      try {
        const storageKey = getStorageKey(`${id}:dual-video-history`);
        localStorage.setItem(storageKey, JSON.stringify(history));
      } catch {}
    },
    [id]
  );

  const addToHistory = (newState: HistoryState) => {
    const stateWithOffset = {
      ...newState,
      trackOffset: newState.trackOffset ?? currentOffsetRef.current,
    };

    const updated = [...editHistory, stateWithOffset];
    const finalHistory =
      updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;
    const newIndex = finalHistory.length - 1;

    setEditHistory(finalHistory);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
    saveHistoryToStorage(finalHistory);
  };

  const applyHistoryState = (
    state: HistoryState,
    withRender: boolean = true
  ) => {
    if (!state) {
      logger.warn("Attempted to apply undefined history state");
      return;
    }

    setTrimStart(state.trimStart);
    setTrimEnd(state.trimEnd);

    if (state.trackOffset !== undefined) {
      currentOffsetRef.current = state.trackOffset;
      onOffsetChange?.(state.trackOffset);
    }

    if (withRender) {
      rafIdRef.current = requestAnimationFrame(() => {
        renderBlocks();
        renderRuler();
        renderStrips();
      });
    }
  };

  const handleCommitTrackOffset = useCallback(
    (newOffset: number) => {
      const lastState = editHistory[historyIndex];
      if (lastState && lastState.trackOffset === newOffset) return;

      const state = {
        trimStart,
        trimEnd,
        secondaryDurationMs: currentSecondaryDurationMs,
        action: "mark" as const,
        accumulatedOffset: currentAccumulatedOffset,
        trackOffset: newOffset,
      };

      addToHistory(state);
    },
    [
      editHistory,
      historyIndex,
      trimStart,
      trimEnd,
      currentSecondaryDurationMs,
      currentAccumulatedOffset,
    ]
  );

  const handleUndo = useStableHandler(() => {
    let newIndex: number | null = null;

    setHistoryIndex((prevIndex) => {
      if (prevIndex > 0) {
        newIndex = prevIndex - 1;
        historyIndexRef.current = newIndex;
        return newIndex;
      }
      return prevIndex;
    });

    if (newIndex !== null) {
      const stateToApply = editHistory[newIndex];
      const currentState = editHistory[newIndex + 1];

      if (stateToApply) {
        // If currently on a cut state, restore previous segment
        if (currentState.action === "cut") {
          const previousCutState = editHistory
            .slice(0, newIndex + 1)
            .reverse()
            .find((state) => state.action === "cut");

          onCutSecondaryAt?.({
            trimStart: previousCutState?.cutTrimStart ?? 0,
            trimEnd: previousCutState?.cutTrimEnd ?? secondaryDurationMs,
          });
        }
        // If going TO a cut state, apply it
        else if (
          stateToApply.action === "cut" &&
          stateToApply.cutTrimStart !== undefined &&
          stateToApply.cutTrimEnd !== undefined
        ) {
          onCutSecondaryAt?.({
            trimStart: stateToApply.cutTrimStart,
            trimEnd: stateToApply.cutTrimEnd,
          });
        }

        const needsRender =
          !currentState ||
          stateToApply.secondaryDurationMs !==
            currentState.secondaryDurationMs ||
          stateToApply.action === "cut" ||
          currentState.action === "cut";

        applyHistoryState(stateToApply, needsRender);
        saveHistoryToStorage(editHistory);
      }
    }
  });

  const handleRedo = useStableHandler(() => {
    let newIndex: number | null = null;

    setHistoryIndex((prevIndex) => {
      if (prevIndex < editHistory.length - 1) {
        newIndex = prevIndex + 1;
        historyIndexRef.current = newIndex;
        return newIndex;
      }
      return prevIndex;
    });

    if (newIndex !== null) {
      const stateToApply = editHistory[newIndex];
      const currentState = editHistory[newIndex - 1];

      if (stateToApply) {
        // If redoing TO a cut state, apply it
        if (
          stateToApply.action === "cut" &&
          stateToApply.cutTrimStart !== undefined &&
          stateToApply.cutTrimEnd !== undefined
        ) {
          onCutSecondaryAt?.({
            trimStart: stateToApply.cutTrimStart,
            trimEnd: stateToApply.cutTrimEnd,
          });
        }
        // If currently on a cut and going to non-cut, need to restore
        else if (currentState.action === "cut") {
          const previousCutState = editHistory
            .slice(0, newIndex)
            .reverse()
            .find((state) => state.action === "cut");

          onCutSecondaryAt?.({
            trimStart: previousCutState?.cutTrimStart ?? 0,
            trimEnd: previousCutState?.cutTrimEnd ?? secondaryDurationMs,
          });
        }

        const needsRender =
          !currentState ||
          stateToApply.secondaryDurationMs !==
            currentState.secondaryDurationMs ||
          stateToApply.action === "cut" ||
          currentState.action === "cut";

        applyHistoryState(stateToApply, needsRender);
        saveHistoryToStorage(editHistory);
      }
    }
  });

  const handleAddMarker = () => {
    if (
      !containerRef.current ||
      !playheadRef.current ||
      !secondaryBlockRef.current
    ) {
      return;
    }

    const playheadLeft = parseFloat(playheadRef.current.style.left || "0");
    const secondaryBlockLeft = parseFloat(
      secondaryBlockRef.current.style.left || "0"
    );

    const timeRelativeToBlock = pxToMs(
      playheadLeft - secondaryBlockLeft,
      pxPerMs
    );

    const normalizedTimeMs = timeRelativeToBlock + currentAccumulatedOffset;

    let nextStart = trimStart;
    let nextEnd = trimEnd;

    if (trimStart !== null && trimEnd === null) {
      if (trimStart <= normalizedTimeMs) {
        nextStart = trimStart;
        nextEnd = normalizedTimeMs;
      } else {
        nextStart = normalizedTimeMs;
        nextEnd = trimStart;
      }
    } else {
      nextStart = normalizedTimeMs;
      nextEnd = null;
    }

    const state = {
      trimStart: nextStart,
      trimEnd: nextEnd,
      secondaryDurationMs: currentSecondaryDurationMs,
      action: "mark",
      accumulatedOffset: currentAccumulatedOffset,
    } satisfies HistoryState;

    addToHistory(state);
    applyHistoryState(state, false);
  };

  const handleCutSecondary = () => {
    if (trimStart === null || trimEnd === null) {
      logger.warn("Both trim markers must be set before cutting");
      return;
    }

    onCutSecondaryAt?.({
      trimStart: trimStart,
      trimEnd: trimEnd,
    });

    const newDuration = trimEnd - trimStart;

    const state = {
      trimStart: null,
      trimEnd: null,
      secondaryDurationMs: newDuration,
      action: "cut",
      cutTrimStart: trimStart,
      cutTrimEnd: trimEnd,
      accumulatedOffset: trimStart,
    } satisfies HistoryState;

    addToHistory(state);
    applyHistoryState(state);
  };

  const onSecondaryPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-keyframe-marker]")) {
      return;
    }

    e.preventDefault();

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

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

    draggingSecondaryRef.current = true;

    startAutoScroll(scrollContainerRef.current, (scrollDelta) => {
      const { canScrollLeft, canScrollRight } = getScrollState(scrollContainer);

      const isScrollingLeft = scrollDelta < 0;
      const isScrollingRight = scrollDelta > 0;

      const shouldAllowAutoScroll =
        (isScrollingLeft && canScrollLeft) ||
        (isScrollingRight && canScrollRight);

      if (Math.abs(scrollDelta) > 0 && shouldAllowAutoScroll) {
        const deltaMs = pxToMs(scrollDelta, pxPerMs);
        const newOffset = Math.max(
          0,
          Math.min(currentOffsetRef.current + deltaMs, primaryDurationMs)
        );

        currentOffsetRef.current = newOffset;
        onOffsetChange?.(newOffset);
        renderBlocks();

        const markerX = msToPx(newOffset, pxPerMs) - scrollContainer.scrollLeft;
        updateTooltip(markerX, `Offset: ${formatDurationDisplay(newOffset)}`);
      }
    });

    flushSync(() => {
      setShowTooltip(true);
    });

    const markerX = msToPx(startOffset, pxPerMs) - scrollContainer.scrollLeft;
    updateTooltip(markerX, `Offset: ${formatDurationDisplay(startOffset)}`);

    const onMove = (moveEvent: PointerEvent) => {
      if (!isDragging) return;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        const scrollContainerRect = scrollContainer.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (!scrollContainerRect || !containerRect) return;

        const { containerWidth, canScrollLeft, canScrollRight } =
          getScrollState(scrollContainer);

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
            Math.min(startOffset + deltaMs, primaryDurationMs)
          );

          currentOffsetRef.current = newOffset;
          onOffsetChange?.(newOffset);
          renderBlocks();

          const markerX =
            msToPx(newOffset, pxPerMs) - scrollContainer.scrollLeft;
          updateTooltip(markerX, `Offset: ${formatDurationDisplay(newOffset)}`);
        }
      });
    };

    const onUp = (upEvent: PointerEvent) => {
      isDragging = false;
      draggingSecondaryRef.current = false;
      stopAutoScroll();
      setShowTooltip(false);

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      (upEvent.target as HTMLElement).releasePointerCapture(e.pointerId);

      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      onCommitOffset?.(currentOffsetRef.current);
      handleCommitTrackOffset(currentOffsetRef.current);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const onPlayheadPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const scrollContainer = scrollContainerRef.current;
    const playhead = playheadRef.current;
    const container = containerRef.current;

    if (!scrollContainer || !container || !playhead) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    let isDragging = true;
    const startPlayheadPos = parseFloat(playhead.style.left || "0");
    draggingPlayheadRef.current = true;

    const secondaryEnd =
      msToPx(currentSecondaryDurationMs, pxPerMs) +
      msToPx(currentOffsetRef.current, pxPerMs);

    startAutoScroll(scrollContainerRef.current, (scrollDelta) => {
      const { canScrollLeft, canScrollRight } = getScrollState(scrollContainer);
      const isScrollingLeft = scrollDelta < 0;
      const isScrollingRight = scrollDelta > 0;
      const shouldAllowAutoScroll =
        (isScrollingLeft && canScrollLeft) ||
        (isScrollingRight && canScrollRight);

      if (Math.abs(scrollDelta) > 0 && shouldAllowAutoScroll) {
        const currentLeft = parseFloat(playhead.style.left || "0");
        const newLeft = Math.max(
          0,
          Math.min(currentLeft + scrollDelta, secondaryEnd)
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

    const onMove = (moveEvent: PointerEvent) => {
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
          newX = Math.max(0, Math.min(newX, secondaryEnd));

          playhead.style.left = `${newX}px`;
          const timeMs = pxToMs(newX, pxPerMs);
          const markerX = newX - scrollContainer.scrollLeft;
          updateTooltip(markerX, `Playhead: ${formatDurationDisplay(timeMs)}`);
        }
      });
    };

    const onUp = (upEvent: PointerEvent) => {
      isDragging = false;
      draggingPlayheadRef.current = false;
      stopAutoScroll();
      setShowTooltip(false);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      (upEvent.target as HTMLElement).releasePointerCapture(e.pointerId);

      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const clearTrim = () => {
    clearTrimData();

    const defaultState: HistoryState = {
      trimStart: null,
      trimEnd: null,
      action: "init",
      secondaryDurationMs,
      accumulatedOffset: 0,
    };

    setEditHistory([defaultState]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
    setTrimStart(null);
    setTrimEnd(null);

    renderPrimaryStrip.current = true;
    applyHistoryState(defaultState, true);
    saveHistoryToStorage([defaultState]);
  };

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
                variant="outline"
                disabled={!canClearTrim}
                onClick={clearTrim}
              >
                <RotateCcw size={14} className="mr-1" />
                Clear Trim
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {canClearTrim
                  ? "Clear all trim data and reset to original video length"
                  : "No trim data to clear"}
              </p>
            </TooltipContent>
          </Tooltip>
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
            <HitArea
              variant="x"
              onPointerDown={onPlayheadPointerDown}
              style={{
                touchAction: "none",
              }}
            >
              <div className="relative h-full">
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-primary" />
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 bg-primary rotate-45" />
              </div>
            </HitArea>
          </div>

          {visualMarkers
            .filter((m) => m.isInView)
            .map((marker, index) => (
              <div
                key={`marker-${index}-${marker.time}`}
                className="absolute top-0 bottom-0 z-5"
                style={{ left: `${msToPx(marker.time, pxPerMs)}px` }}
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

                  <TooltipContent
                    side="top"
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm md:text-[0.8rem]">
                      Marker at{" "}
                      {msToSeconds(
                        marker.time -
                          currentOffsetRef.current +
                          currentAccumulatedOffset
                      ).toFixed(1)}
                      s (original)
                    </span>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="size-4"
                      onClick={() => {
                        const absoluteTime =
                          marker.time -
                          currentOffsetRef.current +
                          currentAccumulatedOffset;
                        if (trimStart === absoluteTime) setTrimStart(null);
                        if (trimEnd === absoluteTime) setTrimEnd(null);
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
              onPointerDown={onSecondaryPointerDown}
              className={cn(
                "absolute top-0 h-full rounded-md border border-default overflow-hidden",
                "shadow-inner cursor-grab active:cursor-grabbing focus:outline-none focus-visible:border-2 focus-visible:border-primary"
              )}
              style={{
                touchAction: "none",
              }}
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

              {trimStart !== null &&
                trimEnd !== null &&
                (() => {
                  const relativeStart = trimStart - currentAccumulatedOffset;
                  const relativeEnd = trimEnd - currentAccumulatedOffset;

                  const isVisible =
                    relativeEnd >= 0 &&
                    relativeStart <= currentSecondaryDurationMs;

                  if (!isVisible) return null;

                  const clampedStart = Math.max(0, relativeStart);
                  const clampedEnd = Math.min(
                    currentSecondaryDurationMs,
                    relativeEnd
                  );

                  return (
                    <div
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: `${msToPx(clampedStart, pxPerMs)}px`,
                        width: `${Math.max(
                          0,
                          msToPx(clampedEnd - clampedStart, pxPerMs)
                        )}px`,
                      }}
                    >
                      <div className="absolute inset-0 bg-primary/15 border-2 border-primary" />
                    </div>
                  );
                })()}
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

interface GetHistoryStateResult {
  history: HistoryState[];
  index: number;
  trimStart: number | null;
  trimEnd: number | null;
}

function getHistoryState(
  id: string | undefined,
  secondaryDurationMs: number
): GetHistoryStateResult {
  const fallbackState: GetHistoryStateResult = {
    history: [
      {
        trimStart: null,
        trimEnd: null,
        action: "init",
        secondaryDurationMs,
        accumulatedOffset: 0,
        trackOffset: 0,
      },
    ],
    index: 0,
    trimStart: null,
    trimEnd: null,
  };

  if (!id || typeof window === "undefined") return fallbackState;

  try {
    const key = getStorageKey(`${id}:dual-video-history`);
    const saved = localStorage.getItem(key);
    if (!saved) return fallbackState;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallbackState;

    const normalizedHistory = parsed.map((item) => ({
      ...item,
      trackOffset: item.trackOffset ?? 0,
    }));

    const last = normalizedHistory.at(-1);
    return {
      history: normalizedHistory,
      index: normalizedHistory.length - 1,
      trimStart: last?.trimStart ?? null,
      trimEnd: last?.trimEnd ?? null,
    };
  } catch {
    return fallbackState;
  }
}
