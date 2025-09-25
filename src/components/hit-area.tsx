import * as React from "react";
import { cn } from "@/lib/utils";

interface HitAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  buffer?: number;
}

export const HitArea: React.FC<HitAreaProps> = ({
  children,
  buffer = 16,
  className,
  style,
  ...rest
}) => {
  const half = buffer / 2;

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 flex items-center justify-center cursor-pointer",
        className
      )}
      style={{
        left: `-${half}px`,
        width: `${buffer}px`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
};
