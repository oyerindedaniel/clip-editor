import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap rounded-3xl text-sm font-medium font-sans transition-all duration-250 active:scale-[98%] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-foreground-on-accent hover:bg-primary-hover active:bg-primary-active",
        destructive:
          "bg-error text-foreground-on-accent hover:bg-error/90 focus-visible:ring-error/50",
        outline:
          "border border-default bg-surface-primary text-foreground-default hover:bg-surface-hover",
        secondary:
          "bg-surface-secondary text-foreground-default hover:bg-surface-tertiary",
        ghost: "text-foreground-default hover:bg-surface-hover",
        link: "text-primary underline-offset-4 hover:underline",
        glass:
          "bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white shadow-sm backdrop-blur-md bg-clip-padding",
        themeToggle:
          "rounded-full text-foreground-subtle hover:text-foreground-default focus-visible:ring-offset-surface-secondary",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-3xl gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-10 rounded-3xl px-6 has-[>svg]:px-4",
        icon: "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
