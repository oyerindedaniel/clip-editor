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

function resolveAspectRatioValue(ratio: AspectRatio): number {
  const preset = ASPECT_RATIOS[ratio as keyof typeof ASPECT_RATIOS];
  if (preset) return preset;

  const pieces = String(ratio).split(":");
  if (pieces.length !== 2) return NaN;

  const w = Number(pieces[0]);
  const h = Number(pieces[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return NaN;

  return w / h;
}

export function getAspectRatioValue(ratio: AspectRatio): number {
  const value = resolveAspectRatioValue(ratio);
  if (!Number.isFinite(value)) return ASPECT_RATIOS["16:9"];
  return value;
}

export function calculateHeight(input: {
  aspectRatio: AspectRatio;
  width: number;
}): number {
  const value = resolveAspectRatioValue(input.aspectRatio);
  if (!Number.isFinite(value)) return input.width;
  return input.width / value;
}
