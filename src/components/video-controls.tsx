"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, Repeat, Zap } from "lucide-react";
import { Volume } from "@/components/volume";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useControllableState } from "@/hooks/use-controllable-state";

interface PlaybackRootProps {
  children: React.ReactNode;
}

const PlaybackRoot = React.forwardRef<HTMLDivElement, PlaybackRootProps>(
  ({ children, ...props }, ref) => {
    return (
      <div ref={ref} {...props}>
        {children}
      </div>
    );
  }
);
PlaybackRoot.displayName = "PlaybackRoot";

interface PlaybackControlsProps extends React.HTMLAttributes<HTMLDivElement> {}

const PlaybackControls = React.forwardRef<
  HTMLDivElement,
  PlaybackControlsProps
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
});

PlaybackControls.displayName = "PlaybackControls";

interface PlayToggleProps extends React.ComponentPropsWithoutRef<"button"> {
  defaultPlaying?: boolean;
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;
}

const PlayToggle = React.forwardRef<HTMLButtonElement, PlayToggleProps>(
  (
    {
      defaultPlaying = false,
      playing: controlledPlaying,
      onPlayingChange,
      className,
      ...props
    },
    ref
  ) => {
    const [playing, setPlaying] = useControllableState({
      defaultValue: defaultPlaying,
      controlled: controlledPlaying,
      onChange: onPlayingChange,
    });

    const togglePlay = React.useCallback(() => {
      setPlaying((prev) => !prev);
    }, [setPlaying]);

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            onClick={togglePlay}
            size="icon"
            variant="glass"
            className={className}
            aria-label={playing ? "Pause" : "Play"}
            {...props}
          >
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
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
    );
  }
);
PlayToggle.displayName = "PlayToggle";

interface LoopToggleProps extends React.ComponentPropsWithoutRef<"button"> {
  defaultLoop?: boolean;
  loop?: boolean;
  onLoopChange?: (loop: boolean) => void;
}

const LoopToggle = React.forwardRef<HTMLButtonElement, LoopToggleProps>(
  (
    {
      defaultLoop = false,
      loop: controlledLoop,
      onLoopChange,
      className,
      ...props
    },
    ref
  ) => {
    const [loop, setLoop] = useControllableState({
      defaultValue: defaultLoop,
      controlled: controlledLoop,
      onChange: onLoopChange,
    });

    const toggleLoop = React.useCallback(() => {
      setLoop((prev) => !prev);
    }, [setLoop]);

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            size="icon"
            variant="glass"
            aria-pressed={loop}
            aria-label={loop ? "Disable loop" : "Enable loop"}
            onClick={toggleLoop}
            className={className}
            {...props}
          >
            <Repeat className={cn("size-4", loop && "text-primary")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-surface-primary border-surface-tertiary text-foreground-default font-medium"
        >
          {loop ? "Loop on" : "Loop off"}
        </TooltipContent>
      </Tooltip>
    );
  }
);
LoopToggle.displayName = "LoopToggle";

interface RateControlProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "onRateChange"> {
  defaultRate?: number;
  rate?: number;
  onRateChange?: (rate: number) => void;
  rates?: number[];
  orientation?: "horizontal" | "vertical";
}

const RateControl = React.forwardRef<HTMLDivElement, RateControlProps>(
  (
    {
      defaultRate = 1,
      rate: controlledRate,
      onRateChange,
      rates = [0.5, 1, 1.25, 1.5, 2],
      orientation = "horizontal",
      className,
      ...props
    },
    ref
  ) => {
    const [rate, setRate] = useControllableState({
      defaultValue: defaultRate,
      controlled: controlledRate,
      onChange: onRateChange,
    });

    const [hover, setHover] = React.useState(false);

    return (
      <div
        ref={ref}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          "relative flex items-center",
          orientation === "horizontal" ? "flex-row" : "flex-col",
          className
        )}
        {...props}
      >
        <div className="relative overflow-hidden">
          <div
            className={cn(
              "absolute inset-0 transition-[clip-path,opacity] duration-250 ease-in-out",
              hover
                ? orientation === "horizontal"
                  ? "[clip-path:inset(0_0_0_0)] opacity-100"
                  : "[clip-path:inset(0_0_0_0)] opacity-100"
                : orientation === "horizontal"
                ? "[clip-path:inset(0_100%_0_0)] opacity-0"
                : "[clip-path:inset(100%_0_0_0)] opacity-0"
            )}
          >
            <div
              className={cn(
                "flex gap-1",
                orientation === "horizontal" ? "flex-row" : "flex-col"
              )}
            >
              {rates.map((r) => (
                <Button
                  key={r}
                  size="icon"
                  className={cn(
                    "text-white/80 hover:text-white",
                    r === rate && "bg-white/20 text-white"
                  )}
                  onClick={() => setRate(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>
          <Button
            size="icon"
            variant="glass"
            className="relative z-10"
            onClick={() => setHover((h) => !h)}
          >
            <Zap className="size-4" />
          </Button>
        </div>
      </div>
    );
  }
);
RateControl.displayName = "RateControl";

interface PlaybackVolumeProps
  extends React.ComponentProps<typeof Volume.Root> {}

const PlaybackVolume = React.forwardRef<HTMLDivElement, PlaybackVolumeProps>(
  ({ children }, ref) => {
    return <>{children}</>;
  }
);

PlaybackVolume.displayName = "PlaybackVolume";

export const Playback = {
  Root: PlaybackRoot,
  Controls: PlaybackControls,
  PlayToggle,
  LoopToggle,
  RateControl,
  Volume: PlaybackVolume,
};
