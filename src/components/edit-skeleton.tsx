import { Skeleton } from "@/components/ui/skeleton";

function EditPageSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-surface-primary text-foreground-default text-sm">
      <div className="max-w-screen-xl mx-auto w-full">
        <div className="flex items-center justify-between p-4 bg-surface-secondary border-b border-gray-700/50">
          <Skeleton className="h-6 w-32" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        <div className="flex flex-col p-4 space-y-4 overflow-hidden pb-16">
          {/* Video player skeleton */}
          <Skeleton className="w-full aspect-video rounded-lg" />

          {/* Timeline skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>

          {/* Tools panel skeleton */}
          <div className="flex-1 flex flex-col bg-surface-primary rounded-lg shadow-md overflow-hidden border border-gray-700/50">
            <div className="flex border-b border-gray-700/50">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 h-10" />
              ))}
            </div>
            <div className="flex-1 p-4">
              <div className="space-y-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { EditPageSkeleton };
