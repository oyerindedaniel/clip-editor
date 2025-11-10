import { generateVideoId } from "@/utils/video";

export const RAF_IDS = Object.freeze({
  seekProgress: (videoId: string) => `seek-progress-${videoId}`,
} as const);

export type RAFId = (typeof RAF_IDS)[keyof typeof RAF_IDS];

export const VIDEO_IDS = Object.freeze({
  main: generateVideoId(5),
  dualVideoPlayer: generateVideoId(5),
  dualVideoPreview: generateVideoId(5),
  dualVideoPreviewPip: generateVideoId(5),
} as const);

export type VideoId = (typeof VIDEO_IDS)[keyof typeof VIDEO_IDS];
