import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground-default bg-surface-secondary placeholder:text-foreground-muted selection:bg-primary selection:text-foreground-on-accent flex h-8 w-full min-w-0 rounded-3xl px-3 py-1 transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-base md:text-sm text-foreground-default font-mono",
        "border-2 border-subtle focus-visible:border-primary focus-visible:bg-surface-secondary/80",
        "aria-invalid:ring-error/50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
