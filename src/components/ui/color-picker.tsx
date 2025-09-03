import React, { useState } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg bg-surface-secondary px-2 py-1 text-xs"
        >
          <span
            className="inline-block h-4 w-4 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <HexColorInput
            color={color}
            onChange={onChange}
            prefixed
            className="flex-1 rounded-lg bg-surface-secondary px-2 py-1 text-xs text-foreground-default"
            onClick={(e) => e.stopPropagation()}
            onFocus={() => setOpen(true)}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-56">
        <HexColorPicker color={color} onChange={onChange} className="w-full" />
      </PopoverContent>
    </Popover>
  );
};
