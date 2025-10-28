import { toast } from "sonner";
import { onFFmpegProgress } from "@/utils/ffmpeg";
import logger from "@/utils/logger";

/**
 * Wraps an async task and displays a toast with progress updates.
 * Works with FFmpeg progress events.
 */
export async function withProgressToast<T>(
  label: string,
  task: () => Promise<T>,
  toastId?: string,
  idPrefix = "task"
): Promise<T> {
  const id = toastId || `${idPrefix}-${Date.now()}`;

  const render = (percent: number): void => {
    toast.custom(
      () => (
        <div className="w-80 rounded-lg bg-primary shadow-xl p-3 text-foreground-on-accent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm md:text-[0.8rem] font-medium tracking-tight">
              {label}
            </span>
            <span className="text-[10px] tabular-nums text-foreground-on-accent/80">
              {percent}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-foreground-on-accent/20 overflow-hidden">
            <div
              className="h-full bg-foreground-on-accent transition-all duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ),
      { id }
    );
  };

  render(0);

  let unsub: (() => void) | null = null;

  try {
    unsub = onFFmpegProgress((progress: number | null) => {
      const percent = Math.max(
        0,
        Math.min(100, Math.round((progress || 0) * 100))
      );
      render(percent);
    });

    const result = await task();

    toast.dismiss(id);
    toast.success(`${label} done`);
    return result;
  } catch (error) {
    toast.dismiss(id);
    logger?.error?.("withProgressToast error:", error);
    throw error;
  } finally {
    if (unsub) unsub();
  }
}
