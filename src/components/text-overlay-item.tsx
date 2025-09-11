import React, { memo } from "react";
import {
  Eye,
  EyeOff,
  Trash2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import type { TextOverlay } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";
import { useShallowSelector } from "@/hooks/context-store";
import { OverlaysContext } from "@/contexts/overlays-context";

interface TextOverlayItemProps {
  overlay: TextOverlay;
  selectedOverlay: string | null;
  duration: number;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  deleteTextOverlay: (id: string) => void;
}

const fontSizes = Array.from(
  { length: Math.floor((72 - 8) / 4) + 1 },
  (_, i) => 8 + i * 4
);
const opacities = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.1);

const TextOverlayItem = ({
  overlay,
  selectedOverlay,
  duration,
  updateTextOverlay,
  deleteTextOverlay,
}: TextOverlayItemProps) => {
  return (
    <div
      className={cn(
        "rounded-lg border text-sm overflow-hidden",
        selectedOverlay === overlay.id
          ? "border-primary/60 bg-primary/5"
          : "border-subtle bg-surface-secondary"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-subtle">
        <div className="min-w-0 mr-2">
          <div className="text-foreground-default text-sm font-medium truncate">
            {overlay.text || "Text Overlay"}
          </div>
          <div className="text-foreground-subtle text-[11px]">
            {overlay.endTime === duration ? "Persistent" : "Timed"}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={() =>
              updateTextOverlay(overlay.id, {
                visible: !overlay.visible,
              })
            }
            className={cn("h-7 w-7 p-0", {
              "text-primary": overlay.visible,
              "text-foreground-muted": !overlay.visible,
            })}
            variant="ghost"
            size="icon"
          >
            {overlay.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </Button>
          <Button
            onClick={() => deleteTextOverlay(overlay.id)}
            className="h-7 w-7 p-0 text-error hover:text-error/80"
            variant="ghost"
            size="icon"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {selectedOverlay === overlay.id && (
        <div className="px-3 py-3 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs text-foreground-subtle">Text</label>
            <Input
              type="text"
              value={overlay.text}
              onChange={(e) =>
                updateTextOverlay(overlay.id, {
                  text: e.target.value,
                })
              }
              className="text-sm"
              placeholder="Enter text"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs text-foreground-subtle">
                Display
              </label>
              <Select
                value={overlay.endTime === duration ? "persistent" : "timed"}
                onValueChange={(value) => {
                  if (value === "persistent") {
                    updateTextOverlay(overlay.id, {
                      startTime: 0,
                      endTime: duration,
                    });
                  }
                }}
              >
                <SelectTrigger className="w-full px-2 py-1.5 h-8 text-xs">
                  <SelectValue placeholder="Display" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="persistent">Persistent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-foreground-subtle">
                Font size
              </label>
              <Select
                value={String(overlay.fontSize)}
                onValueChange={(value) =>
                  updateTextOverlay(overlay.id, { fontSize: parseInt(value) })
                }
              >
                <SelectTrigger className="w-full px-2 py-1.5 h-8 text-xs">
                  <SelectValue placeholder="Font size" />
                </SelectTrigger>
                <SelectContent>
                  {fontSizes.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-foreground-subtle">Styles</div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() =>
                  updateTextOverlay(overlay.id, { bold: !overlay.bold })
                }
                className={cn(
                  "h-7 w-7 p-0 rounded",
                  overlay.bold ? "bg-primary" : "bg-surface-tertiary"
                )}
                variant="ghost"
                size="icon"
              >
                <Bold size={16} />
              </Button>
              <Button
                onClick={() =>
                  updateTextOverlay(overlay.id, { italic: !overlay.italic })
                }
                className={cn(
                  "h-7 w-7 p-0 rounded",
                  overlay.italic ? "bg-primary" : "bg-surface-tertiary"
                )}
                variant="ghost"
                size="icon"
              >
                <Italic size={16} />
              </Button>
              <Button
                onClick={() =>
                  updateTextOverlay(overlay.id, {
                    underline: !overlay.underline,
                  })
                }
                className={cn(
                  "h-7 w-7 p-0 rounded",
                  overlay.underline ? "bg-primary" : "bg-surface-tertiary"
                )}
                variant="ghost"
                size="icon"
              >
                <Underline size={16} />
              </Button>
              <div className="mx-2 h-5 w-px bg-subtle" />
              {[
                { value: "left", icon: AlignLeft },
                { value: "center", icon: AlignCenter },
                { value: "right", icon: AlignRight },
              ].map(({ value, icon: Icon }) => (
                <Button
                  key={value}
                  onClick={() =>
                    updateTextOverlay(overlay.id, {
                      alignment: value as "left" | "center" | "right",
                    })
                  }
                  className={cn("h-7 w-7 p-0 rounded", {
                    "bg-primary": overlay.alignment === value,
                    "bg-surface-tertiary": overlay.alignment !== value,
                  })}
                  variant="ghost"
                  size="icon"
                >
                  <Icon size={16} />
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs text-foreground-subtle">
                Text color
              </label>
              <ColorPicker
                color={overlay.color}
                onChange={(value) =>
                  updateTextOverlay(overlay.id, { color: value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-foreground-subtle">
                Background
              </label>
              <ColorPicker
                color={overlay.backgroundColor}
                onChange={(value) =>
                  updateTextOverlay(overlay.id, { backgroundColor: value })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TextOverlayItemContainerProps {
  duration: number;
}

const TextOverlayItemContainer = ({
  duration,
}: TextOverlayItemContainerProps) => {
  const {
    textOverlays,
    selectedOverlay,
    updateTextOverlay,
    deleteTextOverlay,
  } = useShallowSelector(OverlaysContext, (state) => ({
    textOverlays: state.textOverlays,
    selectedOverlay: state.selectedOverlay,
    updateTextOverlay: state.updateTextOverlay,
    deleteTextOverlay: state.deleteTextOverlay,
  }));

  return textOverlays.map((textOverlay) => (
    <TextOverlayItem
      key={textOverlay.id}
      overlay={textOverlay}
      selectedOverlay={selectedOverlay}
      duration={duration}
      updateTextOverlay={updateTextOverlay}
      deleteTextOverlay={deleteTextOverlay}
    />
  ));
};

export default memo(TextOverlayItemContainer);
