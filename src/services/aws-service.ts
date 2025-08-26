"server-only";

import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAWSConfig, PRESIGNED_URL_EXPIRES } from "@/config/aws-config";
import logger from "@/utils/logger";
import {
  S3ClipMetadata as ClipMetadata,
  S3ClipData as ClipData,
} from "@/types/app";

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

  const s3Key = config.folder
    ? `${config.folder}/${referenceId}.mp4`
    : `${referenceId}.mp4`;

  logger.log(`🔍 Generating pre-signed URL for key: ${s3Key}`);

  try {
    const headCommand = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
    });

    const [signedUrl, headResponse] = await Promise.all([
      getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: s3Key,
        }),
        { expiresIn: PRESIGNED_URL_EXPIRES }
      ),
      s3Client.send(headCommand),
    ]);

    const clipMetadata = parseClipMetadata(
      headResponse.Metadata || {},
      referenceId,
      s3Key
    );

    return { url: signedUrl, metadata: clipMetadata };
  } catch (error) {
    logger.error("❌ Failed to generate pre-signed URL:", error);
    throw error;
  }
}

export async function listClips(): Promise<ClipData[]> {
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

    const clips = await Promise.all(
      response.Contents.filter(
        (object) => object.Key && object.Key.endsWith(".mp4")
      ).map(async (object) => {
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: config.bucket,
            Key: object.Key!,
          });

          const headResponse = await s3Client.send(headCommand);
          const metadata = headResponse.Metadata || {};

          const referenceId = metadata["reference-id"] || object.Key!;
          const clipMetadata = parseClipMetadata(
            metadata,
            referenceId,
            object.Key!
          );

          const signedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: config.bucket,
              Key: object.Key!,
            }),
            { expiresIn: PRESIGNED_URL_EXPIRES }
          );

          return { url: signedUrl, metadata: clipMetadata } as ClipData;
        } catch (error) {
          logger.warn(`⚠️ Failed to get metadata for ${object.Key}:`, error);
          return null;
        }
      })
    );

    const validClips: ClipData[] = clips.filter(
      (c): c is ClipData => c !== null
    );

    logger.log(`✅ Fetched ${validClips.length} clips from S3`);
    return validClips;
  } catch (error) {
    logger.error("❌ S3 list error:", error);
    return [];
  }
}

function parseClipMetadata(
  metadata: Record<string, string> = {},
  referenceId: string,
  s3Key: string
): ClipMetadata {
  return {
    clipId: metadata["clip-id"] || referenceId,
    clipDurationMs: metadata["clip-duration-ms"]
      ? parseInt(metadata["clip-duration-ms"], 10)
      : 0,
    clipStartTime: metadata["clip-start-time"]
      ? parseInt(metadata["clip-start-time"], 10)
      : 0,
    clipEndTime: metadata["clip-end-time"]
      ? parseInt(metadata["clip-end-time"], 10)
      : 0,
    streamStartTime: metadata["stream-start-time"]
      ? parseInt(metadata["stream-start-time"], 10)
      : undefined,
    streamerName: metadata["streamer-name"],
    uploadTimestamp: metadata["upload-timestamp"],
    originalFilename: metadata["original-filename"],
    s3Key,
  };
}
