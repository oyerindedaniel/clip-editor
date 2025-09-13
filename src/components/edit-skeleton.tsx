import { Skeleton } from "@/components/ui/skeleton";

function EditPageSkeleton() {
  return (
    <div className="flex flex-col h-dvh bg-surface-primary text-foreground-default text-sm">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 w-full bg-surface-secondary border-b border-gray-700/50">
        <div className="flex relative items-center justify-between px-5 py-2">
          {/* Logo - rectangular instead of round */}
          <Skeleton className="h-8 w-12 rounded-md" />
          <div />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 min-h-0">
        <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
          {/* Video players section - responsive layout */}
          <div className="w-full flex flex-col lg:flex-row items-center gap-4">
            {/* 16:9 primary player */}
            <div className="relative flex-1 min-w-0 aspect-video flex items-center justify-center overflow-hidden rounded-lg bg-surface-secondary shadow-md">
              <div className="relative w-full h-full">
                <Skeleton className="w-full h-full rounded-lg" />
                {/* Video controls skeleton */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-16 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                  </div>
                </div>
              </div>
            </div>

            {/* 9:16 secondary preview */}
            <div className="relative flex items-center aspect-[9/16] w-full lg:w-[260px] justify-center overflow-hidden rounded-lg bg-surface-secondary shadow-md">
              <div className="relative w-full h-full">
                <Skeleton className="w-full h-full rounded-lg" />
                {/* Badge skeleton */}
                <Skeleton className="absolute top-2 left-2 h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>

          {/* Timeline section */}
          <div className="flex-1 min-h-0">
            <div className="space-y-3">
              {/* Timeline header */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20 rounded" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-6 w-6 rounded" />
                </div>
              </div>

              {/* Timeline track */}
              <div className="relative h-16 bg-surface-secondary rounded-lg overflow-hidden">
                <Skeleton className="absolute inset-0" />
                {/* Timeline markers */}
                <div className="absolute top-2 left-0 right-0 h-2 flex items-center">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-1 w-8 mx-1 rounded" />
                  ))}
                </div>
                {/* Playhead */}
                <Skeleton className="absolute top-0 bottom-0 w-0.5 bg-primary left-1/4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { EditPageSkeleton };
