"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { VolumeX, Volume1, Volume2 } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useAnimatePresence } from "@/hooks/use-animate-presence";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { HitArea } from "./hit-area";

interface VolumeContextValue {
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  hovering: boolean;
  setHovering: (v: boolean) => void;
  min: number;
  max: number;
  step: number;
  orientation: "horizontal" | "vertical";
  thumbId?: string;
  setThumbId: (id: string) => void;
  trackRef: React.RefObject<HTMLDivElement | null>;
}

const VolumeContext = React.createContext<VolumeContextValue | null>(null);

function useVolumeContext(): VolumeContextValue {
  const ctx = React.useContext(VolumeContext);
  if (!ctx) {
    throw new Error("Volume components must be used within <Volume.Root>");
  }
  return ctx;
}

interface VolumeRootProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  orientation?: "horizontal" | "vertical";
  children: React.ReactNode;
}

function VolumeRoot({
  value: controlledValue,
  defaultValue = 1,
  onValueChange,
  min = 0,
  max = 1,
  step = 0.01,
  orientation = "horizontal",
  children,
}: VolumeRootProps) {
  const [thumbId, setThumbId] = React.useState<string | undefined>();
  const trackRef = React.useRef<HTMLDivElement>(null);

  const [volume, setVolume] = useControllableState<number>({
    controlled: controlledValue,
    defaultValue,
    onChange: onValueChange,
  });

  const [hovering, setHovering] = React.useState(false);
  const lastVolume = React.useRef(defaultValue);

  React.useEffect(() => {
    if (volume > min) {
      lastVolume.current = volume;
    }
  }, [volume, min]);

  const muted = volume === min;

  const toggleMute = React.useCallback(() => {
    if (muted) {
      setVolume(lastVolume.current);
    } else {
      setVolume(min);
    }
  }, [muted, min]);

  const ctx = React.useMemo(
    () => ({
      volume,
      setVolume,
      muted,
      toggleMute,
      hovering,
      setHovering,
      min,
      max,
      step,
      orientation,
      thumbId,
      setThumbId,
      trackRef,
    }),
    [
      volume,
      muted,
      hovering,
      min,
      max,
      step,
      orientation,
      toggleMute,
      setVolume,
      thumbId,
    ]
  );

  return (
    <VolumeContext.Provider value={ctx}>
      <div
        className="space-x-2 space-y-2"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {children}
      </div>
    </VolumeContext.Provider>
  );
}

interface VolumeLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  asChild?: boolean;
}

const VolumeLabel = React.forwardRef<HTMLLabelElement, VolumeLabelProps>(
  ({ asChild = false, className, ...props }, ref) => {
    const { thumbId, orientation } = useVolumeContext();
    const Comp = asChild ? Slot : "label";

    return (
      <Comp
        ref={ref}
        htmlFor={thumbId}
        className={cn(
          "text-sm font-medium text-foreground-subtle select-none inline-block",
          orientation === "horizontal" ? "mr-3" : "mb-3",
          className
        )}
        {...props}
      />
    );
  }
);
VolumeLabel.displayName = "VolumeLabel";

interface VolumeButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "children">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  children?:
    | ((props: { muted: boolean; volume: number }) => React.ReactNode)
    | React.ReactNode;
}

const VolumeButton = React.forwardRef<HTMLButtonElement, VolumeButtonProps>(
  (
    {
      asChild = false,
      children,
      onClick,
      variant = "ghost",
      size = "icon",
      ...props
    },
    ref
  ) => {
    const { muted, volume, toggleMute } = useVolumeContext();

    const Comp = asChild ? Slot : Button;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (onClick) {
        onClick(event);
        if (event.defaultPrevented) return;
      }
      toggleMute();
    };

    const renderDefaultIcon = () => {
      if (muted || volume === 0) return <VolumeX className="size-5" />;
      if (volume < 0.5) return <Volume1 className="size-5" />;
      return <Volume2 className="size-5" />;
    };

    return (
      <Comp
        ref={ref}
        variant={variant}
        size={size}
        onClick={handleClick}
        {...props}
      >
        {typeof children === "function"
          ? children({ muted, volume })
          : children ?? renderDefaultIcon()}
      </Comp>
    );
  }
);
VolumeButton.displayName = "VolumeButton";

type VolumeControlsVariant = "pill" | "soft" | "default";

interface VolumeControlsProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: VolumeControlsVariant;
}

const VolumeControls = React.forwardRef<HTMLDivElement, VolumeControlsProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex items-center gap-2 transition-[width] w-min",
          variant === "pill" &&
            "bg-surface-secondary/70 backdrop-blur-sm rounded-full px-1 py-0.5",
          variant === "soft" &&
            "bg-surface-secondary/50 backdrop-blur-sm rounded-md px-1.5 py-1",
          className
        )}
        {...props}
      />
    );
  }
);

VolumeControls.displayName = "VolumeControls";

interface VolumeSliderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const VolumeSlider = React.forwardRef<HTMLDivElement, VolumeSliderProps>(
  ({ children, ...props }, ref) => {
    const { hovering, orientation } = useVolumeContext();
    type AnimationState = "idle" | "entering" | "exiting";

    const sliderRef = React.useRef<HTMLDivElement>(null);
    const composedRefs = useComposedRefs(ref, sliderRef);

    const [animationState, setAnimationState] =
      React.useState<AnimationState>("idle");

    const handleAnimation = (presence: boolean) => {
      return new Promise<void>((resolve) => {
        const el = sliderRef.current!;

        if (presence) {
          setAnimationState("entering");
          resolve();
          return;
        }

        setAnimationState("exiting");

        const onEnd = () => {
          setAnimationState("idle");
          el.removeEventListener("animationend", onEnd);
          el.removeEventListener("transitionend", onEnd);
          resolve();
        };

        el.addEventListener("animationend", onEnd);
        el.addEventListener("transitionend", onEnd);
      });
    };

    const shouldRender = useAnimatePresence(hovering, handleAnimation, {
      initial: false,
    });

    if (!shouldRender) return null;

    const dataState =
      animationState === "entering"
        ? "open"
        : animationState === "exiting"
        ? "closed"
        : undefined;

    return (
      <div
        ref={composedRefs}
        role="presentation"
        data-state={dataState}
        className={cn(
          "flex items-center overflow-hidden",
          "transition-[width,height] duration-200",
          orientation === "horizontal"
            ? "w-0 h-4 data-[state=open]:w-24"
            : "h-0 w-4 flex-col data-[state=open]:h-24",
          "data-[state=open]:animate-volume-in",
          "data-[state=closed]:animate-volume-out"
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
VolumeSlider.displayName = "VolumeSlider";

interface VolumeSliderTrackProps extends React.HTMLAttributes<HTMLDivElement> {}

const VolumeSliderTrack = React.forwardRef<
  HTMLDivElement,
  VolumeSliderTrackProps
>(({ children, onMouseDown, ...props }, forwardedRef) => {
  const { setVolume, min, max, orientation, trackRef } = useVolumeContext();
  const ref = React.useRef<HTMLDivElement>(null);
  const composedRefs = useComposedRefs(forwardedRef, ref, trackRef);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (onMouseDown) {
      onMouseDown(event);
      if (event.defaultPrevented) return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio =
      orientation === "horizontal"
        ? (event.clientX - rect.left) / rect.width
        : 1 - (event.clientY - rect.top) / rect.height;

    const newValue = Math.min(Math.max(min + ratio * (max - min), min), max);
    setVolume(newValue);
  };

  return (
    <HitArea variant={orientation === "horizontal" ? "y" : "x"}>
      <div
        ref={composedRefs}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-orientation={orientation}
        className={cn(
          "relative bg-surface-tertiary rounded",
          orientation === "horizontal" ? "w-full h-1" : "h-full w-1"
        )}
        onMouseDown={handleMouseDown}
        {...props}
      >
        {children}
      </div>
    </HitArea>
  );
});
VolumeSliderTrack.displayName = "VolumeSliderTrack";

const VolumeSliderRange = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { volume, min, max, orientation } = useVolumeContext();
  const percent = (volume - min) / (max - min);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute bg-primary rounded inset-0",
        orientation === "horizontal" ? "origin-left" : "origin-bottom",
        className
      )}
      style={{
        transform:
          orientation === "horizontal"
            ? `scaleX(${percent})`
            : `scaleY(${percent})`,
      }}
      {...props}
    />
  );
});
VolumeSliderRange.displayName = "VolumeSliderRange";

const VolumeSliderThumb = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ onKeyDown, onMouseDown, className, ...props }, ref) => {
  const {
    volume,
    setVolume,
    min,
    max,
    orientation,
    step,
    setThumbId,
    trackRef,
  } = useVolumeContext();

  const thumbRef = React.useRef<HTMLDivElement>(null);
  const composedRefs = useComposedRefs(ref, thumbRef);

  const thumbId = React.useId();
  const percent = (volume - min) / (max - min);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (onKeyDown) {
      onKeyDown(event);
      if (event.defaultPrevented) return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      setVolume(Math.min(volume + step, max));
      event.preventDefault();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      setVolume(Math.max(volume - step, min));
      event.preventDefault();
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (onMouseDown) {
      onMouseDown(event);
      if (event.defaultPrevented) return;
    }

    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;

    const updateFromMouse = (clientX: number, clientY: number) => {
      let ratio =
        orientation === "horizontal"
          ? (clientX - rect.left) / rect.width
          : 1 - (clientY - rect.top) / rect.height;

      ratio = Math.min(Math.max(ratio, 0), 1);
      const newValue = min + ratio * (max - min);
      setVolume(newValue);
    };

    updateFromMouse(event.clientX, event.clientY);

    const handleMove = (e: MouseEvent) => updateFromMouse(e.clientX, e.clientY);
    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  React.useEffect(() => {
    setThumbId(thumbId);
  }, [thumbId, setThumbId]);

  const track = trackRef.current;
  const thumbSize = thumbRef.current?.offsetWidth ?? 0;

  const offset = track
    ? orientation === "horizontal"
      ? percent * track.offsetWidth - thumbSize / 2
      : (1 - percent) * track.offsetHeight - thumbSize / 2
    : 0;

  return (
    <HitArea buffer={8} variant="all">
      <div
        id={thumbId}
        ref={composedRefs}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={volume}
        aria-orientation={orientation}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute size-3 bg-primary rounded-full focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer",
          orientation === "horizontal" ? "left-0 top-2/4" : "left-1/2 top-0",
          className
        )}
        style={
          orientation === "horizontal"
            ? { transform: `translate3d(${offset}px, -50%, 0)` }
            : { transform: `translate3d(-50%, ${offset}px, 0)` }
        }
        {...props}
      />
    </HitArea>
  );
});

VolumeSliderThumb.displayName = "VolumeSliderThumb";

export const Volume = {
  Root: VolumeRoot,
  Label: VolumeLabel,
  Button: VolumeButton,
  Slider: Object.assign(VolumeSlider, {
    Track: VolumeSliderTrack,
    Range: VolumeSliderRange,
    Thumb: VolumeSliderThumb,
  }),
  Controls: VolumeControls,
};
