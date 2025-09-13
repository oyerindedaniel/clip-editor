import { CSSProperties } from "react";

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
  volume: number;
  startTime: number;
  endTime: number;
  visible: boolean;
}

export type CropMode = "letterbox" | "crop" | "stretch";

export interface ExportSettings {
  format: "mp4" | "webm" | "mov";
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
}

/**
 * Information required to export a clip.
 */
export interface ClipExportData {
  id: string;
  startTime: number;
  endTime: number;
  outputName: string;
  textOverlays?: TextOverlay[];
  imageOverlays?: ImageOverlay[];
  audioTracks?: AudioTrack[];
  exportSettings: ExportSettings;
  clientDisplaySize: { width: number; height: number };
  targetResolution?: { width: number; height: number };
  dualVideo?: {
    primaryClip: DualVideoClip;
    secondaryClip: DualVideoClip;
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

export interface ClipMetadata {
  aspectRatio: string;
  cropMode: CropMode;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface ExportClip {
  blob: ArrayBuffer;
  metadata: ClipMetadata | null;
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

export interface ClipOptions {
  convertAspectRatio?: string;
  cropMode?: "letterbox" | "crop" | "stretch";
}

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

export interface DualVideoClip {
  id: string;
  url: string;
  buffer: ArrayBuffer | null;
  metadata: S3ClipMetadata;
  offset: number; // Time offset in milliseconds
  volume: number; // Audio volume level (0-1)
  visible: boolean;
}

export type DualVideoLayout = "vertical" | "horizontal";
export type DualVideoOrientation = "vertical" | "horizontal";

export interface DualVideoSettings {
  layout: DualVideoLayout;
  outputOrientation: DualVideoOrientation;
  primaryAudio: "primary" | "secondary" | "mixed";
  normalizeAudio: boolean;
  primaryVolume: number;
  secondaryVolume: number;
}
