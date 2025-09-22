"use client";

import React, { useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONT_OPTIONS } from "@/constants/app";
import { loadFontVariants, preloadCommonVariants } from "@/utils/font-loader";
import logger from "@/utils/logger";
import { useStableHandler } from "@/hooks/use-stable-handler";

interface FontSelectorProps {
  value: string;
  onChange: (font: string) => void;
  bold?: boolean;
  italic?: boolean;
}

export function FontSelector({
  value,
  onChange,
  bold = true,
  italic = true,
}: FontSelectorProps) {
  const [_, setHoveredFont] = useState<string | null>(null);
  const [preloadedFonts, setPreloadedFonts] = useState<Set<string>>(new Set());

  const onChangeRef = useStableHandler(onChange);

  const handleFontHover = useCallback(
    (fontName: string) => {
      setHoveredFont(fontName);

      if (!preloadedFonts.has(fontName)) {
        preloadCommonVariants(fontName);
        setPreloadedFonts((prev) => new Set(prev).add(fontName));
      }
    },
    [preloadedFonts]
  );

  const handleFontLeave = useCallback(() => {
    setHoveredFont(null);
  }, []);

  const handleFontChange = useCallback(
    (fontName: string) => {
      onChangeRef(fontName);

      const fontOption = FONT_OPTIONS.find((font) => font.value === fontName);
      if (fontOption) {
        loadFontVariants(fontName, bold, italic)
          .then((results) => {
            const errors = results.filter((r) => r instanceof Error);
            if (errors.length > 0) {
              logger.warn(
                `Some font variants failed to load for ${fontName}:`,
                errors
              );
            }
          })
          .catch((error) => {
            logger.warn(`Failed to load font variants for ${fontName}:`, error);
          });
      }
    },
    [bold, italic]
  );

  return (
    <Select value={value} onValueChange={handleFontChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select font" />
      </SelectTrigger>
      <SelectContent>
        {FONT_OPTIONS.map((font) => (
          <SelectItem
            key={font.value}
            value={font.value}
            onMouseEnter={() => handleFontHover(font.value)}
            onMouseLeave={handleFontLeave}
            className="cursor-pointer"
          >
            <span
              style={{
                fontFamily: `"${font.value}", Inter, sans-serif`,
                fontWeight: 400,
              }}
            >
              {font.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default FontSelector;
