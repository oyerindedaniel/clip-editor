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
import { useControllableStateWithCallback } from "@/hooks/use-controllable-state-with-callback";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import VideoPreview from "./video-preview";
import { VideoSeekBar } from "./video-seek-bar";

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
      className={cn(
        "flex items-center gap-2 glass border-none",
        "absolute bottom-0 px-8 py-1 left-1/2 -translate-x-1/2 w-full",
        className
      )}
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
  onPlayingChangeAlways?: (playing: boolean) => void;
}

const PlayToggle = React.forwardRef<HTMLButtonElement, PlayToggleProps>(
  (
    {
      defaultPlaying = false,
      playing: controlledPlaying,
      onPlayingChange,
      onPlayingChangeAlways,
      className,
      ...props
    },
    ref
  ) => {
    const [playing, setPlaying] = useControllableStateWithCallback({
      defaultValue: defaultPlaying,
      controlled: controlledPlaying,
      onChange: onPlayingChange,
      onValueChangeAlways: onPlayingChangeAlways,
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
  onLoopChangeAlways?: (loop: boolean) => void;
}

const LoopToggle = React.forwardRef<HTMLButtonElement, LoopToggleProps>(
  (
    {
      defaultLoop = false,
      loop: controlledLoop,
      onLoopChange,
      onLoopChangeAlways,
      className,
      ...props
    },
    ref
  ) => {
    const [loop, setLoop] = useControllableStateWithCallback({
      defaultValue: defaultLoop,
      controlled: controlledLoop,
      onChange: onLoopChange,
      onValueChangeAlways: onLoopChangeAlways,
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
  onRateChangeAlways?: (rate: number) => void;
  rates?: number[];
}

const RateControl = React.forwardRef<HTMLDivElement, RateControlProps>(
  (
    {
      defaultRate = 1,
      rate: controlledRate,
      onRateChange,
      onRateChangeAlways,
      rates = [0.5, 1, 1.25, 1.5, 2],
      className,
      ...props
    },
    ref
  ) => {
    const [rate, setRate] = useControllableStateWithCallback({
      defaultValue: defaultRate,
      controlled: controlledRate,
      onChange: onRateChange,
      onValueChangeAlways: onRateChangeAlways,
    });

    const [open, setOpen] = React.useState(false);

    const handleSelect = React.useCallback(
      (r: number) => {
        setRate(r);
        setOpen(false);
      },
      [setRate]
    );

    const rateButtons = React.useMemo(
      () =>
        rates.map((r) => (
          <Button
            key={r}
            size="icon"
            variant="glass"
            onClick={() => handleSelect(r)}
            className={cn(
              "text-xs",
              r === rate && "bg-white/20 text-white border-2"
            )}
          >
            {r}
          </Button>
        )),
      [rates, rate, handleSelect]
    );

    return (
      <div
        ref={ref}
        className={cn("relative flex items-center select-none", className)}
        {...props}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button className="h-8 w-fit" variant="glass">
              {rate}x
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            className="!glass w-fit py-2 px-1 flex flex-col justify-center gap-1"
          >
            {rateButtons}
          </PopoverContent>
        </Popover>
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

interface PlaybackSeekProps extends React.ComponentProps<typeof VideoSeekBar> {}

const PlaybackSeek = React.forwardRef<HTMLDivElement, PlaybackSeekProps>(
  (props, ref) => {
    return <VideoSeekBar {...props} />;
  }
);

PlaybackSeek.displayName = "PlaybackSeek";

export const Playback = {
  Root: PlaybackRoot,
  Controls: PlaybackControls,
  PlayToggle,
  LoopToggle,
  RateControl,
  Volume: PlaybackVolume,
};
