import * as React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DEFAULT_COLORS } from "@/constants/app";

interface ColorPaletteProps {
  value?: string;
  onChange?: (color: string) => void;
  colors?: typeof DEFAULT_COLORS;
  children: React.ReactNode;
}

function getTotalDuration(count: number, duration: number, stagger: number) {
  // Adds a small buffer to ensure the parent stays visible a bit longer
  const buffer = 10;
  if (count <= 0) return 0;
  return duration + (count - 1) * stagger + buffer;
}

export function ColorPalette({
  value,
  onChange,
  colors = DEFAULT_COLORS,
  children,
}: ColorPaletteProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (color: string) => {
    onChange?.(color);
    setOpen(false);
  };

  const DELAY = 50;
  const DURATION = 200;

  // Radix PopoverPresence does not account for child animations.
  // Using totalDuration ensures the popover stays mounted until all child transitions complete.
  const totalDuration = React.useMemo(
    () => getTotalDuration(DEFAULT_COLORS.length, DURATION, DELAY),
    [DEFAULT_COLORS.length]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>

      <PopoverContent
        className={cn(
          "w-auto p-3 !duration-(--total-duration)",
          "[[data-state=closed][data-dialog-aspect-ratio]+[data-radix-popper-content-wrapper]>*]:opacity-0"
        )}
        style={
          {
            "--total-duration": `${totalDuration}ms`,
          } as React.CSSProperties
        }
      >
        <div className="grid grid-cols-5 gap-2">
          {colors.map((color, idx) => {
            const isSelected =
              value && value.toLowerCase() === color.toLowerCase();

            return (
              <button
                key={color + idx}
                type="button"
                data-selected={isSelected ? "" : undefined}
                onClick={() => handleSelect(color)}
                className={cn(
                  "h-7 w-7 rounded-full outline-none border-none relative",
                  "bg-(--bg)",
                  "[[data-state=open]_&]:animate-fade-scale-in",
                  "[[data-state=closed]_&]:animate-fade-scale-out",
                  "data-[selected]:ring-2 data-[selected]:ring-offset-1 data-[selected]:ring-foreground/80"
                )}
                style={
                  {
                    "--index": idx,
                    "--bg": color,
                    "--delay": `calc(var(--index) * ${DELAY}ms)`,
                    "--duration": `${DURATION}ms`,
                  } as React.CSSProperties
                }
                title={color}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ColorPalette;
