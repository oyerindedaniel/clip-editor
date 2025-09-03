import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const TimelineSkeleton: React.FC = () => {
  return (
    <div className="flex relative flex-col gap-2 w-full h-[150px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-foreground-subtle">✂️</div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-32 bg-surface-tertiary rounded" />
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative w-full h-[90px] rounded-md bg-surface-secondary overflow-hidden">
        <div className="relative min-w-full w-full">
          {/* Ruler Skeleton */}
          <div className="absolute inset-x-0 top-0 h-5">
            <Skeleton className="w-full h-full bg-surface-tertiary rounded" />
          </div>

          {/* Track Skeleton */}
          <div className="absolute left-0 right-0 top-6 h-14">
            <div className="absolute inset-y-0 left-0 right-0 mx-2 rounded bg-surface-tertiary/60" />
            <div className="absolute top-0 h-14 rounded-md border border-default overflow-hidden shadow-inner">
              <Skeleton className="w-full h-full bg-surface-tertiary rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
