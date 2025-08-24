"server-only";

import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getAWSConfig } from "../config/aws-config";
import logger from "../utils/logger";

export interface ClipData {
  buffer: ArrayBuffer;
  metadata: {
    clipId: string;
    clipDurationMs: number;
    clipDurationSec: number;
    clipStartTime: number;
    clipEndTime: number;
    clipStartTimeIso: string;
    clipEndTimeIso: string;
    streamStartTime?: number;
    streamStartTimeIso?: string;
    clipExported: boolean;
    streamerName: string;
    uploadTimestamp: string;
    originalFilename: string;
    s3Key: string;
  };
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const config = getAWSConfig();
    s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3Client;
}

export async function getClip(referenceId: string): Promise<ClipData> {
  const config = getAWSConfig();
  const s3Client = getS3Client();

  try {
    const s3Key = config.folder
      ? `${config.folder}/${referenceId}.mp4`
      : `${referenceId}.mp4`;

    logger.log(`🔍 Looking up clip with key: ${s3Key}`);

    const headCommand = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
    });

    const headResponse = await s3Client.send(headCommand);
    const metadata = headResponse.Metadata || {};

    const getCommand = new GetObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
    });

    const s3Response = await s3Client.send(getCommand);
    if (!s3Response.Body) throw new Error("No response body");

    const uint8Array = await s3Response.Body.transformToByteArray();
    logger.log(`✅ Fetched clip from S3: ${uint8Array.length} bytes`);

    const buffer = uint8Array.buffer.slice(
      uint8Array.byteOffset,
      uint8Array.byteOffset + uint8Array.byteLength
    ) as ArrayBuffer;

    const clipMetadata = {
      clipId: metadata["clip-id"] || referenceId,
      clipDurationMs: parseInt(metadata["clip-duration-ms"] || "0"),
      clipDurationSec: parseFloat(metadata["clip-duration-sec"] || "0"),
      clipStartTime: parseInt(metadata["clip-start-time"] || "0"),
      clipEndTime: parseInt(metadata["clip-end-time"] || "0"),
      clipStartTimeIso:
        metadata["clip-start-time-iso"] || new Date().toISOString(),
      clipEndTimeIso: metadata["clip-end-time-iso"] || new Date().toISOString(),
      streamStartTime: metadata["stream-start-time"]
        ? parseInt(metadata["stream-start-time"])
        : undefined,
      streamStartTimeIso: metadata["stream-start-time-iso"],
      clipExported: metadata["clip-exported"] === "true",
      streamerName: metadata["streamer-name"] || "unknown",
      uploadTimestamp: metadata["upload-timestamp"] || new Date().toISOString(),
      originalFilename: metadata["original-filename"] || "",
      s3Key: s3Key,
    };

    return { buffer, metadata: clipMetadata };
  } catch (error) {
    logger.error("❌ S3 fetch error:", error);
    throw error;
  }
}

export async function listClips(): Promise<
  Array<{
    id: string;
    name: string;
    url: string;
    createdAt: string;
    duration: number;
    streamerName: string;
  }>
> {
  const config = getAWSConfig();
  const s3Client = getS3Client();

  try {
    logger.log("🔍 Scanning S3 bucket for clips...");

    const listCommand = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: config.folder || "",
      MaxKeys: 1000,
    });

    const response = await s3Client.send(listCommand);

    if (!response.Contents) {
      logger.log("📭 No clips found in S3 bucket");
      return [];
    }

    const clips: Array<{
      id: string;
      name: string;
      url: string;
      createdAt: string;
      duration: number;
      streamerName: string;
    }> = [];

    for (const object of response.Contents) {
      if (object.Key && object.Key.endsWith(".mp4")) {
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: config.bucket,
            Key: object.Key,
          });

          const headResponse = await s3Client.send(headCommand);
          const metadata = headResponse.Metadata || {};

          const referenceId =
            metadata["reference-id"] ||
            metadata["clip-id"] ||
            object.Key.replace(/\.mp4$/, "")
              .split("/")
              .pop() ||
            "unknown";

          const streamerName = metadata["streamer-name"] || "unknown";
          const uploadTimestamp =
            metadata["upload-timestamp"] ||
            object.LastModified?.toISOString() ||
            new Date().toISOString();

          const durationMs = parseInt(metadata["clip-duration-ms"] || "0");
          const filename =
            metadata["original-filename"] ||
            object.Key.split("/").pop() ||
            "clip.mp4";

          clips.push({
            id: referenceId,
            name: filename,
            url: `https://${config.bucket}.s3.${config.region}.amazonaws.com/${object.Key}`,
            createdAt: uploadTimestamp,
            duration: durationMs,
            streamerName,
          });
        } catch (error) {
          logger.warn(`⚠️ Failed to get metadata for ${object.Key}:`, error);
        }
      }
    }

    logger.log(`✅ Fetched ${clips.length} clips from S3`);
    return clips;
  } catch (error) {
    logger.error("❌ S3 list error:", error);
    return [];
  }
}

export async function getClipMetadata(referenceId: string): Promise<{
  success: boolean;
  metadata?: Record<string, string>;
  error?: string;
}> {
  const config = getAWSConfig();
  const s3Client = getS3Client();

  try {
    const s3Key = config.folder
      ? `${config.folder}/${referenceId}.mp4`
      : `${referenceId}.mp4`;

    const headCommand = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
    });

    const headResponse = await s3Client.send(headCommand);
    const metadata = headResponse.Metadata || {};

    return {
      success: true,
      metadata,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return { success: false, error: "Clip not found" };
    }
    logger.error("❌ Failed to get clip metadata:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function getClipUrl(referenceId: string): string {
  const config = getAWSConfig();
  const s3Key = config.folder
    ? `${config.folder}/${referenceId}.mp4`
    : `${referenceId}.mp4`;

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${s3Key}`;
}
