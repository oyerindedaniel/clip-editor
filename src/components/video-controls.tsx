"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Play, Pause } from "lucide-react";

interface VideoControlsProps extends React.HTMLAttributes<HTMLDivElement> {
  playing: boolean;
  onToggle: () => void;
  triggerClassName?: string;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  playing,
  onToggle,
  className,
  triggerClassName,
}) => {
  return (
    <div className={cn("relative", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            onClick={onToggle}
            className={cn(
              "h-8 w-8 bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white transition-all duration-200 hover:scale-105 shadow-sm",
              triggerClassName
            )}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-surface-primary border-surface-tertiary text-foreground-default font-medium"
        >
          {playing ? "Pause" : "Play"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default VideoControls;
