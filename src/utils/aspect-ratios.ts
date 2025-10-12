export const DEFAULT_VIDEO_WIDTH = 1920;
export const DEFAULT_VIDEO_HEIGHT = 1080;
export const OVERLAY_SCALE_FACTOR = 0.8;
export const MIN_OVERLAY_WIDTH = 100;

export type ScreenSize = "16:9" | "9:16";
export type AspectRatio169 = "9:16" | "1:1" | "4:3" | "3:4";
export type AspectRatio916 = "16:9" | "1:1" | "4:3" | "21:9" | "3:4";
export type AspectRatio = AspectRatio169 | AspectRatio916;

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
  const ratio = ASPECT_RATIOS[params.aspectRatio];
  return params.width / ratio;
}
