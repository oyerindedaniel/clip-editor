import { generateVideoId } from "@/utils/video";

export const RAF_IDS = Object.freeze({
  seekProgress: (videoId: string) => `seek-progress-${videoId}`,
} as const);

export type RAFId = (typeof RAF_IDS)[keyof typeof RAF_IDS];

export const MAIN_VIDEO_ID = generateVideoId(5);
