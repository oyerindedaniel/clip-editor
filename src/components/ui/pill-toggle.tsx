import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const pillToggleVariants = cva(
  "relative inline-flex items-center justify-center rounded-full border-2 border-subtle bg-surface-secondary transition-all duration-200 ease-in-out hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-surface-primary disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        default: "h-9",
        sm: "h-8",
        lg: "h-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

interface PillToggleContextValue {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

const PillToggleContext = React.createContext<PillToggleContextValue | null>(
  null
);

function usePillToggleContext(): PillToggleContextValue {
  const ctx = React.useContext(PillToggleContext);
  if (!ctx) {
    throw new Error(
      "PillToggle components must be used within <PillToggle.Root>"
    );
  }
  return ctx;
}

interface PillToggleRootProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

const PillToggleRoot = React.forwardRef<
  HTMLDivElement,
  PillToggleRootProps & VariantProps<typeof pillToggleVariants>
>(
  (
    {
      value,
      onValueChange,
      disabled = false,
      children,
      size,
      className,
      ...props
    },
    ref
  ) => {
    const ctx = React.useMemo(
      () => ({
        value,
        onValueChange,
        disabled,
      }),
      [value, onValueChange, disabled]
    );

    return (
      <PillToggleContext.Provider value={ctx}>
        <div
          ref={ref}
          className={cn(pillToggleVariants({ size, className }), "flex")}
          {...props}
        >
          {children}
        </div>
      </PillToggleContext.Provider>
    );
  }
);

PillToggleRoot.displayName = "PillToggleRoot";

interface PillToggleItemProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
  side: "left" | "right";
}

const PillToggleItem = React.forwardRef<HTMLButtonElement, PillToggleItemProps>(
  ({ asChild = false, side, className, children, ...props }, ref) => {
    const { value, onValueChange, disabled } = usePillToggleContext();
    const Comp = asChild ? Slot : "button";

    const isActive = side === "left" ? value : !value;

    return (
      <Comp
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={() => onValueChange(side === "left")}
        className={cn(
          "flex items-center w-max justify-center gap-2 px-4 py-2 transition-all duration-200 text-sm md:text-[0.8rem] font-medium",
          side === "left" ? "rounded-l-full" : "rounded-r-full",
          isActive
            ? "bg-primary text-foreground-on-accent"
            : "text-foreground-subtle hover:text-foreground-default",
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

PillToggleItem.displayName = "PillToggleItem";

const PillToggleDivider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { value } = usePillToggleContext();

  return (
    <div
      ref={ref}
      className={cn(
        "w-px h-6 transition-colors duration-200",
        value ? "bg-foreground-on-accent/20" : "bg-subtle",
        className
      )}
      {...props}
    />
  );
});

PillToggleDivider.displayName = "PillToggleDivider";

export const PillToggle = {
  Root: PillToggleRoot,
  Item: PillToggleItem,
  Divider: PillToggleDivider,
};
