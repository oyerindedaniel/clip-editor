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
import { ListChecks, Search, FileX } from "lucide-react";
import type { KeyframeData } from "@/utils/keyframe";
import { Input } from "@/components/ui/input";
import { useFilteredKeyframes } from "@/hooks/app/use-filtered-keyframes";
import { DEFAULT_COLORS } from "@/constants/app";

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
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);

  const groupedKeyframes = useFilteredKeyframes(keyframes, query);

  const isSearchActive = focused || !!query;

  if (!keyframes?.length) return null;

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="relative"
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
          className="w-72 max-h-72 overflow-y-auto no-scrollbar p-2 bg-surface-primary border-subtle"
        >
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Search keyframes..."
                className={cn(
                  "pr-3 transition-all duration-200",
                  isSearchActive ? "pl-3" : "pl-8"
                )}
              />
              <span
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted text-sm md:text-[0.8rem] transition-all duration-200",
                  isSearchActive
                    ? "opacity-0 -translate-x-2"
                    : "opacity-100 translate-x-0"
                )}
                aria-hidden
              >
                <Search size={14} />
              </span>
            </div>

            {(() => {
              const hasResults =
                groupedKeyframes.primary.length > 0 ||
                groupedKeyframes.secondary.length > 0;

              if (!hasResults && query.trim()) {
                return <KeyframeListEmpty />;
              }

              return (
                <KeyframeList
                  groupedKeyframes={groupedKeyframes}
                  currentKeyframeId={currentKeyframeId}
                  onKeyframeSelect={onKeyframeSelect}
                  onKeyframeRemove={onKeyframeRemove}
                />
              );
            })()}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

interface KeyframeListProps extends Omit<KeyframeListsProps, "keyframes"> {
  groupedKeyframes: Record<"primary" | "secondary", KeyframeData[]>;
}

export const KeyframeList: React.FC<KeyframeListProps> = ({
  groupedKeyframes,
  currentKeyframeId,
  onKeyframeSelect,
  onKeyframeRemove,
}) => {
  return (
    <>
      {(["primary", "secondary"] as const).map((section) => {
        const keyframes = groupedKeyframes[section];
        if (!keyframes.length) return null;

        return (
          <div key={section} className="flex flex-col gap-1">
            <div className="px-1 py-1 text-[10px] uppercase tracking-wide text-foreground-muted">
              {section}
            </div>

            {keyframes.map((keyframe) => (
              <div
                key={keyframe.id}
                className={cn(
                  "group relative w-full h-8 rounded-3xl border",
                  "bg-surface-secondary hover:bg-surface-hover border-subtle overflow-hidden",
                  currentKeyframeId === keyframe.id &&
                    "ring-1 ring-primary/40 border-primary/50"
                )}
              >
                <button
                  onClick={() => onKeyframeSelect(keyframe.id)}
                  className="absolute inset-0 cursor-pointer flex items-center gap-3 px-3 text-left w-full h-full"
                >
                  <span
                    className="h-3 w-3 rounded-full border bg-(--color)"
                    style={
                      {
                        "--color": (keyframe.color ||
                          DEFAULT_COLORS[2]) as string,
                      } as React.CSSProperties
                    }
                  />
                  <span className="text-sm md:text-[0.8rem] font-medium tracking-tight text-foreground-default">
                    {keyframe.time.toFixed(1)}s
                  </span>
                  <span className="ml-auto text-[10px] text-foreground-muted">
                    {keyframe.name || keyframe.id.replace(/^keyframe-/, "#")}
                  </span>
                </button>

                {onKeyframeRemove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onKeyframeRemove(keyframe.id);
                    }}
                    aria-label="Remove keyframe"
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer",
                      "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",
                      "transition-all duration-200 ease-out",
                      "bg-error/90 hover:bg-error text-foreground-on-accent backdrop-blur-sm",
                      "h-5 rounded-full px-2 py-0 text-[10px] leading-none shadow-sm"
                    )}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
};

export const KeyframeListEmpty: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center">
        <FileX className="w-6 h-6 text-foreground-muted" />
      </div>

      <div className="text-center">
        <div className="text-base font-medium text-foreground-default mb-1">
          No results found
        </div>
        <div className="text-sm md:text-[0.8rem] text-foreground-muted">
          Try a different search term
        </div>
      </div>
    </div>
  );
};

export default KeyframeLists;
