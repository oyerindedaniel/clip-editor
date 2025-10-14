import { DEFAULT_CLIP_METADATA } from "@/constants/app";
import type {
  Dimensions,
  ExportSettings,
  Overlay,
  Settings,
} from "@/types/app";
import { ASPECT_RATIOS, AspectRatio } from "./aspect-ratios";

/**
 * Calculate the visible bounding box of a video element inside its container.
 *
 * @param video - The HTMLVideoElement
 * @returns Bounding box { x, y, width, height } relative to the video element's container
 */
function getVideoBoundingBox(video: HTMLVideoElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const playerWidth = video.clientWidth;
  const playerHeight = video.clientHeight;
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  const playerRatio = playerWidth / playerHeight;
  const videoRatio = videoWidth / videoHeight;

  let width: number;
  let height: number;
  let x: number;
  let y: number;

  if (videoRatio < playerRatio) {
    height = playerHeight;
    width = height * videoRatio;
    x = (playerWidth - width) / 2;
    y = 0;
  } else if (videoRatio > playerRatio) {
    width = playerWidth;
    height = width / videoRatio;
    x = 0;
    y = (playerHeight - height) / 2;
  } else {
    width = playerWidth;
    height = playerHeight;
    x = 0;
    y = 0;
  }

  return { x, y, width, height };
}

/**
 * Convert overlay DOM position to normalized (0–1) coordinates
 * relative to the intrinsic video frame.
 *
 * @param video - HTML video element
 * @param position - Overlay position relative to video element
 * @returns Normalized { x, y } in intrinsic video coordinate space
 */
function getOverlayNormalizedCoords(
  video: HTMLVideoElement,
  position: { overlayX: number; overlayY: number }
): { x: number; y: number } {
  const { overlayX, overlayY } = position;
  const {
    x: frameX,
    y: frameY,
    width: frameW,
    height: frameH,
  } = getVideoBoundingBox(video);

  // Convert from absolute overlay offset → relative to video frame
  const relativeX = overlayX - frameX;
  const relativeY = overlayY - frameY;

  // Normalize to the intrinsic video frame (clamped between 0 and 1)
  const x = Math.max(0, Math.min(1, relativeX / frameW));
  const y = Math.max(0, Math.min(1, relativeY / frameH));

  return { x, y };
}

/**
 * Calculates the target video dimensions (width and height) based on a given resolution string (e.g., "1080p", "4k")
 * and the aspect ratio of the original video. It prioritizes the height from the resolution string
 * and derives the width to maintain the aspect ratio.
 *
 * @param resolution - The target resolution string (e.g., "720p", "1080p", "1440p", "4k").
 * @param aspectRatio - The aspect ratio of the original video (width / height).
 * @returns An object containing the calculated width and height.
 */
function getTargetVideoDimensions(
  resolution: ExportSettings["resolution"],
  aspectRatio: number
): Dimensions {
  let targetHeight: number;

  switch (resolution) {
    case "720p":
      targetHeight = 720;
      break;
    case "1080p":
      targetHeight = 1080;
      break;
    case "1440p":
      targetHeight = 1440;
      break;
    case "4k":
      targetHeight = 2160; // 4K resolution is 3840x2160 (height)
      break;
    default:
      targetHeight = 1080; // Default to 1080p if unrecognized
  }

  const targetWidth = Math.round(targetHeight * aspectRatio);

  // Ensure width is an even number, which is often required by video encoders
  return {
    width: targetWidth % 2 === 0 ? targetWidth : targetWidth + 1,
    height: targetHeight,
  };
}

function getExtensionFromMime(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime") || mime.includes("mov")) return "mov";
  return "mp4";
}

function getFormatFromSrc(src: string): "mp4" | "webm" | "mov" {
  const match = src.match(/\.(mp4|webm|mov)(\?|#|$)/i);
  if (match) {
    return match[1].toLowerCase() as "mp4" | "webm" | "mov";
  }
  return "mp4";
}

function msToSeconds(ms: number): number {
  return ms / 1000;
}

function getVisibleOverlays(overlays: Overlay[], currentTimeMs: number) {
  return overlays.filter(
    (overlay) =>
      overlay.visible &&
      currentTimeMs >= overlay.startTime &&
      currentTimeMs <= overlay.endTime
  );
}

function getBufferKey(settings: Settings) {
  const aspectRatio = settings.aspectRatio || "original";
  const cropMode = settings.cropMode || "none";
  const padColor = settings.padColor || "white";
  const format = settings.format || "mp4";

  return `${aspectRatio}-${cropMode}-${padColor}-${format}`;
}

function getOriginalBufferKey(): string {
  return getBufferKey(DEFAULT_CLIP_METADATA);
}

function calculateAspectRatioScale(base: AspectRatio, target: AspectRatio) {
  const baseRatio = ASPECT_RATIOS[base];
  const targetRatio = ASPECT_RATIOS[target];

  const scale = targetRatio / baseRatio;
  const baseOrientation =
    baseRatio > 1 ? "landscape" : baseRatio < 1 ? "portrait" : "square";
  const targetOrientation =
    targetRatio > 1 ? "landscape" : targetRatio < 1 ? "portrait" : "square";

  let mode: "letterbox" | "crop" | "stretch";
  if (baseRatio === targetRatio) {
    mode = "stretch";
  } else if (
    (baseRatio > targetRatio && baseOrientation === "landscape") ||
    (baseRatio < targetRatio && baseOrientation === "portrait")
  ) {
    mode = "crop";
  } else {
    mode = "letterbox";
  }

  return {
    baseRatio,
    targetRatio,
    baseOrientation,
    targetOrientation,
    scale,
    mode,
  };
}

export {
  getVideoBoundingBox,
  getOverlayNormalizedCoords,
  getTargetVideoDimensions,
  getExtensionFromMime,
  getFormatFromSrc,
  getVisibleOverlays,
  msToSeconds,
  getBufferKey,
  getOriginalBufferKey,
  calculateAspectRatioScale,
};
