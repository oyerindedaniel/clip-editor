import * as React from "react";
import { cn } from "@/lib/utils";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { getElementRef } from "@/lib/get-element-ref";

type HitAreaVariant = "x" | "y" | "all" | "l" | "r" | "t" | "b";

interface HitAreaProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactElement<
    React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
  >;
  buffer?: number; // px value applied to hit buffer
  variant?: HitAreaVariant;
}

export const HitArea = React.forwardRef<HTMLElement, HitAreaProps>(
  (
    { children, buffer = 8, variant = "all", className, style, ...rest },
    ref
  ) => {
    const composedRef = useComposedRefs(ref, getElementRef(children));

    const variantClass =
      variant === "x"
        ? "before:-mx-(--hit-buffer)"
        : variant === "y"
        ? "before:-my-(--hit-buffer)"
        : variant === "l"
        ? "before:-ml-(--hit-buffer)"
        : variant === "r"
        ? "before:-mr-(--hit-buffer)"
        : variant === "t"
        ? "before:-mt-(--hit-buffer)"
        : variant === "b"
        ? "before:-mb-(--hit-buffer)"
        : "before:-m-(--hit-buffer)";

    if (!React.isValidElement(children)) {
      return null;
    }

    return React.cloneElement(children, {
      ...rest,
      ref: composedRef,
      className: cn(
        children.props.className,
        "relative",
        "before:content-[''] before:absolute before:inset-0 before:pointer-events-auto before:-z-1",
        variantClass,
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
