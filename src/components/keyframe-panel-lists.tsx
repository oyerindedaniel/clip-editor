"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { FileX, Search } from "lucide-react";
import type { KeyframeData } from "@/utils/keyframe";
import { Input } from "@/components/ui/input";
import { KeyframeList, KeyframeListEmpty } from "./keyframe-lists";
import { useFilteredKeyframes } from "@/hooks/app/use-filtered-keyframes";

interface KeyframePanelListsProps extends React.HTMLAttributes<HTMLDivElement> {
  keyframes: KeyframeData[];
  currentKeyframeId: string | null;
  onKeyframeSelect: (id: string) => void;
  onKeyframeRemove?: (id: string) => void;
}

export const KeyframePanelLists: React.FC<KeyframePanelListsProps> = ({
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

  if (!keyframes?.length) {
    return (
      <div className="text-xs text-foreground-muted">No keyframes yet.</div>
    );
  }

  return (
    <div className={className}>
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
              "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted text-xs transition-all duration-200",
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
    </div>
  );
};

export default KeyframePanelLists;
