import * as React from "react";
import { cn } from "@/lib/utils";

type HitAreaVariant = "x" | "y" | "all";

interface HitAreaProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactElement<
    React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
  >;
  buffer?: number;
  variant?: HitAreaVariant;
}

export const HitArea = React.forwardRef<HTMLElement, HitAreaProps>(
  (
    { children, buffer = 8, variant = "all", className, style, ...rest },
    ref
  ) => {
    const variantClass =
      variant === "x"
        ? "before:-mx-(--hit-buffer)"
        : variant === "y"
        ? "before:-my-(--hit-buffer)"
        : "before:-m-(--hit-buffer)";

    if (!React.isValidElement(children)) {
      return null;
    }

    return React.cloneElement(children, {
      ...rest,
      ref,
      className: cn(
        children.props.className,
        "relative",
        "before:content-[''] before:absolute before:inset-0 before:pointer-events-auto",
        variantClass,
        className
      ),
      style: {
        ...children.props.style,
        ...style,
        ["--hit-buffer" as any]: `${buffer}px`,
      } as React.CSSProperties,
    });
  }
);

HitArea.displayName = "HitArea";
