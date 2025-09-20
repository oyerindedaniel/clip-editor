import React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

interface ColorPaletteProps {
  value?: string;
  onChange?: (color: string) => void;
  colors?: string[];
  children: React.ReactNode;
}

const DEFAULT_COLORS = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#f59e0b",
  "#fbbf24",
  "#10b981",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
];

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
  const DURATION = 300;

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
        className="w-auto p-3 !duration-(--total-duration)"
        forceMount
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
                className={`
                  h-7 w-7 rounded-full outline-none border-none
                  bg-(--bg) 
                  [[data-state=closed]_&]:opacity-0
                  [[data-state=closed]_&]:translate-y-2
                  [[data-state=closed]_&]:scale-95
                  [[data-state=open]_&]:opacity-100
                  [[data-state=open]_&]:translate-y-0
                  [[data-state=open]_&]:scale-100
                  transition-all
                  delay-(--delay)
                  duration-(--duration)
                  ease-in-out relative
                  data-[selected]:ring-2
                  data-[selected]:ring-offset-1
                  data-[selected]:ring-foreground/80
                `}
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
