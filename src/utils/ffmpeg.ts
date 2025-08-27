import { FFmpeg, FileData } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import type {
  ClipOptions,
  ClipExportData,
  TextOverlay,
  ImageOverlay,
  ExportClip,
  CropMode,
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

function convertFileDataToUint8Array(fileData: FileData): Uint8Array {
  if (typeof fileData === "string") {
    return new TextEncoder().encode(fileData);
  }

  const arrayBuffer: ArrayBuffer = new ArrayBuffer(fileData.byteLength);
  const uint8Array = new Uint8Array(arrayBuffer);
  uint8Array.set(new Uint8Array(fileData));
  return uint8Array;
}

export async function processClip(
  clipData: ArrayBuffer,
  options: ClipOptions = {}
): Promise<Blob> {
  const ffmpeg = await initFFmpeg();

  const inputFileName = "input.webm";
  const outputFileName = "output.webm";

  await ffmpeg.writeFile(inputFileName, new Uint8Array(clipData));

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

  const uint8Array = convertFileDataToUint8Array(
    outputData
  ) as Uint8Array<ArrayBuffer>;
  return new Blob([uint8Array], { type: "video/webm" });
}

export async function processClipForExport(
  clip: ExportClip,
  data: ClipExportData
): Promise<Blob> {
  console.log("fit -----------------------");
  const ffmpeg = await initFFmpeg();

  console.log("fit ----------------------- after");

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

  console.log("outputdata----------", outputData);

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

function getAspectRatioFilter(
  width: number,
  height: number,
  cropMode: CropMode
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
