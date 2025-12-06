import React, { useCallback, useRef } from "react";
import { TOOLTIP_OFFSET_Y } from "@/components/timeline-tooltip";

interface UseTimelineTooltipOptions {
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  edgeThreshold?: number;
  offsetY?: number;
}

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

export function useTimelineTooltip({
  tooltipRef,
  scrollContainerRef,
  edgeThreshold = 50,
  offsetY = TOOLTIP_OFFSET_Y,
}: UseTimelineTooltipOptions) {
  const lastTooltipState = useRef<TooltipState>({
    x: 0,
    y: 0,
    text: "",
  });

  const updateTooltip = useCallback(
    (markerX: number, displayText: string) => {
      const tooltip = tooltipRef.current;
      const scrollContainer = scrollContainerRef?.current;
      if (!tooltip || !scrollContainer) return;

      const rect = scrollContainer.getBoundingClientRect();
      const clampedX = Math.min(
        rect.width - edgeThreshold,
        Math.max(edgeThreshold, markerX)
      );

      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const tooltipWidth = tooltip.offsetWidth;
      const x = scrollX + rect.left + clampedX - tooltipWidth / 2;
      const y = scrollY + rect.top - offsetY;

      tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      tooltip.textContent = displayText;

      lastTooltipState.current = { x, y, text: displayText };
    },
    [tooltipRef, scrollContainerRef, edgeThreshold, offsetY]
  );

  return {
    updateTooltip,
    lastTooltipState: lastTooltipState.current,
  };
}
