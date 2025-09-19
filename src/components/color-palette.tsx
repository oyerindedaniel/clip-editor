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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>

      <PopoverContent className="w-auto p-3" sideOffset={4} forceMount>
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
                  transition-[opacity,transform]
                  [[data-state=open]_&]:delay-(--delay)
                  [[data-state=open]_&]:duration-(--duration) 
                   ease-in-out relative
                  data-[selected]:ring-2
                  data-[selected]:ring-offset-1
                  data-[selected]:ring-foreground/80
                `}
                style={
                  {
                    "--index": idx,
                    "--bg": color,
                    "--delay": `calc(var(--index) * 500ms)`,
                    "--duration": `300ms`,
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
