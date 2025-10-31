export const DEFAULT_VIDEO_WIDTH = 1920;
export const DEFAULT_VIDEO_HEIGHT = 1080;
export const OVERLAY_SCALE_FACTOR = 0.8;
export const MIN_OVERLAY_WIDTH = 100;

export type ScreenSize = "16:9" | "9:16";
export type AspectRatio169 = "9:16" | "1:1" | "4:3" | "3:4";
export type AspectRatio916 = "16:9" | "1:1" | "4:3" | "21:9" | "3:4";
export type AspectRatio =
  | AspectRatio169
  | AspectRatio916
  | `${string}:${string}`;

export const ASPECT_RATIOS: Record<AspectRatio, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "21:9": 21 / 9,
};

export function calculateHeight(params: {
  aspectRatio: AspectRatio;
  width: number;
}): number {
  const known = ASPECT_RATIOS[params.aspectRatio as keyof typeof ASPECT_RATIOS];
  if (known) return params.width / known;
  // parse custom
  const [w, h] = String(params.aspectRatio).split(":");
  const wn = Number(w);
  const hn = Number(h);
  if (!Number.isFinite(wn) || !Number.isFinite(hn) || hn === 0) {
    return params.width; // fallback
  }
  const ratio = wn / hn;
  return params.width / ratio;
}
