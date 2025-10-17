"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, Repeat } from "lucide-react";
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
import { Seek } from "./video-seek-bar";
import { ClipContext } from "@/contexts/clip-context";
import { useShallowSelector } from "react-shallow-store";
import { getPlayingState } from "@/hooks/app/use-video-controls-core";

interface PlaybackContextValue {
  isPlaying: boolean;
  hovered: boolean;
  // Accessibility IDs
  playToggleId: string;
  loopToggleId: string;
  rateControlId: string;
  controlsRegionId: string;
}

const PlaybackContext = React.createContext<PlaybackContextValue | null>(null);

export function usePlayback() {
  const context = React.useContext(PlaybackContext);
  if (!context) {
    throw new Error("usePlayback must be used within <Playback.Root>");
  }
  return context;
}

interface PlaybackRootProps {
  children: React.ReactNode;
  isPlaying: boolean;
}

const PlaybackRoot = React.forwardRef<HTMLDivElement, PlaybackRootProps>(
  ({ children, isPlaying, ...props }, _) => {
    const [hovered, setHovered] = React.useState(false);

    const playToggleId = React.useId();
    const loopToggleId = React.useId();
    const rateControlId = React.useId();
    const controlsRegionId = React.useId();

    const handleMouseEnter = React.useCallback(() => setHovered(true), []);
    const handleMouseLeave = React.useCallback(() => setHovered(false), []);

    const contextValue = React.useMemo(
      () => ({
        isPlaying,
        hovered,
        playToggleId,
        loopToggleId,
        rateControlId,
        controlsRegionId,
      }),
      [
        isPlaying,
        hovered,
        playToggleId,
        loopToggleId,
        rateControlId,
        controlsRegionId,
      ]
    );

    return (
      <PlaybackContext.Provider value={contextValue}>
        <div
          className="absolute inset-0 pointer-events-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          role="region"
          aria-label="Video player"
          {...props}
        >
          {children}
        </div>
      </PlaybackContext.Provider>
    );
  }
);
PlaybackRoot.displayName = "PlaybackRoot";

interface PlaybackControlsProps extends React.HTMLAttributes<HTMLDivElement> {}

const PlaybackControls = React.forwardRef<
  HTMLDivElement,
  PlaybackControlsProps
>(({ className, children, ...props }, ref) => {
  const { isPlaying, hovered, controlsRegionId } = usePlayback();

  if (isPlaying && !hovered) return null;

  return (
    <div
      ref={ref}
      id={controlsRegionId}
      role="group"
      aria-label="Video controls"
      className={cn(
        "flex items-center gap-2 border-none",
        "absolute bottom-2 pointer-events-auto px-8 py-1 left-1/2 -translate-x-1/2 w-full",
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
    const { playToggleId } = usePlayback();

    const [playing, setPlaying] = useControllableStateWithCallback({
      defaultValue: defaultPlaying,
      controlled: controlledPlaying,
      onChange: onPlayingChange,
      onValueChangeAlways: onPlayingChangeAlways,
    });

    const togglePlay = React.useCallback(() => {
      setPlaying((prev) => !prev);
    }, [setPlaying]);

    // (Space/K to toggle play)
    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === " " || e.key === "k" || e.key === "K") {
          e.preventDefault();
          togglePlay();
        }
      },
      [togglePlay]
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            id={playToggleId}
            onClick={togglePlay}
            onKeyDown={handleKeyDown}
            size="icon"
            variant="glass"
            className={cn("pointer-events-auto", className)}
            aria-label={playing ? "Pause video" : "Play video"}
            aria-pressed={playing}
            type="button"
            {...props}
          >
            {playing ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="!glass" role="tooltip">
          {playing ? "Pause (k)" : "Play (k)"}
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
    const { loopToggleId } = usePlayback();

    const [loop, setLoop] = useControllableStateWithCallback({
      defaultValue: defaultLoop,
      controlled: controlledLoop,
      onChange: onLoopChange,
      onValueChangeAlways: onLoopChangeAlways,
    });

    const toggleLoop = React.useCallback(() => {
      setLoop((prev) => !prev);
    }, [setLoop]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggleLoop();
        }
      },
      [toggleLoop]
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            id={loopToggleId}
            size="icon"
            variant="glass"
            aria-pressed={loop}
            aria-label={loop ? "Disable loop playback" : "Enable loop playback"}
            onClick={toggleLoop}
            onKeyDown={handleKeyDown}
            className={cn("pointer-events-auto", className)}
            type="button"
            {...props}
          >
            <Repeat
              className={cn("size-4", loop && "text-primary")}
              aria-hidden="true"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="glass" role="tooltip">
          {loop ? "Loop enabled" : "Loop disabled"}
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
    const { rateControlId } = usePlayback();

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

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent) => {
        if (!open) return;

        const currentIndex = rates.indexOf(rate);

        switch (e.key) {
          case "ArrowUp":
          case "ArrowLeft":
            e.preventDefault();
            if (currentIndex > 0) {
              handleSelect(rates[currentIndex - 1]);
            }
            break;
          case "ArrowDown":
          case "ArrowRight":
            e.preventDefault();
            if (currentIndex < rates.length - 1) {
              handleSelect(rates[currentIndex + 1]);
            }
            break;
          case "Home":
            e.preventDefault();
            handleSelect(rates[0]);
            break;
          case "End":
            e.preventDefault();
            handleSelect(rates[rates.length - 1]);
            break;
          case "Escape":
            e.preventDefault();
            setOpen(false);
            break;
        }
      },
      [open, rate, rates, handleSelect]
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
              "text-xs pointer-events-auto",
              r === rate && "bg-white/20 text-white border-2"
            )}
            aria-label={`Playback speed ${r}x`}
            role="menuitemradio"
            aria-checked={r === rate}
            type="button"
          >
            {r}x
          </Button>
        )),
      [rates, rate, handleSelect]
    );

    return (
      <div
        ref={ref}
        id={rateControlId}
        className={cn(
          "relative flex items-center select-none pointer-events-auto",
          className
        )}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              className="h-8 w-fit pointer-events-auto"
              variant="glass"
              aria-label={`Playback speed: ${rate}x. Click to change speed`}
              aria-haspopup="menu"
              aria-expanded={open}
              type="button"
            >
              {rate}x
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            className="!glass w-fit py-2 px-1 flex flex-col justify-center gap-1 pointer-events-auto"
            role="menu"
            aria-label="Playback speed options"
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
  ({ children }, _) => {
    return <>{children}</>;
  }
);

PlaybackVolume.displayName = "PlaybackVolume";

interface PlaybackSeekProps
  extends Partial<React.ComponentProps<typeof Seek.Root>> {
  playerActive?: "primary" | "secondary";
}

const PlaybackSeek = React.forwardRef<HTMLDivElement, PlaybackSeekProps>(
  ({ playerActive, ...props }, _) => {
    const {
      primaryTrim,
      getVideoRef,
      primaryStatus,
      primaryBuffered,
      secondaryStatus,
      secondaryBuffered,
      primaryControls,
      secondaryControls,
    } = useShallowSelector(ClipContext, (state) => ({
      primaryTrim: state.primaryTrim,
      getVideoRef: state.getVideoRef,
      primaryStatus: state.primaryStatus,
      primaryBuffered: state.primaryBuffered,
      primaryControls: state.primaryControls,
      secondaryStatus: state.secondaryStatus,
      secondaryBuffered: state.secondaryBuffered,
      secondaryControls: state.secondaryControls,
    }));

    const effectivePlayer = playerActive ?? "primary";

    const activeVideoRef = React.useMemo(() => {
      if (props.primaryVideoRef) return props.primaryVideoRef;
      return getVideoRef(effectivePlayer);
    }, [props.primaryVideoRef, getVideoRef, effectivePlayer]);

    const activeTrim = React.useMemo(() => {
      if (props.primaryTrim) return props.primaryTrim;
      return primaryTrim;
    }, [props.primaryTrim, primaryTrim]);

    const { status, buffered } = React.useMemo(() => {
      if (effectivePlayer === "primary") {
        return {
          status:
            props.isPlaying !== undefined
              ? { isPlaying: props.isPlaying }
              : { isPlaying: getPlayingState(primaryStatus).isPlaying },
          buffered: props.primaryBuffered ?? primaryBuffered,
        };
      }

      return {
        status:
          props.isPlaying !== undefined
            ? { isPlaying: props.isPlaying }
            : { isPlaying: getPlayingState(secondaryStatus).isPlaying },
        buffered: props.primaryBuffered ?? secondaryBuffered,
      };
    }, [
      effectivePlayer,
      props.isPlaying,
      props.primaryBuffered,
      primaryStatus,
      primaryBuffered,
      secondaryStatus,
      secondaryBuffered,
    ]);

    const isPlaying = props.isPlaying ?? status.isPlaying;

    const handleSeek = React.useCallback(
      (normalizedTimeMs: number) => {
        if (props.onSeek) {
          props.onSeek(normalizedTimeMs);
        } else {
          const controls =
            effectivePlayer === "primary" ? primaryControls : secondaryControls;
          if (controls?.seek) {
            controls.seek(normalizedTimeMs / 1000);
          }
        }
      },
      [props.onSeek, effectivePlayer, primaryControls, secondaryControls]
    );

    return (
      <Seek.Root
        primaryVideoRef={activeVideoRef}
        secondaryVideoRef={props.secondaryVideoRef ?? undefined}
        primaryTrim={activeTrim}
        secondaryTrim={props.secondaryTrim ?? null}
        isPlaying={isPlaying}
        onSeek={handleSeek}
        primaryBuffered={buffered}
        secondaryBuffered={props.secondaryBuffered ?? null}
      >
        <Seek.Content>
          {/* This is absolute to the Playback.Content */}
          <Seek.Track className="absolute bottom-0 -translate-y-full max-w-[100%] left-2/4 -translate-x-2/4">
            <Seek.Buffer />
            <Seek.Progress />
            <Seek.Thumb />
          </Seek.Track>
          <Seek.TimeDisplay className="ml-3" />
          <Seek.Animator />
        </Seek.Content>
      </Seek.Root>
    );
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
  Seek: PlaybackSeek,
};
