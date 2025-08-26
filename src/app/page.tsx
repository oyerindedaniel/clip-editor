import { Suspense } from "react";
import Link from "next/link";
import ClipGrid from "@/components/clip-grid";
import { listClips } from "@/services/aws-service";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import logger from "@/utils/logger";

function HomePageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-4 bg-surface-secondary rounded-lg">
            <div className="bg-surface-secondary rounded-lg overflow-hidden border border-gray-700/50 hover:border-primary/50 transition-colors cursor-pointer group">
              <div className="aspect-video bg-gray-800 relative overflow-hidden">
                <Skeleton className="w-full h-full" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function ClipGridWrapper() {
  let clips: Awaited<ReturnType<typeof listClips>> = [];

  try {
    clips = await listClips();
  } catch (error) {
    logger.error("Failed to load clips:", error);
    <div className="min-h-dvh bg-surface-primary flex items-center justify-center">
      <div className="text-center">
        <p className="text-3xl text-foreground-subtle font-sans tracking-wide">
          Failed to load video clips.
        </p>
      </div>
    </div>;
  }

  return <ClipGrid initialClips={clips} />;
}

export default function Home() {
  return (
    <div className="min-h-screen bg-surface-primary">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/">
              <Image
                src="/logo/zinc_norms_white.webp"
                alt="Zinc"
                width={128}
                height={128}
                className="h-24 w-24 text-white"
                priority
              />
            </Link>
          </div>
        </div>

        <Suspense fallback={<HomePageSkeleton />}>
          <ClipGridWrapper />
        </Suspense>
      </div>
    </div>
  );
}
