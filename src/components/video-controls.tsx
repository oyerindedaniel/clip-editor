"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, Repeat, Loader2, AlertTriangle } from "lucide-react";
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
import { type PlayingStatus } from "@/hooks/app/use-video-controls-core";

interface PlaybackContextValue {
  hovered: boolean;

  playing: boolean;
  setPlaying: (next: boolean | ((prev: boolean) => boolean)) => void;
  togglePlay: () => void;

  // Accessibility IDs
  playToggleId: string;
  loopToggleId: string;
  rateControlId: string;
  controlsId: string;
  videoPlayerId?: string;
  controlledControlsId?: string;

  showFeedback: boolean;
  triggerFeedback: () => void;
  feedbackKey: number;

  isBuffering: boolean;
  hasError: boolean;

  isDual: boolean;
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
  defaultPlaying?: boolean;
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onPlayingChangeAlways?: (playing: boolean) => void;
  playingStatus?: PlayingStatus;

  videoPlayerId?: string;
  controlsId?: string;

  isBuffering: boolean;
  hasError: boolean;

  isDual?: boolean;
}

const PlaybackRoot = React.forwardRef<HTMLDivElement, PlaybackRootProps>(
  (
    {
      children,
      defaultPlaying,
      playing: controlledPlaying,
      onPlayingChange,
      onPlayingChangeAlways,
      playingStatus = "idle",
      videoPlayerId,
      controlsId: controlledControlsId,
      isBuffering = false,
      hasError = false,
      isDual = false,
      ...props
    },
    _
  ) => {
    const [playing, setPlaying] = useControllableStateWithCallback({
      defaultValue: defaultPlaying ?? false,
      controlled: controlledPlaying,
      onChange: onPlayingChange,
      onValueChangeAlways: onPlayingChangeAlways,
    });

    const [hovered, setHovered] = React.useState(false);

    const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null);

    const [showFeedback, setShowFeedback] = React.useState<boolean>(false);
    const [feedbackKey, setFeedbackKey] = React.useState(0);

    const playToggleId = React.useId();
    const loopToggleId = React.useId();
    const rateControlId = React.useId();
    const controlsId = React.useId();

    const togglePlay = React.useCallback(() => {
      setPlaying((prev) => !prev);
    }, [setPlaying]);

    const triggerFeedback = React.useCallback(() => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      togglePlay();

      setFeedbackKey((prev) => prev + 1);
      setShowFeedback(true);

      timeoutRef.current = setTimeout(() => {
        setShowFeedback(false);
        timeoutRef.current = null;
      }, 5000);
    }, [togglePlay]);

    const handleMouseEnter = React.useCallback(() => setHovered(true), []);
    const handleMouseLeave = React.useCallback(() => setHovered(false), []);

    React.useEffect(() => {
      if (playingStatus !== "playing") {
        setPlaying(false);
      }
    }, [playingStatus]);

    const contextValue = React.useMemo(
      () => ({
        playing,
        setPlaying,
        togglePlay,
        hovered,
        playToggleId,
        loopToggleId,
        rateControlId,
        controlledControlsId,
        showFeedback,
        triggerFeedback,
        feedbackKey,
        videoPlayerId,
        controlsId,
        isBuffering,
        hasError,
        isDual,
      }),
      [
        playing,
        setPlaying,
        togglePlay,
        hovered,
        playToggleId,
        loopToggleId,
        rateControlId,
        controlledControlsId,
        showFeedback,
        triggerFeedback,
        feedbackKey,
        videoPlayerId,
        controlsId,
        isBuffering,
        hasError,
      ]
    );

    return (
      <PlaybackContext.Provider value={contextValue}>
        <div
          className={cn(
            "absolute inset-0 z-10 bg-transparent pointer-events-auto"
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={triggerFeedback}
          {...props}
        >
          <PlaybackBuffer />
          <PlaybackError />
          <PlaybackFeedbackOverlay />
          {children}
        </div>
      </PlaybackContext.Provider>
    );
  }
);
PlaybackRoot.displayName = "PlaybackRoot";

const PlaybackBuffer = () => {
  const { isBuffering, playing, isDual } = usePlayback();

  if (isDual ? !isBuffering : !(isBuffering && playing)) return null;

  return (
    <Loader2 className="h-12 w-12 animate-spin absolute top-1/2 left-2/4 -translate-y-1/2 -translate-x-2/4 z-10 text-white fill-white/10" />
  );
};

const PlaybackError = () => {
  const { hasError } = usePlayback();

  if (!hasError) return null;

  return (
    <div className="absolute inset-0 bg-black/80 text-white backdrop-blur-sm flex items-center justify-center z-10">
      <div className="text-center text-foreground-default p-4 flex flex-col items-center gap-2 w-[85%]">
        <AlertTriangle className="size-12 text-error mb-px" />
        <div className="text-base font-semibold tracking-tight">
          Video failed to load
        </div>
      </div>
    </div>
  );
};

const PlaybackFeedbackOverlay = () => {
  const { showFeedback, feedbackKey, playing } = usePlayback();

  const icon = React.useMemo(() => {
    return playing ? (
      <Play className="size-12 text-white" />
    ) : (
      <Pause className="size-12 text-white" />
    );
  }, [playing]);

  if (!showFeedback) return null;

  return (
    <div
      key={feedbackKey} // Forces remount on trigger to restart animation
      className="glass absolute left-1/2 top-1/2 -translate-1/2 rounded-full p-6 flex items-center justify-center animate-scale-fade"
    >
      {icon}
    </div>
  );
};

interface PlaybackControlsProps extends React.HTMLAttributes<HTMLDivElement> {}

const PlaybackControls = React.forwardRef<
  HTMLDivElement,
  PlaybackControlsProps
>(({ className, children, ...props }, ref) => {
  const { playing, hovered, controlledControlsId, controlsId, videoPlayerId } =
    usePlayback();

  const visible = !playing || hovered;
  const _controlsId = controlledControlsId || controlsId;

  return (
    <div
      ref={ref}
      id={_controlsId}
      role="group"
      aria-label="Video controls"
      aria-controls={videoPlayerId}
      onClick={(e) => {
        e.stopPropagation();
      }}
      data-state={visible ? "visible" : "hidden"}
      className={cn(
        "flex items-center gap-2 border-none z-20",
        "absolute bottom-0 pointer-events-auto px-8 pb-3 pt-3.5 left-1/2 -translate-x-1/2 w-full",
        "transition-opacity duration-300 ease-in-out",
        "data-[state=visible]:opacity-100 data-[state=hidden]:opacity-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

PlaybackControls.displayName = "PlaybackControls";

interface PlayToggleProps extends React.ComponentPropsWithoutRef<"button"> {}

const PlayToggle = React.forwardRef<HTMLButtonElement, PlayToggleProps>(
  ({ className, ...props }, ref) => {
    const { playing, togglePlay, playToggleId } = usePlayback();

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
          {playing ? "Pause (Space)" : "Play (Space)"}
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
              "pointer-events-auto",
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
  extends Omit<React.ComponentProps<typeof Seek.Root>, "children"> {}

const PlaybackSeek = React.forwardRef<HTMLDivElement, PlaybackSeekProps>(
  (props, _) => {
    return (
      <Seek.Root {...props}>
        <Seek.Content className="flex items-center w-fit mx-auto">
          {/* This is absolute to the Playback.Controls */}
          <Seek.Track className="-translate-y-full absolute top-0 w-[95%] left-1/2 -translate-x-1/2">
            <Seek.Buffer />
            <Seek.Progress />
            <Seek.Thumb />
          </Seek.Track>
          <Seek.TimeDisplay className="absolute left-1/2 top-1/2 -translate-1/2" />
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
