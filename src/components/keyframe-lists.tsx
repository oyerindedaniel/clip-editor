"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ListChecks } from "lucide-react";
import type { KeyframeData } from "@/utils/keyframe";

interface KeyframeListsProps extends React.HTMLAttributes<HTMLDivElement> {
  keyframes: KeyframeData[];
  currentKeyframeId: string | null;
  onKeyframeSelect: (id: string) => void;
  onKeyframeRemove?: (id: string) => void;
}

export const KeyframeLists: React.FC<KeyframeListsProps> = ({
  keyframes,
  currentKeyframeId,
  onKeyframeSelect,
  onKeyframeRemove,
  className,
}) => {
  if (!keyframes?.length) return null;

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className={cn("relative")}
            aria-label="Keyframes"
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span className="absolute -top-1 -right-1">
              <Badge className="rounded-full bg-primary text-foreground-on-accent h-4 min-w-4 px-1 py-0 text-[10px] leading-none font-semibold">
                {keyframes.length}
              </Badge>
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          className="w-64 max-h-64 overflow-y-auto no-scrollbar p-2 bg-surface-primary border-subtle"
        >
          <div className="flex flex-col gap-1">
            {keyframes
              .slice()
              .sort((a, b) => a.time - b.time)
              .map((kf) => (
                <div
                  key={kf.id}
                  className={cn(
                    "group relative w-full h-8 rounded-3xl border",
                    "bg-surface-secondary hover:bg-surface-hover border-subtle overflow-hidden",
                    currentKeyframeId === kf.id &&
                      "ring-1 ring-primary/40 border-primary/50"
                  )}
                >
                  <button
                    onClick={() => onKeyframeSelect(kf.id)}
                    className="absolute inset-0 cursor-pointer flex items-center gap-3 px-3 text-left w-full h-full"
                  >
                    <span
                      className="h-3 w-3 rounded-full border bg-(--color)"
                      style={
                        {
                          "--color": kf.color || "#22c55e",
                        } as React.CSSProperties
                      }
                    />
                    <span className="text-xs font-medium tracking-tight text-foreground-default">
                      {kf.time.toFixed(2)}s
                    </span>
                    <span className="ml-auto text-[10px] text-foreground-muted">
                      {kf.id.replace(/^kf-/, "#")}
                    </span>
                  </button>

                  {onKeyframeRemove && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onKeyframeRemove(kf.id);
                      }}
                      aria-label="Remove keyframe"
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer",
                        "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",
                        "transition-all duration-200 ease-out",
                        "bg-error/90 hover:bg-error text-foreground-on-accent backdrop-blur-sm",
                        "rounded-full h-5 px-2 py-0 text-[10px] leading-none shadow-sm"
                      )}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default KeyframeLists;
