import { FFmpeg, FileData } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import type {
  ClipOptions,
  ClipExportData,
  TextOverlay,
  ImageOverlay,
  ExportClip,
} from "@/types/app";
import { EXPORT_BITRATE_MAP } from "@/constants/app";
import { WorkerType } from "@/types/app";
import logger from "./logger";

let ffmpeg: FFmpeg | null = null;

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
  options: ClipOptions = {},
  videoDimensions: { width: number; height: number }
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();

  const inputFileName = "input.webm";
  const outputFileName = "output.webm";

  await ffmpeg.writeFile(inputFileName, new Uint8Array(clipData));

  let args: string[] = [];

  if (options.convertAspectRatio && options.convertAspectRatio !== "original") {
    const { width: _, height: inputH } = videoDimensions;

    const [targetW, targetH] = options.convertAspectRatio
      .split(":")
      .map(Number);
    const targetRatio = targetW / targetH;

    let filterArgs: string[] = [];
    switch (options.cropMode) {
      case "letterbox": {
        const padW = Math.round(inputH * targetRatio);
        const padH = inputH;
        const scaleExpr = `scale='if(gt(a,${targetRatio}),${padW},-1)':'if(gt(a,${targetRatio}),-1,${padH})'`;
        const padExpr = `pad=${padW}:${padH}:(ow-iw)/2:(oh-ih)/2:color=white`;
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
      "-c:a",
      "copy",
      "-y",
      outputFileName,
    ];
  } else {
    args = ["-i", inputFileName, "-c", "copy", outputFileName];
  }

  try {
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputFileName);
    const blob = new Blob([data], { type: "video/webm" });

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
  clip: ExportClip,
  data: ClipExportData
): Promise<Blob> {
  // console.log("fit -----------------------");
  const ffmpeg = await initFFmpeg();

  // console.log("fit ----------------------- after");

  const inputFileName = "input.webm";
  const outputFileName = `output.${data.exportSettings.format}`;

  await ffmpeg.writeFile(inputFileName, new Uint8Array(clip.blob));

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
    logger.log("Generating text overlay frames...");
    const overlayFrames = await generateOverlayFrames(
      data.textOverlays,
      data.imageOverlays || [],
      data
    );
    const overlayDir = "overlay_frames";

    for (let i = 0; i < overlayFrames.length; i++) {
      await ffmpeg.writeFile(
        `${overlayDir}/overlay_${i.toString().padStart(4, "0")}.png`,
        overlayFrames[i]
      );
    }

    args.push("-i", `${overlayDir}/overlay_%04d.png`);
    args.push(
      "-filter_complex",
      `[0:v][1:v]overlay=0:0:enable='between(t,0,${duration})'`
    );
  } else if (data.imageOverlays && data.imageOverlays.length > 0) {
    logger.log("Generating image overlay frames...");

    const overlayFrames = await generateOverlayFrames(
      [],
      data.imageOverlays,
      data
    );
    const overlayDir = "overlay_frames";

    for (let i = 0; i < overlayFrames.length; i++) {
      await ffmpeg.writeFile(
        `${overlayDir}/overlay_${i.toString().padStart(4, "0")}.png`,
        overlayFrames[i]
      );
    }

    args.push("-i", `${overlayDir}/overlay_%04d.png`);
    args.push(
      "-filter_complex",
      `[0:v][1:v]overlay=0:0:enable='between(t,0,${duration})'`
    );
  } else {
    logger.log(
      "No text or image overlays provided, skipping overlay generation."
    );
  }

  args.push("-y", outputFileName);

  await ffmpeg.exec(args);
  const outputData = await ffmpeg.readFile(outputFileName);

  const uint8Array = convertFileDataToUint8Array(
    outputData
  ) as Uint8Array<ArrayBuffer>;
  return new Blob([uint8Array], {
    type: `video/${data.exportSettings.format}`,
  });
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
    worker.onmessage = (e) => {
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

function convertFileDataToUint8Array(fileData: FileData): Uint8Array {
  if (typeof fileData === "string") {
    return new TextEncoder().encode(fileData);
  }

  const arrayBuffer: ArrayBuffer = new ArrayBuffer(fileData.byteLength);
  const uint8Array = new Uint8Array(arrayBuffer);
  uint8Array.set(new Uint8Array(fileData));
  return uint8Array;
}

async function getVideoDimensions(ffmpeg: FFmpeg, fileName: string) {
  let dimensions = { width: 0, height: 0 };

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
