import { FFmpeg, FileData } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import type {
  Settings,
  ClipExportData,
  TextOverlay,
  ImageOverlay,
  WorkerResponse,
  VideoFormat,
  Dimensions,
} from "@/types/app";
import { EXPORT_BITRATE_MAP } from "@/constants/app";
import { WorkerType } from "@/types/app";
import logger from "./logger";

let ffmpeg: FFmpeg | null = null;

type ProgressListener = (progress: number, time?: number) => void;
const progressListeners = new Set<ProgressListener>();

export function onFFmpegProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export const initFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ type, message }) => {
    logger.log(`[FFmpeg ${type}] ${message}`);
  });

  ffmpeg.on("progress", ({ progress, time }) => {
    logger.log(
      `FFmpeg progress: ${(progress * 100).toFixed(2)}% (time: ${time}s)`
    );
    progressListeners.forEach((cb) => {
      try {
        cb(progress ?? 0, time);
      } catch {}
    });
  });

  // const baseURL = "/ffmpeg";

  const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
};

export async function processClip(
  clipData: ArrayBuffer,
  options: Settings,
  videoDimensions: Dimensions
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();

  const inputFileName = "input.mp4";

  const outputExt = options.format ?? "mp4";
  const outputFileName = `output.${outputExt}`;

  const clonedInput = (clipData as ArrayBuffer).slice(0);
  await ffmpeg.writeFile(inputFileName, new Uint8Array(clonedInput));

  let args: string[] = [];

  if (options.aspectRatio && options.aspectRatio !== "original") {
    const { width: _, height: inputH } = videoDimensions;

    const [targetW, targetH] = options.aspectRatio.split(":").map(Number);
    const targetRatio = targetW / targetH;

    let filterArgs: string[] = [];
    switch (options.cropMode) {
      case "letterbox": {
        const padW = Math.round(inputH * targetRatio);
        const padH = inputH;
        const scaleExpr = `scale='if(gt(a,${targetRatio}),${padW},-1)':'if(gt(a,${targetRatio}),-1,${padH})'`;
        const padColor = options.padColor || "white";
        const padExpr = `pad=${padW}:${padH}:(ow-iw)/2:(oh-ih)/2:color=${padColor}`;
        filterArgs = ["-vf", `${scaleExpr},${padExpr}`];

        logger.log("📐 Letterbox scale and pad expressions:", {
          scaleExpr,
          padExpr,
        });

        break;
      }
      case "crop": {
        const cropW = Math.round(inputH * targetRatio);
        const cropH = inputH;
        const scaleExpr = `scale=-1:${cropH}`;
        const cropExpr = `crop=${cropW}:${cropH}`;
        filterArgs = ["-vf", `${scaleExpr},${cropExpr}`];
        break;
      }
      case "stretch": {
        const stretchW = Math.round(inputH * targetRatio);
        const stretchH = inputH;
        filterArgs = ["-vf", `scale=${stretchW}:${stretchH}`];
        break;
      }
    }

    args = [
      "-i",
      inputFileName,
      ...filterArgs,
      ...getCodecArgs(outputExt),
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-y",
      outputFileName,
    ];
  } else {
    args = ["-i", inputFileName, "-c", "copy", outputFileName];
  }

  try {
    await ffmpeg.exec(args);
    const outputData = (await ffmpeg.readFile(outputFileName)) as any;

    const blob = new Blob([outputData], { type: "video/webm" });

    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    return blob;
  } catch (error) {
    logger.error("FFmpeg processing failed:", error);

    try {
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);
    } catch (cleanupError) {}

    throw error;
  }
}

export async function processClipForExport(
  data: ClipExportData
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();

  const { dualVideo, exportSettings, targetResolution } = data;
  const { primaryClip } = dualVideo ?? {};

  if (!primaryClip?.buffer) {
    throw new Error("No valid primary clip buffer found for export.");
  }

  const inputExt = primaryClip.format ?? "mp4";
  const inputFileName = `input.${inputExt}`;

  const format = exportSettings.format;
  const outputFileName = `output.${format}`;

  let overlayDir: string | null = null;

  const renderDimensions = targetResolution || primaryClip.dimensions;

  try {
    const clonedExportInput = primaryClip.buffer.slice(0);
    await ffmpeg.writeFile(inputFileName, new Uint8Array(clonedExportInput));

    const primaryDuration =
      (primaryClip.trimEnd - primaryClip.trimStart) / 1000;
    const primaryStartSeconds = primaryClip.trimStart / 1000;

    const args: string[] = [
      "-ss",
      primaryStartSeconds.toString(),
      "-i",
      inputFileName,
      "-t",
      primaryDuration.toString(),
    ];

    const textOverlays = data.textOverlays ?? [];
    const imageOverlays = data.imageOverlays ?? [];
    const hasText = textOverlays.length > 0;
    const hasImage = imageOverlays.length > 0;

    if (hasText || hasImage) {
      const overlayFrames = await generateOverlayFrames(
        textOverlays,
        imageOverlays,
        data
      );

      overlayDir = `overlay_frames_${Date.now()}`;
      await ffmpeg.createDir(overlayDir);

      for (let i = 0; i < overlayFrames.length; i++) {
        const frameData = new Uint8Array(overlayFrames[i]);
        await ffmpeg.writeFile(
          `${overlayDir}/overlay_${i.toString().padStart(4, "0")}.png`,
          frameData
        );
      }

      args.push("-i", `${overlayDir}/overlay_%04d.png`);

      args.push(
        "-filter_complex",
        `[0:v]scale=${renderDimensions.width}:${renderDimensions.height}[scaled];` +
          `[scaled][1:v]overlay=0:0:enable='between(t,0,${primaryDuration})'[v]`
      );

      args.push("-map", "[v]");
      args.push("-map", "0:a?");
    }

    const codecArgs = getCodecArgs(format);

    args.push(...codecArgs);
    args.push(
      "-preset",
      exportSettings.preset,
      "-crf",
      exportSettings.crf.toString(),
      "-r",
      exportSettings.fps.toString(),
      "-b:v",
      `${getBitrate(exportSettings)}k`
    );

    args.push("-y", outputFileName);

    await ffmpeg.exec(args);
    const outputData = (await ffmpeg.readFile(outputFileName)) as any;

    return new Blob([outputData], {
      type: `video/${format}`,
    });
  } catch (error) {
    logger.error("Export failed:", error);
    throw error;
  } finally {
    try {
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);

      if (overlayDir) {
        try {
          const files = await ffmpeg.listDir(overlayDir);
          for (const file of files) {
            await ffmpeg.deleteFile(`${overlayDir}/${file.name}`);
          }
        } catch (cleanupError) {
          logger.warn("Failed to cleanup overlay directory:", cleanupError);
        }
      }
    } catch (generalCleanupError) {
      logger.warn("Failed to cleanup files:", generalCleanupError);
    }
  }
}

async function generateOverlayFrames(
  textOverlays: TextOverlay[],
  imageOverlays: ImageOverlay[],
  data: ClipExportData
): Promise<Uint8Array[]> {
  const worker = new Worker(
    new URL("../workers/overlay-worker.ts", import.meta.url)
  );

  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === WorkerType.FRAMES) {
        resolve(e.data.frames);
      }
    };

    worker.onerror = reject;

    worker.postMessage({
      type: WorkerType.GENERATE,
      textOverlays,
      imageOverlays,
      data,
    });
  });
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

function getCodecArgs(format: VideoFormat): string[] {
  switch (format) {
    case "mp4":
      return ["-c:v", "libx264", "-c:a", "aac"];
    case "mov":
      return ["-c:v", "prores_ks", "-c:a", "pcm_s16le"];
    case "webm":
      return ["-c:v", "libvpx-vp9", "-c:a", "libopus"];
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

function convertFileDataToUint8Array(fileData: FileData): Uint8Array {
  if (typeof fileData === "string") {
    return new TextEncoder().encode(fileData);
  }

  const arrayBuffer: ArrayBuffer = new ArrayBuffer(fileData.byteLength);
  const uint8Array = new Uint8Array(arrayBuffer);
  uint8Array.set(new Uint8Array(fileData));
  return uint8Array;
}

export async function getVideoDimensions(ffmpeg: FFmpeg, fileName: string) {
  const dimensions = { width: 0, height: 0 };

  const logHandler = ({ message }: { message: string }) => {
    const match = message.match(/Video:.*?(\d+)x(\d+)/);
    if (match) {
      dimensions.width = parseInt(match[1]);
      dimensions.height = parseInt(match[2]);
    }
  };

  ffmpeg.on("log", logHandler);

  try {
    await ffmpeg.exec(["-i", fileName, "-t", "0.001", "-f", "null", "-"]);
  } catch {
  } finally {
    ffmpeg.off("log", logHandler);
  }

  return dimensions;
}
