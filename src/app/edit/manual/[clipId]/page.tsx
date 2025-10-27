import ClipEditor from "@/components/editor-container";
import { ClipProvider } from "@/contexts/clip-context";
import { KeyframeProvider } from "@/contexts/keyframe-context";
import { AudioProvider } from "@/contexts/audio-context";
import { OverlaysProvider } from "@/contexts/overlays-context";
import logger from "@/utils/logger";
import { Metadata } from "next";

interface ManualEditPageProps {
  params: {
    clipId: string;
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clipId: string }>;
}): Promise<Metadata> {
  try {
    const { clipId } = await params;

    const title = `Manual Upload - ${clipId} | Zinc`;
    const description = `Manual video upload: ${clipId}`;

    return {
      title: { absolute: title },
      description,
    };
  } catch (error) {
    return {
      title: "Video clip not found",
      description: "The video clip you are looking for does not exist",
    };
  }
}

export const dynamic = "force-dynamic";

async function ManualClipEditorWrapper({ clipId }: { clipId: string }) {
  try {
    return (
      <ClipProvider videoId={clipId} isManual={true}>
        <AudioProvider>
          <KeyframeProvider>
            <OverlaysProvider>
              <ClipEditor clipData={null} isManual={true} clipId={clipId} />
            </OverlaysProvider>
          </KeyframeProvider>
        </AudioProvider>
      </ClipProvider>
    );
  } catch (error) {
    logger.error("Failed to load manual clip:", error);
    return (
      <div className="min-h-dvh bg-surface-primary flex items-center justify-center">
        <div className="text-center">
          <p className="text-3xl text-foreground-subtle font-sans tracking-wide">
            Failed to load the requested video clip.
          </p>
        </div>
      </div>
    );
  }
}

export default async function ManualEditPage({ params }: ManualEditPageProps) {
  const { clipId } = await params;

  return <ManualClipEditorWrapper clipId={clipId} />;
}
