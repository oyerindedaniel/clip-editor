import { Skeleton } from "@/components/ui/skeleton";

function EditPageSkeleton() {
  return (
    <div className="flex flex-col h-dvh bg-surface-primary text-foreground-default text-sm">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 w-full bg-surface-secondary">
        <div className="flex relative items-center justify-between px-5 py-2">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 min-h-0">
        <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
          {/* Video players section */}
          <div className="flex gap-4">
            {/* 16:9 primary player */}
            <div className="relative w-full aspect-video flex items-center justify-center overflow-hidden rounded-lg bg-surface-secondary shadow-md flex-shrink-0">
              <Skeleton className="w-full h-full rounded-lg" />
            </div>

            {/* 9:16 secondary preview */}
            <div className="relative flex items-center aspect-[9/16] w-[250px] justify-center overflow-hidden rounded-lg bg-surface-secondary shadow-md flex-shrink-0">
              <Skeleton className="w-full h-full rounded-lg" />
            </div>
          </div>

          {/* Timeline section */}
          <div className="flex-1 min-h-0">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { EditPageSkeleton };
