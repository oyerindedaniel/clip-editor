"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useComposedRefs } from "@/hooks/use-composed-refs";

export const TOOLTIP_OFFSET_Y = 28;

interface TimelineTooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  visible: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
}

const TimelineTooltip = React.forwardRef<HTMLDivElement, TimelineTooltipProps>(
  ({ containerRef, visible, className, style, ...props }, forwardedRef) => {
    const tooltipRef = React.useRef<HTMLDivElement>(null);
    const composedRefs = useComposedRefs(forwardedRef, tooltipRef);

    React.useLayoutEffect(() => {
      const tooltip = tooltipRef.current;
      const container = containerRef?.current;
      if (!tooltip || !container || !visible) return;

      const rect = container.getBoundingClientRect();
      tooltip.style.position = "absolute";
      tooltip.style.top = `${rect.top - TOOLTIP_OFFSET_Y}px`;
      tooltip.style.left = `${rect.left}px`;
      tooltip.style.willChange = "transform";
    }, [containerRef, visible]);

    if (!visible) return null;

    return (
      <div
        ref={composedRefs}
        className={cn(
          "absolute z-50 pointer-events-none will-change-transform",
          className
        )}
        style={style}
        {...props}
      />
    );
  }
);

TimelineTooltip.displayName = "TimelineTooltip";

export { TimelineTooltip };
