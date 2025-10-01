"use client";

import * as React from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps extends React.ComponentProps<typeof TooltipContent> {
  content: string;
  disabled?: boolean;
}

export function InfoTooltip({
  content,
  side = "top",
  align = "center",
  disabled = false,
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
            "inline-flex items-center justify-center w-4 h-4 rounded-full",
            "text-foreground-subtle hover:text-foreground-default",
            "transition-colors duration-200 ease-in-out",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-1"
          )}
          aria-label="More information"
        >
          <Info size={12} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        {...props}
        className="max-w-xs text-center"
      >
        <p className="text-xs leading-relaxed">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default InfoTooltip;
