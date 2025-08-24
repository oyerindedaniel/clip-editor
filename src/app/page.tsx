import { Suspense } from "react";
import ClipGrid from "@/components/clip-grid";
import { listClips } from "@/services/aws-service";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

function HomePageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface-secondary rounded-lg overflow-hidden border border-gray-700/50"
          >
            <Skeleton className="aspect-video w-full" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function ClipGridWrapper() {
  let clips: Array<{
    id: string;
    name: string;
    url: string;
    createdAt: string;
    duration: number;
    streamerName: string;
  }> = [];

  try {
    clips = await listClips();
  } catch (error) {
    console.error("Failed to load clips:", error);
  }

  return <ClipGrid initialClips={clips} />;
}

export default function Home() {
  return (
    <div className="min-h-screen bg-surface-primary">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Image
              src="/logo/zinc_norms.png"
              alt="Zinc"
              width={128}
              height={128}
              className="h-32 w-32 text-white"
              priority
            />
          </div>
        </div>

        <Suspense fallback={<HomePageSkeleton />}>
          <ClipGridWrapper />
        </Suspense>
      </div>
    </div>
  );
}
