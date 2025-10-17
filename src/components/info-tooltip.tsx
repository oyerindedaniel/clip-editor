"use client";

import * as React from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps
  extends Omit<React.ComponentProps<typeof TooltipContent>, "content"> {
  content: React.ReactNode;
  disabled?: boolean;
  iconSize?: number;
  triggerClassName?: string;
}

export function InfoTooltip({
  content,
  side = "top",
  align = "center",
  disabled = false,
  iconSize = 12,
  triggerClassName,
  className,
  ...props
}: InfoTooltipProps) {
  if (disabled) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-2xl border",
            "w-5 h-5 bg-surface-tertiary border-subtle",
            "text-foreground-muted hover:text-foreground-default hover:bg-surface-hover",
            "transition-colors duration-200 ease-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary",
            triggerClassName
          )}
          aria-label="More information"
        >
          <Info size={iconSize} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        {...props}
        className={cn(
          "max-w-xs text-center rounded-3xl",
          "bg-surface-secondary text-foreground-default",
          "border border-subtle shadow-lg px-3 py-1.5",
          className
        )}
      >
        <div className="text-[11px] leading-relaxed tracking-tight">
          {content}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default InfoTooltip;
