import { AspectRatioValue } from "@/components/aspect-ratio-selector";
import type { Color } from "@/components/color-palette";

/**
 * Represents a marked clip segment in the recording.
 */
export interface ClipMarker {
  id: string;
  startTime: number;
  endTime: number;
  markedAt: number;
  streamStart: number;
  exported?: boolean;
}

export interface S3ClipMetadata {
  clipId: string;
  clipDurationMs: number;
  clipStartTime: number;
  clipEndTime: number;
  streamStartTime?: number;
  streamerName?: string;
  uploadTimestamp?: string;
  originalFilename?: string;
}

export type Dimensions = { width: number; height: number };

export type ClipToolType = "clips" | "text" | "image" | "audio" | "dual";

export interface S3ClipData {
  url: string;
  metadata: S3ClipMetadata;
}

export interface BaseOverlay {
  id: string;
  x: number;
  y: number;
  normX: number;
  normY: number;
  startTime: number;
  endTime: number;
  opacity: number;
  visible: boolean;
}

export interface TextOverlay extends BaseOverlay {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  letterSpacing: string;
  color: string;
  backgroundColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignment: "left" | "center" | "right";
  maxWidth: string;
  // 9:16 dimensions for dual video player
  dualX: number;
  dualY: number;
  dualNormX: number;
  dualNormY: number;
  dualMaxWidth: string;
}

export interface ImageOverlay extends BaseOverlay {
  type: "image";
  file: File;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  // 9:16 dimensions for dual video player
  dualX: number;
  dualY: number;
  dualNormX: number;
  dualNormY: number;
  dualWidth: number;
  dualHeight: number;
}

export type Overlay = TextOverlay | ImageOverlay;

export interface AudioTrack {
  id: string;
  name: string;
  file: File | null;
  url?: string;
  volume: number;
  startTime: number;
  endTime: number;
  visible: boolean;
}

export type CropMode = "letterbox" | "crop";
export type VideoFormat = "mp4" | "webm" | "mov";

export type Settings = {
  aspectRatio: AspectRatioValue;
  cropMode: CropMode;
  padColor: Color;
  format: VideoFormat;
};

export interface ExportSettings {
  format: VideoFormat;
  resolution: "720p" | "1080p" | "1440p" | "4k";
  fps: 24 | 30 | 60;
  bitrate: "recommended" | "high" | "min" | "custom";
  customBitrateKbps?: number;
  preset:
    | "ultrafast"
    | "superfast"
    | "veryfast"
    | "faster"
    | "fast"
    | "medium"
    | "slow"
    | "slower"
    | "veryslow";
  crf: number;
  convertAspectRatio?: string;
  cropMode?: CropMode;
  audioBitrateKbps?: number; // when applicable (e.g., AAC/Opus)
  audioCompressed?: boolean; // for MOV: false = PCM (default), true = AAC
}

export interface ClipMetadata extends Settings {
  dimensions: {
    width: number;
    height: number;
  };
}

export type DualVideoLayout = "vertical-letterbox" | "vertical-crop" | "pip";
export type PiPPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
export type AudioMixMode = "primary" | "secondary" | "mixed";

export interface DualVideoSettings {
  layout: DualVideoLayout;
  primaryAudio: AudioMixMode;
  normalizeAudio: boolean;
  primaryVolume: number;
  secondaryVolume: number;
  // Picture-in-Picture specific settings
  pipPosition?: PiPPosition;
  pipSize?: number; // 0.2 to 0.4 (20% to 40% of container width)
  // Time synchronization
  secondaryOffset?: number; // milliseconds, positive = delay secondary, negative = advance secondary
}

export interface DualVideoClip {
  id: string;
  url: string;
  buffer: ArrayBuffer | null;
  metadata: S3ClipMetadata;
  timelineOffset: number; // When this clip starts on the timeline (milliseconds from timeline start)
  trimStart: number; // Where to start within this clip's source video (milliseconds)
  trimEnd: number; // Where to end within this clip's source video (milliseconds)
  visible: boolean; // Whether this clip should be included in export
}

export type TrimData = Pick<
  DualVideoClip,
  "timelineOffset" | "trimStart" | "trimEnd"
>; // in ms

/**
 * Information required to export a clip.
 */
export interface ClipExportData {
  id: string;
  outputName: string;
  textOverlays?: TextOverlay[];
  imageOverlays?: ImageOverlay[];
  audioTracks?: AudioTrack[];
  exportSettings: ExportSettings;
  clientDisplaySize: Dimensions;
  targetResolution?: Dimensions;
  dualVideo?: {
    primaryClip: DualVideoClip & ClipMetadata;
    secondaryClip?: DualVideoClip & ClipMetadata;
    settings: DualVideoSettings;
  };
}

/**
 * Active recording session details.
 */
export interface StreamSession {
  startTime: number;
  sourceId: string;
}

export interface RecordingStartedInfo {
  sourceId: string;
  startTime: number;
}

/**
 * Types for desktop source metadata.
 */
export interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface ExportProgressInfo {
  clipId: string;
  progress: string;
}

/**
 * Represents a single recorded media chunk with a timestamp.
 */
export interface RecordedChunk {
  data: Blob;
  timestamp: number;
}

export interface FontDefinition {
  family: string;
  weight?: FontWeight;
  style?: FontStyle;
  path: string;
}

export type FontWeight =
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "normal";

export type FontStyle = "normal" | "italic" | "oblique";

export interface ClipResponse {
  success: boolean;
  blob?: Uint8Array;
  error?: string;
}

export type Success<T> = {
  status: "success";
  data: T;
};

export type Failure<E> = {
  status: "error";
  error: E;
};

export enum WorkerType {
  GENERATE = "generate",
  FRAMES = "frames",
}

export interface WorkerMessage {
  type: WorkerType.GENERATE;
  textOverlays?: TextOverlay[];
  imageOverlays?: ImageOverlay[];
  data: ClipExportData;
}

export interface WorkerResponse {
  type: WorkerType.FRAMES;
  frames: Uint8Array[];
}
