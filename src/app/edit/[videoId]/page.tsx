import { getClip } from "@/services/aws-service";
import ClipEditor from "@/components/editor-container";
import { ClipProvider } from "@/contexts/clip-context";
import { KeyframeProvider } from "@/contexts/keyframe-context";
import { AudioProvider } from "@/contexts/audio-context";
import { OverlaysProvider } from "@/contexts/overlays-context";
import logger from "@/utils/logger";
import { Metadata } from "next";
import { msToSeconds } from "@/utils/video";

interface EditPageProps {
  params: {
    videoId: string;
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string }>;
}): Promise<Metadata> {
  try {
    const { videoId } = await params;
    const { metadata } = await getClip(videoId);

    const { clipId, streamerName, clipDurationMs } = metadata;

    const totalSec = Math.floor(msToSeconds(clipDurationMs));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const durationStr = `${min}:${sec.toString().padStart(2, "0")}`;

    const title = `${streamerName} - Clip ${clipId} | Zinc`;

    const description = `${streamerName}'s clip (${durationStr})`;

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

async function ClipEditorWrapper({ videoId }: { videoId: string }) {
  try {
    const clipData = await getClip(videoId);
    return (
      <ClipProvider videoId={videoId}>
        <AudioProvider>
          <KeyframeProvider>
            <OverlaysProvider>
              <ClipEditor clipData={clipData} />
            </OverlaysProvider>
          </KeyframeProvider>
        </AudioProvider>
      </ClipProvider>
    );
  } catch (error) {
    logger.error("Failed to load clip:", error);
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

export default async function EditPage({ params }: EditPageProps) {
  const { videoId } = await params;

  return <ClipEditorWrapper videoId={videoId} />;
}
