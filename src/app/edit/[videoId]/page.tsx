import { Suspense } from "react";
import ClipEditor from "@/components/editor";
import { getClip } from "@/services/aws-service";
import { EditPageSkeleton } from "@/components/edit-skeleton";
import logger from "@/utils/logger";

interface EditPageProps {
  params: {
    videoId: string;
  };
}

async function ClipEditorWrapper({ videoId }: { videoId: string }) {
  try {
    const clipData = await getClip(videoId);
    return <ClipEditor clipData={clipData} />;
  } catch (error) {
    logger.error("Failed to load clip:", error);
    return (
      <div className="min-h-screen bg-surface-primary flex items-center justify-center">
        <div className="text-center">
          <p className="text-3xl text-foreground-subtle font-sans tracking-wide">
            Failed to load the requested video clip.
          </p>
        </div>
      </div>
    );
  }
}

export default async function EditPage({ params }: EditPageProps) {
  const { videoId } = await params;

  return (
    <Suspense fallback={<EditPageSkeleton />}>
      <ClipEditorWrapper videoId={videoId} />
    </Suspense>
  );
}
