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
  s3Key: string;
}

export interface S3ClipData {
  url: string;
  metadata: S3ClipMetadata;
}

type OverlappingStyleProps =
  | "color"
  | "opacity"
  | "fontFamily"
  | "fontSize"
  | "letterSpacing"
  | "textAlign"
  | "backgroundColor";

export interface TextOverlay
  extends Partial<Omit<CSSProperties, OverlappingStyleProps>> {
  id: string;
  text: string;
  x: number; // Normalized 0–1 for export
  y: number; // Normalized 0–1 for export
  startTime: number;
  endTime: number;
  fontSize: number;
  fontFamily: string;
  letterSpacing: string;
  color: string;
  backgroundColor: string;
  opacity: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignment: "left" | "center" | "right";
  visible: boolean;
}

export interface ImageOverlay {
  id: string;
  file: File;
  x: number; // Normalized 0–1 for export
  y: number; // Normalized 0–1 for export
  startTime: number;
  endTime: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  rotation: number;
  scale: number;
}

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
