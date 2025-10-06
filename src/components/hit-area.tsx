import * as React from "react";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { getElementRef } from "@/lib/get-element-ref";

type HitAreaVariant = "x" | "y" | "all" | "l" | "r" | "t" | "b";

interface HitAreaProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactElement<
    React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
  >;
  buffer?: number; // px value applied to hit buffer
  variant?: HitAreaVariant;
  debug?: boolean;
}

const hitAreaVariants = cva(
  "relative before:content-[''] before:absolute before:inset-0 before:pointer-events-auto before:-z-1",
  {
    variants: {
      variant: {
        x: "before:-mx-(--hit-buffer)",
        y: "before:-my-(--hit-buffer)",
        l: "before:-ml-(--hit-buffer)",
        r: "before:-mr-(--hit-buffer)",
        t: "before:-mt-(--hit-buffer)",
        b: "before:-mb-(--hit-buffer)",
        all: "before:-m-(--hit-buffer)",
      },
      debug: {
        true: "before:bg-red-500",
        false: "",
      },
    },
    defaultVariants: {
      variant: "all",
      debug: false,
    },
  }
);

export const HitArea = React.forwardRef<HTMLElement, HitAreaProps>(
  (
    {
      children,
      buffer = 8,
      variant = "all",
      debug = false,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const composedRef = useComposedRefs(ref, getElementRef(children));

    if (!React.isValidElement(children)) return null;

    return React.cloneElement(children, {
      ...props,
      ref: composedRef,
      className: cn(
        children.props.className,
        hitAreaVariants({ variant, debug }),
        className
      ),
      style: {
        ...children.props.style,
        ...style,
        "--hit-buffer": `${buffer}px`,
      } as React.CSSProperties,
    });
  }
);

HitArea.displayName = "HitArea";
