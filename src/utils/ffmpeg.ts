import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  ClipOptions,
  ClipExportData,
  TextOverlay,
  ExportClip,
  ClipResponse,
} from "@/types/app";
import { EXPORT_BITRATE_MAP } from "@/constants/app";
import logger from "./logger";

let ffmpeg: FFmpeg | null = null;

export const initFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

  const baseURL = "/ffmpeg";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
};

export async function processClipWithFFmpeg(
  clipData: ArrayBuffer,
  options: ClipOptions = {}
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();

  const inputFileName = "input.webm";
  const outputFileName = "output.webm";

  ffmpeg.writeFile(inputFileName, new Uint8Array(clipData));

  const args = ["-i", inputFileName, "-c", "copy"];

  if (options.convertAspectRatio && options.convertAspectRatio !== "original") {
    const [width, height] = options.convertAspectRatio.split(":").map(Number);
    const filter = getAspectRatioFilter(
      width,
      height,
      options.cropMode || "letterbox"
    );
    args.push("-vf", filter);
  }

  args.push(outputFileName);

  await ffmpeg.exec(args);
  const outputData = await ffmpeg.readFile(outputFileName);

  return new Blob([outputData], { type: "video/webm" });
}

export async function processClipForExport(
  clip: ExportClip,
  data: ClipExportData
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();

  const inputFileName = "input.webm";
  const outputFileName = `output.${data.exportSettings.format}`;

  ffmpeg.writeFile(inputFileName, new Uint8Array(clip.blob));

  const startSeconds = data.startTime / 1000;
  const duration = (data.endTime - data.startTime) / 1000;

  const args = [
    "-ss",
    startSeconds.toString(),
    "-i",
    inputFileName,
    "-t",
    duration.toString(),
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-preset",
    data.exportSettings.preset,
    "-crf",
    data.exportSettings.crf.toString(),
    "-r",
    data.exportSettings.fps.toString(),
    "-b:v",
    `${getBitrate(data.exportSettings)}k`,
  ];

  if (data.targetResolution) {
    args.push(
      "-s",
      `${data.targetResolution.width}x${data.targetResolution.height}`
    );
  }

  if (data.textOverlays && data.textOverlays.length > 0) {
    const overlayFrames = await generateOverlayFrames(data.textOverlays, data);
    const overlayDir = "overlay_frames";

    for (let i = 0; i < overlayFrames.length; i++) {
      ffmpeg.writeFile(
        `${overlayDir}/overlay_${i.toString().padStart(4, "0")}.png`,
        overlayFrames[i]
      );
    }

    args.push("-i", `${overlayDir}/overlay_%04d.png`);
    args.push(
      "-filter_complex",
      `[0:v][1:v]overlay=0:0:enable='between(t,0,${duration})'`
    );
  }

  args.push("-y", outputFileName);

  await ffmpeg.exec(args);
  const outputData = await ffmpeg.readFile(outputFileName);

  return new Blob([outputData], {
    type: `video/${data.exportSettings.format}`,
  });
}

async function generateOverlayFrames(
  overlays: TextOverlay[],
  data: ClipExportData
): Promise<Uint8Array[]> {
  const worker = new Worker(
    new URL("../workers/overlay-worker.ts", import.meta.url)
  );

  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.type === "frames") {
        resolve(e.data.frames);
      }
    };

    worker.onerror = reject;

    worker.postMessage({
      type: "generate",
      overlays,
      data,
    });
  });
}

function getAspectRatioFilter(
  width: number,
  height: number,
  cropMode: string
): string {
  const ratio = width / height;

  switch (cropMode) {
    case "letterbox":
      return `scale='if(gt(a,${ratio}),${width},-1)':'if(gt(a,${ratio}),-1,${height})',pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
    case "crop":
      return `scale=-1:${height},crop=${width}:${height}`;
    case "stretch":
      return `scale=${width}:${height}`;
    default:
      return `scale=${width}:${height}`;
  }
}

function getBitrate(settings: ClipExportData["exportSettings"]): number {
  const resolutionBitrates = EXPORT_BITRATE_MAP[settings.resolution];
  const fpsBitrates = resolutionBitrates
    ? resolutionBitrates[settings.fps]
    : undefined;

  if (
    settings.bitrate === "custom" &&
    settings.customBitrateKbps !== undefined
  ) {
    return settings.customBitrateKbps;
  } else if (settings.bitrate === "high") {
    return fpsBitrates?.high || 12000;
  } else if (settings.bitrate === "min") {
    return fpsBitrates?.min || 4000;
  } else {
    return fpsBitrates?.standard || 8000;
  }
}

export async function remuxClip(
  chunks: Blob[],
  startMs: number,
  endMs: number
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("remuxClip can only be called on the client side");
  }

  const ffmpeg = await initFFmpeg();

  logger.log("🧩 remuxClip: startMs =", startMs, "endMs =", endMs);

  const inputBlob = new Blob(chunks, { type: "video/webm" });
  const inputFileName = "input.webm";
  const outputFileName = "output.webm";

  ffmpeg.writeFile(inputFileName, await fetchFile(inputBlob));

  const startSec = (startMs / 1000).toFixed(3);
  const durationSec = ((endMs - startMs) / 1000).toFixed(3);

  logger.log(
    `🔧 remuxClip: ffmpeg.exec with -ss ${startSec}, -t ${durationSec}`
  );

  await ffmpeg.exec([
    "-i",
    inputFileName,
    "-ss",
    startSec,
    "-t",
    durationSec,
    "-c",
    "copy",
    outputFileName,
  ]);

  logger.log("✅ remuxClip: ffmpeg.exec completed");

  const outputData = await ffmpeg.readFile(outputFileName);
  logger.log("📦 remuxClip: outputData length =", outputData.length);

  return new Blob([outputData], { type: "video/webm" });
}
