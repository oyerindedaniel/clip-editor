"use client";

import * as React from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  content: string;
  className?: React.HTMLAttributes<HTMLDivElement>["className"];
  iconClassName?: React.SVGProps<SVGSVGElement>["className"];
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  disabled?: boolean;
}

export function InfoTooltip({
  content,
  className,
  iconClassName,
  side = "top",
  align = "center",
  disabled = false,
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
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-1",
            className
          )}
          aria-label="More information"
        >
          <Info size={12} className={iconClassName} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className="max-w-xs">
        <p className="text-xs leading-relaxed">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default InfoTooltip;
