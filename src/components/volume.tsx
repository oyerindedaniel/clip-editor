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

type AnimationState = "idle" | "entering" | "exiting";

type State = "open" | "closed" | undefined;

type VolumeControlsVariant = "pill" | "soft" | "default";

interface ControlsContextValue {
  forceOpenRef: React.RefObject<boolean>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  sliderRef: React.RefObject<HTMLDivElement | null>;
  thumbRef: React.RefObject<HTMLDivElement | null>;
  shouldRender: boolean;
  animationState: AnimationState;
  state: State;
  variant: VolumeControlsVariant;
}

const ControlsContext = React.createContext<ControlsContextValue | null>(null);
function useControlsContext() {
  const ctx = React.useContext(ControlsContext);
  if (!ctx) throw new Error("Must be inside <Volume.Controls>");
  return ctx;
}

interface VolumeControlsProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: VolumeControlsVariant;
}

const VolumeControls = React.forwardRef<HTMLDivElement, VolumeControlsProps>(
  (
    { className, children, variant = "default", style, ...props },
    forwardedRef
  ) => {
    const { hovering, orientation } = useVolumeContext();

    const sliderRef = React.useRef<HTMLDivElement>(null);
    const trackRef = React.useRef<HTMLDivElement>(null);
    const thumbRef = React.useRef<HTMLDivElement>(null);
    const controlsRef = React.useRef<HTMLDivElement>(null);
    const composedRefs = useComposedRefs(forwardedRef, controlsRef);

    const startRef = React.useRef<number>(0);
    const endRef = React.useRef<number>(0);
    const forceOpenRef = React.useRef(true);
    const [isMeasured, setIsMeasured] = React.useState(false);

    React.useEffect(() => {
      const controls = controlsRef.current;
      if (!controls || forceOpenRef.current || !isMeasured) return;
      startRef.current =
        orientation === "horizontal"
          ? controls.offsetWidth
          : controls.offsetHeight;
    }, [orientation, isMeasured]);

    React.useLayoutEffect(() => {
      const slider = sliderRef.current;
      const controls = controlsRef.current;
      if (!slider || !controls) return;

      slider.style.animation = "none";
      controls.style.animation = "none";
      void controls.offsetWidth;

      endRef.current =
        orientation === "horizontal"
          ? controls.offsetWidth
          : controls.offsetHeight;

      slider.style.animation = "";
      controls.style.animation = "";

      forceOpenRef.current = false;
      setIsMeasured(true);
    }, [orientation]);

    const [animationState, setAnimationState] =
      React.useState<AnimationState>("idle");

    const handleAnimation = (presence: boolean) => {
      return new Promise<void>((resolve) => {
        const el = controlsRef.current!;

        if (!el) {
          resolve();
          return;
        }

        if (presence) {
          setAnimationState("entering");
          resolve();
          return;
        }

        setAnimationState("exiting");

        const onEnd = () => {
          setAnimationState("idle");
          el.removeEventListener("animationend", onEnd);
          resolve();
        };

        el.addEventListener("animationend", onEnd);
      });
    };

    const shouldRender = useAnimatePresence(hovering, handleAnimation, {
      initial: false,
    });

    const state =
      animationState === "entering"
        ? "open"
        : animationState === "exiting"
        ? "closed"
        : undefined;

    return (
      <ControlsContext.Provider
        value={{
          forceOpenRef,
          trackRef,
          sliderRef,
          thumbRef,
          shouldRender,
          animationState,
          state,
          variant,
        }}
      >
        <HitArea buffer={30} variant={orientation === "horizontal" ? "x" : "y"}>
          <div
            ref={composedRefs}
            data-state={state}
            className={cn(
              "relative flex gap-2",
              orientation === "horizontal"
                ? "flex-row items-center justify-center"
                : "flex-col items-center justify-center [&>[data-slot=volume-button]]:order-2",
              variant === "pill" &&
                "bg-surface-secondary/70 backdrop-blur-sm rounded-full p-1",
              variant === "soft" &&
                "bg-surface-secondary/50 backdrop-blur-sm rounded-md p-1",
              orientation === "horizontal"
                ? "data-[state=open]:animate-[expand-width_250ms_linear_forwards] data-[state=closed]:animate-[collapse-width_250ms_linear_forwards]"
                : "data-[state=open]:animate-[expand-height_250ms_linear_forwards] data-[state=closed]:animate-[collapse-height_250ms_linear_forwards]",
              className
            )}
            style={{
              ...style,
              ...({
                "--start":
                  startRef.current === 0
                    ? "min-content"
                    : `${startRef.current}px`,
                "--end":
                  endRef.current === 0 ? "min-content" : `${endRef.current}px`,
              } as React.CSSProperties),
            }}
            {...props}
          >
            {children}
          </div>
        </HitArea>
      </ControlsContext.Provider>
    );
  }
);

VolumeControls.displayName = "VolumeControls";

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
      className,
      size = "icon",
      ...props
    },
    ref
  ) => {
    const { muted, volume, toggleMute } = useVolumeContext();
    const { state } = useControlsContext();

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

    const label = muted || volume === 0 ? "Unmute" : "Mute";

    return (
      <Comp
        ref={ref}
        variant={variant}
        size={size}
        data-slot="volume-button"
        data-state={state}
        className={cn(
          "transition-transform duration-300 data-[state=open]:scale-95 data-[state=closed]:scale-100",
          className
        )}
        aria-label={label}
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

interface VolumeSliderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const VolumeSlider = React.forwardRef<HTMLDivElement, VolumeSliderProps>(
  ({ children, ...props }, forwardedRef) => {
    const { orientation } = useVolumeContext();
    const { forceOpenRef, sliderRef, shouldRender, state, variant } =
      useControlsContext();

    const ref = React.useRef<HTMLDivElement>(null);
    const composedRefs = useComposedRefs(forwardedRef, ref, sliderRef);

    if (!forceOpenRef.current && !shouldRender) return null;

    return (
      <div
        ref={composedRefs}
        role="presentation"
        data-state={state}
        className={cn(
          "flex items-center overflow-hidden [will-change:opacity,transform]",
          orientation === "horizontal" ? "h-4 w-24" : "w-4 h-24 flex-col"
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
  const { setVolume, min, max, orientation } = useVolumeContext();
  const { trackRef } = useControlsContext();

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
>(({ className, style, ...props }, ref) => {
  const { volume, min, max, orientation } = useVolumeContext();
  const percent = (volume - min) / (max - min);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute bg-primary rounded inset-0 will-change-transform",
        orientation === "horizontal" ? "origin-left" : "origin-bottom",
        className
      )}
      style={{
        ...style,
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
>(({ onKeyDown, onMouseDown, className, style, ...props }, forwardedRef) => {
  const { volume, setVolume, min, max, orientation, step, setThumbId } =
    useVolumeContext();
  const { trackRef, thumbRef } = useControlsContext();

  const ref = React.useRef<HTMLDivElement>(null);
  const composedRefs = useComposedRefs(forwardedRef, ref, thumbRef);

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

  React.useLayoutEffect(() => {
    setThumbId(thumbId);
  }, [thumbId]);

  const offset =
    orientation === "horizontal"
      ? `${percent * 100}%`
      : `${(1 - percent) * 100}%`;

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
          "absolute size-3 bg-primary rounded-full cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/50",
          orientation === "horizontal"
            ? "top-1/2 -translate-x-1/2 -translate-y-1/2"
            : "left-1/2 -translate-x-1/2 -translate-y-1/2",
          className
        )}
        style={{
          ...style,
          ...(orientation === "horizontal"
            ? { left: offset }
            : { top: offset }),
        }}
        {...props}
      />
    </HitArea>
  );
});

VolumeSliderThumb.displayName = "VolumeSliderThumb";

export const Volume = {
  Root: VolumeRoot,
  Label: VolumeLabel,
  Controls: VolumeControls,
  Button: VolumeButton,
  Slider: Object.assign(VolumeSlider, {
    Track: VolumeSliderTrack,
    Range: VolumeSliderRange,
    Thumb: VolumeSliderThumb,
  }),
};
