import type { CropMode, ExportSettings, VideoFormat } from "@/types/app";

export const DEFAULT_ASPECT_RATIO = "original";
export const DEFAULT_CROP_MODE = "letterbox";

export const DEFAULT_CLIP_PRE_MARK_MS = 10000;
export const DEFAULT_CLIP_POST_MARK_MS = 10000;
export const CLIP_BUFFER_MS = 3000;
export const WAIT_UNTIL_BUFFER_TIMEOUT_MS = 10000;

export const EXPORT_BITRATE_MAP: Record<
  ExportSettings["resolution"],
  Record<ExportSettings["fps"], { min: number; standard: number; high: number }>
> = {
  "720p": {
    24: { min: 2.5, standard: 5, high: 7 },
    30: { min: 2.5, standard: 5, high: 7 },
    60: { min: 4, standard: 7.5, high: 10 },
  },
  "1080p": {
    24: { min: 4, standard: 8, high: 12 },
    30: { min: 4, standard: 8, high: 12 },
    60: { min: 6, standard: 12, high: 15 },
  },
  "1440p": {
    24: { min: 10, standard: 16, high: 24 },
    30: { min: 10, standard: 16, high: 24 },
    60: { min: 16, standard: 24, high: 30 },
  },
  "4k": {
    24: { min: 25, standard: 35, high: 45 },
    30: { min: 25, standard: 35, high: 45 },
    60: { min: 35, standard: 53, high: 68 },
  },
};

export const presets: {
  value: ExportSettings["preset"];
  label: string;
  description: string;
}[] = [
  {
    value: "fast",
    label: "Fast",
    description: "Good balance between quality and speed.",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Slightly better quality, slightly slower.",
  },
  {
    value: "slow",
    label: "Slow",
    description: "Higher quality, significantly slower.",
  },
];

export const crfValues: {
  value: ExportSettings["crf"];
  label: string;
  description: string;
}[] = [
  {
    value: 23,
    label: "23 (Default)",
    description: "Good quality for most uses.",
  },
  {
    value: 18,
    label: "18 (High Quality)",
    description: "Visually lossless or near-lossless.",
  },
  {
    value: 28,
    label: "28 (Lower Quality)",
    description: "More compression, lower file size.",
  },
];

export const fpsOptions: {
  value: ExportSettings["fps"];
  label: string;
  description: string;
}[] = [
  {
    value: 24,
    label: "24 FPS",
    description: "Cinematic look, smaller file size.",
  },
  { value: 30, label: "30 FPS", description: "Standard video frame rate." },
  {
    value: 60,
    label: "60 FPS",
    description: "Smoother motion, larger file size.",
  },
];

export const formatOptions: {
  value: ExportSettings["format"];
  label: string;
  description: string;
}[] = [
  {
    value: "mp4",
    label: "MP4",
    description: "Widely compatible video format.",
  },
  {
    value: "webm",
    label: "WebM",
    description: "Open-source format, good for web.",
  },
  {
    value: "mov",
    label: "MOV",
    description: "Apple QuickTime format, high quality.",
  },
];

export const resolutionOptions: {
  value: ExportSettings["resolution"];
  label: string;
  description: string;
}[] = [
  { value: "720p", label: "720p", description: "Standard HD (1280x720)" },
  { value: "1080p", label: "1080p", description: "Full HD (1920x1080)" },
  { value: "1440p", label: "1440p", description: "Quad HD (2560x1440)" },
  { value: "4k", label: "4K", description: "Ultra HD (3840x2160)" },
];

export const DEFAULT_COLORS = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#f59e0b",
  "#fbbf24",
  "#10b981",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
] as const;

export const DEFAULT_CLIP_METADATA = {
  dimensions: {
    width: 1920,
    height: 1080,
  },
  aspectRatio: DEFAULT_ASPECT_RATIO,
  cropMode: DEFAULT_CROP_MODE as CropMode,
  format: "mp4" as VideoFormat,
} as const;
