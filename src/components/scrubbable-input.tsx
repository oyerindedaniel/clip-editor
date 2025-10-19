"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { Label } from "@/components/ui/label";

const DEFAULT_STEP = 1;
const DEFAULT_SENSITIVITY = 0.4;

interface ScrubbableInputContextValue {
  value: number;
  setValue: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  sensitivity?: number;
  disabled?: boolean;
}

const ScrubbableInputContext =
  React.createContext<ScrubbableInputContextValue | null>(null);

function useScrubbableInputContext() {
  const ctx = React.useContext(ScrubbableInputContext);
  if (!ctx)
    throw new Error(
      "ScrubbableInput subcomponents must be used within <ScrubbableInput.Root>"
    );
  return ctx;
}

export interface ScrubbableInputRootProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  sensitivity?: number;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function Root(props: ScrubbableInputRootProps) {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    min,
    max,
    step = DEFAULT_STEP,
    sensitivity = DEFAULT_SENSITIVITY,
    disabled,
    children,
  } = props;

  const [value, setValue] = useControllableState<number>({
    controlled: valueProp,
    defaultValue: defaultValue ?? 0,
    onChange: onValueChange,
  });

  const context = React.useMemo(
    () => ({ value, setValue, min, max, step, sensitivity, disabled }),
    [value, min, max, step, sensitivity, disabled]
  );

  return (
    <ScrubbableInputContext.Provider value={context}>
      {children}
    </ScrubbableInputContext.Provider>
  );
}

export interface ScrubbableInputContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const Content = React.forwardRef<
  HTMLDivElement,
  ScrubbableInputContentProps
>(({ className, children, ...props }, ref) => {
  const { disabled } = useScrubbableInputContext();
  return (
    <div
      ref={ref}
      className={cn(
        "flex h-full gap-2 select-none touch-none overflow-hidden rounded-3xl",
        "bg-surface-secondary border-2 border-subtle",
        "focus-within:border-primary focus-within:bg-surface-secondary/80",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
Content.displayName = "ScrubbableInput.Content";

export interface ScrubbableInputDragHandleProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const DragHandle = React.forwardRef<
  HTMLDivElement,
  ScrubbableInputDragHandleProps
>(({ className, children, ...props }, ref) => {
  const { value, setValue, min, max, step, sensitivity, disabled } =
    useScrubbableInputContext();
  const elementRef = React.useRef<HTMLDivElement | null>(null);
  const composedRef = useComposedRefs(ref, elementRef);

  const frame = React.useRef<number | null>(null);
  const startX = React.useRef(0);
  const startValue = React.useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || !elementRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const target = elementRef.current;
    target.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startValue.current = value;

    const handleMove = (moveEvent: PointerEvent) => {
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const dx = moveEvent.clientX - startX.current;
        const deltaValue =
          dx * (step || DEFAULT_STEP) * (sensitivity || DEFAULT_SENSITIVITY);
        let next = startValue.current + deltaValue;
        if (typeof min === "number") next = Math.max(min, next);
        if (typeof max === "number") next = Math.min(max, next);
        setValue(next);
      });
    };

    const handleUp = () => {
      target.releasePointerCapture(e.pointerId);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      if (frame.current) cancelAnimationFrame(frame.current);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      ref={composedRef}
      onPointerDown={handlePointerDown}
      className={cn(
        "cursor-ew-resize rounded-md active:scale-95 transition-transform will-change-transform",
        "text-foreground-muted hover:text-foreground-default",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
DragHandle.displayName = "ScrubbableInput.DragHandle";

export interface ScrubbableInputLabelProps
  extends React.ComponentPropsWithoutRef<typeof Label> {}

export const LabelElement = React.forwardRef<
  React.ComponentRef<typeof Label>,
  ScrubbableInputLabelProps
>(({ className, children, ...rest }, ref) => {
  const { disabled } = useScrubbableInputContext();
  return (
    <Label
      ref={ref}
      className={cn(
        "text-xs font-medium select-none text-foreground-subtle",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      {...rest}
    >
      {children}
    </Label>
  );
});
LabelElement.displayName = "ScrubbableInput.Label";

export interface ScrubbableInputIconProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string;
}

export const Icon = React.forwardRef<HTMLSpanElement, ScrubbableInputIconProps>(
  ({ name, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center h-8 w-12 uppercase text-foreground-default/80 rounded-l-3xl",
        className
      )}
      {...props}
    >
      {children ?? name}
    </span>
  )
);
Icon.displayName = "ScrubbableInput.Icon";

export interface ScrubbableInputFieldProps
  extends React.ComponentPropsWithoutRef<typeof Input> {}

export const Field = React.forwardRef<
  React.ComponentRef<typeof Input>,
  ScrubbableInputFieldProps
>(({ className, ...props }, ref) => {
  const { value, setValue, disabled, min, max } = useScrubbableInputContext();
  const composedRef = useComposedRefs(ref);
  const [displayValue, setDisplayValue] = React.useState(String(value));
  const isCleared = React.useRef(false);

  // Needed to sync drag handle updates
  React.useEffect(() => {
    setDisplayValue(String(value));
  }, [value]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setDisplayValue(inputValue);

      if (inputValue === "" || inputValue === "-") {
        setValue(0);
        isCleared.current = true;
        return;
      }

      const parsed = parseFloat(inputValue);
      if (!isNaN(parsed)) {
        setValue(parsed);
        isCleared.current = false;
      }
    },
    [setValue]
  );

  const handleFocus = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (value === 0 && isCleared.current) {
        setDisplayValue("");
      }
      props.onFocus?.(e);
    },
    [value, props]
  );

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      isCleared.current = false;
      setDisplayValue(String(value));
      props.onBlur?.(e);
    },
    [value, props]
  );

  return (
    <Input
      ref={composedRef}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      autoComplete="off"
      className={cn(
        "rounded-none bg-transparent border-none shadow-none bg-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none",
        "text-foreground-default placeholder:text-foreground-muted",
        "w-max text-left text-sm",
        className
      )}
      {...props}
    />
  );
});
Field.displayName = "ScrubbableInput.Field";

export interface ScrubbableInputUnitProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

export const Unit = React.forwardRef<HTMLSpanElement, ScrubbableInputUnitProps>(
  ({ className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "text-foreground-default/80 text-xs font-medium select-none rounded-r-3xl inline-flex items-center justify-center h-8 w-12",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
);
Unit.displayName = "ScrubbableInput.Unit";

export const ScrubbableInput = {
  Root,
  Content,
  DragHandle,
  Icon,
  Field,
  Unit,
  Label: LabelElement,
};
