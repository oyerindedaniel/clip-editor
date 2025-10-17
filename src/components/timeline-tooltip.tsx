"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { createPortal } from "react-dom";

export const TOOLTIP_OFFSET_Y = 32;

interface TimelineTooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  tooltipState: {
    x: number;
    y: number;
    text: string;
  };
  visible: boolean;
  container?: HTMLDivElement | null;
}

const TimelineTooltip = React.forwardRef<HTMLDivElement, TimelineTooltipProps>(
  ({ container, visible, tooltipState, className, ...props }, forwardedRef) => {
    const tooltipRef = React.useRef<HTMLDivElement>(null);
    const composedRefs = useComposedRefs(forwardedRef, tooltipRef);

    React.useLayoutEffect(() => {
      const tooltip = tooltipRef.current;
      if (!tooltip || !container || !visible) return;

      const { x, y, text } = tooltipState;
      tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      tooltip.textContent = text;
    }, [visible, container]);

    if (!visible) return null;

    return createPortal(
      <div
        ref={composedRefs}
        className={cn(
          "absolute left-0 top-0 z-50 pointer-events-none will-change-transform",
          "bg-surface-secondary text-primary px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium whitespace-nowrap",
          className
        )}
        {...props}
      />,

      document.body
    );
  }
);

TimelineTooltip.displayName = "TimelineTooltip";

export { TimelineTooltip };
