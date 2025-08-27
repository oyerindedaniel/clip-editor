import type {
  TextOverlay,
  ImageOverlay,
  ClipExportData,
  WorkerMessage,
  WorkerResponse,
} from "@/types/app";
import logger from "@/utils/logger";
import { WorkerType } from "@/types/app";

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === WorkerType.GENERATE) {
    try {
      const frames = await generateOverlayFrames(
        e.data.textOverlays,
        e.data.imageOverlays,
        e.data.data
      );
      const response: WorkerResponse = {
        type: WorkerType.FRAMES,
        frames,
      };
      self.postMessage(response);
    } catch (error) {
      logger.error("Overlay worker error:", error);
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

async function generateOverlayFrames(
  textOverlays: TextOverlay[] | undefined,
  imageOverlays: ImageOverlay[] | undefined,
  data: ClipExportData
): Promise<Uint8Array[]> {
  const { exportSettings, clientDisplaySize, targetResolution } = data;

  if (!data.targetResolution || !clientDisplaySize) {
    throw new Error("Missing target resolution or client display size");
  }

  const totalFrames = Math.ceil(
    ((data.endTime - data.startTime) / 1000) * exportSettings.fps
  );
  const renderDimensions = targetResolution!;
  const { width: renderWidth, height: renderHeight } = renderDimensions;

  const canvas = new OffscreenCanvas(renderWidth, renderHeight);
  const ctx = canvas.getContext("2d")!;

  const scaleFactor = calculateScaleFactor(
    { width: renderWidth, height: renderHeight },
    clientDisplaySize
  );

  logger.log("🧠 Generating overlay frames", {
    totalFrames,
    fps: exportSettings.fps,
    duration: (data.endTime - data.startTime) / 1000,
    dimensions: renderDimensions,
    clientDisplaySize,
    scaleFactor,
  });

  // Calculate transition points where overlay visibility changes
  const transitionPoints = new Set<number>();

  if (textOverlays) {
    textOverlays.forEach((overlay) => {
      const startFrame = Math.max(
        0,
        Math.floor((overlay.startTime / 1000) * exportSettings.fps)
      );
      const endFrame = Math.min(
        totalFrames - 1,
        Math.ceil((overlay.endTime / 1000) * exportSettings.fps)
      );

      transitionPoints.add(startFrame);
      transitionPoints.add(endFrame + 1); // Frame after end
    });
  }

  if (imageOverlays) {
    imageOverlays.forEach((overlay) => {
      const startFrame = Math.max(
        0,
        Math.floor((overlay.startTime / 1000) * exportSettings.fps)
      );
      const endFrame = Math.min(
        totalFrames - 1,
        Math.ceil((overlay.endTime / 1000) * exportSettings.fps)
      );

      transitionPoints.add(startFrame);
      transitionPoints.add(endFrame + 1); // Frame after end
    });
  }

  // Includes first and last frame
  transitionPoints.add(0);
  transitionPoints.add(totalFrames - 1);

  const transitionArray = Array.from(transitionPoints).sort((a, b) => a - b);
  logger.log("🔑 Transition points identified:", transitionArray);

  // Unique overlay states
  const overlayStates = new Map<string, Uint8Array>();

  for (const frameIndex of transitionArray) {
    if (frameIndex >= totalFrames) continue;

    const currentTimeMs = (frameIndex / exportSettings.fps) * 1000;

    ctx.clearRect(0, 0, renderWidth, renderHeight);

    const visibleOverlays = [];

    if (textOverlays) {
      visibleOverlays.push(
        ...textOverlays.filter(
          (overlay) =>
            overlay.visible &&
            currentTimeMs >= overlay.startTime &&
            currentTimeMs <= overlay.endTime
        )
      );
    }

    if (imageOverlays) {
      visibleOverlays.push(
        ...imageOverlays.filter(
          (overlay) =>
            overlay.visible &&
            currentTimeMs >= overlay.startTime &&
            currentTimeMs <= overlay.endTime
        )
      );
    }

    // State key based on visible overlays
    const stateKey = visibleOverlays
      .map((o) => {
        if ("text" in o) {
          return `${o.text}-${o.x}-${o.y}-${o.startTime}-${o.endTime}`;
        } else if ("file" in o) {
          return `${o.file.name}-${o.x}-${o.y}-${o.startTime}-${o.endTime}`;
        }
        return "unknown";
      })
      .join("|");

    // Only generate new buffer if state hasn't been seen before
    if (!overlayStates.has(stateKey)) {
      // Render overlays
      visibleOverlays.forEach((overlay) => {
        if ("text" in overlay) {
          renderTextOverlay(
            canvas,
            ctx,
            overlay,
            renderDimensions,
            scaleFactor,
            targetResolution
          );
        } else if ("file" in overlay) {
          renderImageOverlay(
            canvas,
            ctx,
            overlay,
            renderDimensions,
            scaleFactor,
            targetResolution
          );
        }
      });

      const frameBuffer = await canvas.convertToBlob({ type: "image/png" });
      const arrayBuffer = await frameBuffer.arrayBuffer();
      overlayStates.set(stateKey, new Uint8Array(arrayBuffer));

      logger.log(
        `🎨 Generated unique overlay state: ${stateKey.substring(0, 50)}...`
      );
    }
  }

  logger.log(`📊 Generated ${overlayStates.size} unique overlay states`);

  // Map each frame to its appropriate overlay state
  let currentTransitionIndex = 0;
  const frames: Uint8Array[] = [];

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    // Check if we need to move to next transition
    if (
      currentTransitionIndex < transitionArray.length - 1 &&
      frameIndex >= transitionArray[currentTransitionIndex + 1]
    ) {
      currentTransitionIndex++;
    }

    const currentTimeMs = (frameIndex / exportSettings.fps) * 1000;
    const visibleOverlays = [];

    if (textOverlays) {
      visibleOverlays.push(
        ...textOverlays.filter(
          (overlay) =>
            overlay.visible &&
            currentTimeMs >= overlay.startTime &&
            currentTimeMs <= overlay.endTime
        )
      );
    }

    if (imageOverlays) {
      visibleOverlays.push(
        ...imageOverlays.filter(
          (overlay) =>
            overlay.visible &&
            currentTimeMs >= overlay.startTime &&
            currentTimeMs <= overlay.endTime
        )
      );
    }

    const stateKey = visibleOverlays
      .map((o) => {
        if ("text" in o) {
          return `${o.text}-${o.x}-${o.y}-${o.startTime}-${o.endTime}`;
        } else if ("file" in o) {
          return `${o.file.name}-${o.x}-${o.y}-${o.startTime}-${o.endTime}`;
        }
        return "unknown";
      })
      .join("|");

    const frameBuffer = overlayStates.get(stateKey);

    if (frameBuffer) {
      frames.push(frameBuffer);
    }

    // Log progress every 60 frames
    if (frameIndex % 60 === 0) {
      logger.log(`📸 Processed frame ${frameIndex}/${totalFrames}`);
    }
  }

  logger.log("✅ Overlay frames generated", {
    totalFrames,
    uniqueStates: overlayStates.size,
    optimizationRatio: `${(
      (1 - overlayStates.size / totalFrames) *
      100
    ).toFixed(1)}%`,
  });

  return frames;
}

function calculateScaleFactor(
  videoDimensions: { width: number; height: number },
  clientDisplaySize: { width: number; height: number }
): number {
  // Calculate scale factor based on the ratio of video to display size
  const videoAspectRatio = videoDimensions.width / videoDimensions.height;
  const displayAspectRatio = clientDisplaySize.width / clientDisplaySize.height;

  let scaleFactor: number;

  if (Math.abs(videoAspectRatio - displayAspectRatio) < 0.1) {
    logger.log("📏 Aspect ratios are similar. Scaling based on total area.");
    // Similar aspect ratios - scale based on area
    const videoArea = videoDimensions.width * videoDimensions.height;
    const displayArea = clientDisplaySize.width * clientDisplaySize.height;
    scaleFactor = Math.sqrt(videoArea / displayArea);
  } else {
    logger.log("⚠️ Aspect ratios differ. Scaling based on limiting dimension.");
    // Different aspect ratios - scale based on the limiting dimension
    const widthScale = videoDimensions.width / clientDisplaySize.width;
    const heightScale = videoDimensions.height / clientDisplaySize.height;
    scaleFactor = Math.max(widthScale, heightScale);
  }

  logger.log("✅ Scale factor within bounds:", scaleFactor);
  return scaleFactor;
}

function renderTextOverlay(
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
  overlay: TextOverlay,
  videoDimensions: { width: number; height: number },
  scaleFactor: number = 1.0,
  targetResolution?: { width: number; height: number }
): void {
  if (!overlay.visible) {
    logger.log("⛔ Overlay not visible, skipping render.");
    return;
  }

  const renderDimensions = targetResolution || videoDimensions;
  const { width: renderWidth, height: renderHeight } = renderDimensions;
  logger.log(`📐 Video dimensions: ${renderWidth} x ${renderHeight}`);

  // CSS padding from DraggableTextOverlay: "8px 12px" = top/bottom: 8px, left/right: 12px
  const basePaddingX = 8;
  const basePaddingY = 6;

  // Scale padding with scale factor
  const scaledPaddingX = Math.round(basePaddingX * scaleFactor);
  const scaledPaddingY = Math.round(basePaddingY * scaleFactor);
  const scaledFontSize = Math.round(overlay.fontSize * scaleFactor);

  // Set up font for text measurement
  const weight = overlay.bold ? "700" : "400";
  const style = overlay.italic ? "italic" : "normal";

  ctx.font = `${style} ${weight} ${scaledFontSize}px "${overlay.fontFamily}"`;
  ctx.fillStyle = overlay.color;
  ctx.globalAlpha = overlay.opacity;

  logger.log(`🔤 Using font: ${ctx.font}`);

  const scaledLetterSpacing = Math.round(
    (parseInt(overlay.letterSpacing) || 0) * scaleFactor
  );

  // Calculate content area width (maxWidth minus padding)
  const resolvedMaxWidth = parseFloat(overlay.maxWidth as string);
  const scaledMaxWidth =
    resolvedMaxWidth > 0 ? resolvedMaxWidth * scaleFactor : renderWidth * 0.8;
  const contentAreaWidth = scaledMaxWidth - 2 * scaledPaddingX;

  // Wrap text based on content area width
  const wrappedLines = wrapText(
    ctx,
    overlay.text,
    contentAreaWidth,
    scaledLetterSpacing
  );

  // Calculate actual content dimensions
  const maxLineWidth = Math.max(
    ...wrappedLines.map((line) =>
      measureTextWithSpacing(ctx, line, scaledLetterSpacing)
    )
  );
  const actualContentWidth = Math.min(maxLineWidth, contentAreaWidth);
  const scaledLineHeight = scaledFontSize * 1.2;
  const totalTextHeight = wrappedLines.length * scaledLineHeight;

  // Calculate div dimensions (content + padding)
  const divWidth = actualContentWidth + 2 * scaledPaddingX;
  const divHeight = totalTextHeight + 2 * scaledPaddingY;

  // Position div's border box at normalized coordinates
  const idealDivX = overlay.x * renderWidth;
  const idealDivY = overlay.y * renderHeight;

  // Clamp div to prevent clipping
  const clampedDivX = Math.max(0, Math.min(renderWidth - divWidth, idealDivX));
  const clampedDivY = Math.max(
    0,
    Math.min(renderHeight - divHeight, idealDivY)
  );

  logger.log("📦 Div positioning", {
    idealPosition: { x: idealDivX, y: idealDivY },
    clampedPosition: { x: clampedDivX, y: clampedDivY },
    divSize: { width: divWidth, height: divHeight },
    contentSize: { width: actualContentWidth, height: totalTextHeight },
    padding: { x: scaledPaddingX, y: scaledPaddingY },
  });

  // Draw background if specified
  if (overlay.backgroundColor && overlay.backgroundColor !== "transparent") {
    ctx.fillStyle = overlay.backgroundColor;
    logger.log(
      `🧱 Rendering background at (${clampedDivX}, ${clampedDivY}) with size ${divWidth} x ${divHeight}`
    );
    ctx.fillRect(clampedDivX, clampedDivY, divWidth, divHeight);
    ctx.fillStyle = overlay.color;
  }

  // Calculate content area position (inside padding)
  const contentAreaX = clampedDivX + scaledPaddingX;
  const contentAreaY = clampedDivY + scaledPaddingY;

  // Calculate text position based on alignment within content area
  let textX = contentAreaX;
  switch (overlay.alignment) {
    case "left":
      textX = contentAreaX;
      break;
    case "center":
      textX = contentAreaX + actualContentWidth / 2;
      break;
    case "right":
      textX = contentAreaX + actualContentWidth;
      break;
  }

  // Set text alignment for ctx.fillText
  ctx.textAlign = overlay.alignment;

  logger.log("🧭 Text positioning", {
    alignment: overlay.alignment,
    contentAreaX,
    textX,
    actualContentWidth,
  });

  // Render each line of text
  wrappedLines.forEach((line, lineIndex) => {
    const textY = contentAreaY + scaledFontSize + lineIndex * scaledLineHeight;

    if (scaledLetterSpacing > 0) {
      logger.log(`🖋️ Rendering with letter spacing at line ${lineIndex + 1}`);
      renderTextWithSpacing(
        ctx,
        line,
        textX,
        textY,
        scaledLetterSpacing,
        overlay.alignment,
        actualContentWidth
      );
    } else {
      logger.log(`🖋️ Rendering line ${lineIndex + 1} using fillText`);
      ctx.fillText(line, textX, textY, actualContentWidth);
    }

    // Draw underline if specified
    if (overlay.underline) {
      const lineWidth = measureTextWithSpacing(ctx, line, scaledLetterSpacing);
      const actualLineWidth = Math.min(lineWidth, actualContentWidth);
      const underlineY = textY + Math.round(3 * scaleFactor);

      let underlineX = textX;
      if (overlay.alignment === "center") {
        underlineX = textX - actualLineWidth / 2;
      } else if (overlay.alignment === "right") {
        underlineX = textX - actualLineWidth;
      }

      logger.log(
        `🧵 Drawing underline from (${underlineX}, ${underlineY}) to (${
          underlineX + actualLineWidth
        }, ${underlineY})`
      );

      ctx.strokeStyle = overlay.color;
      ctx.lineWidth = Math.round(2 * scaleFactor);
      ctx.beginPath();
      ctx.moveTo(underlineX, underlineY);
      ctx.lineTo(underlineX + actualLineWidth, underlineY);
      ctx.stroke();
    }
  });

  ctx.globalAlpha = 1.0;
  logger.log("✅ Text overlay rendering completed.\n");
}

function renderImageOverlay(
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
  overlay: ImageOverlay,
  videoDimensions: { width: number; height: number },
  scaleFactor: number = 1.0,
  targetResolution?: { width: number; height: number }
): void {
  if (!overlay.visible) {
    logger.log("⛔ Overlay not visible, skipping render.");
    return;
  }

  const renderDimensions = targetResolution || videoDimensions;
  const { width: renderWidth, height: renderHeight } = renderDimensions;
  logger.log(`📐 Video dimensions: ${renderWidth} x ${renderHeight}`);

  const scaledWidth = overlay.width * scaleFactor;
  const scaledHeight = overlay.height * scaleFactor;

  const idealDivX = overlay.x * renderWidth;
  const idealDivY = overlay.y * renderHeight;

  const clampedDivX = Math.max(
    0,
    Math.min(renderWidth - scaledWidth, idealDivX)
  );
  const clampedDivY = Math.max(
    0,
    Math.min(renderHeight - scaledHeight, idealDivY)
  );

  logger.log("📦 Image positioning", {
    idealPosition: { x: idealDivX, y: idealDivY },
    clampedPosition: { x: clampedDivX, y: clampedDivY },
    imageSize: { width: scaledWidth, height: scaledHeight },
  });

  const blobUrl = URL.createObjectURL(overlay.file);
  const image = new Image();

  image.onload = () => {
    ctx.save();
    ctx.globalAlpha = overlay.opacity;
    ctx.translate(
      clampedDivX + scaledWidth / 2,
      clampedDivY + scaledHeight / 2
    );
    ctx.rotate((overlay.rotation * Math.PI) / 180);
    ctx.scale(overlay.scale, overlay.scale);

    ctx.drawImage(
      image,
      -scaledWidth / 2,
      -scaledHeight / 2,
      scaledWidth,
      scaledHeight
    );

    ctx.restore();

    logger.log(
      `🖼️ Rendered image overlay from ${overlay.file.name} at (${clampedDivX}, ${clampedDivY})`
    );

    URL.revokeObjectURL(blobUrl);
  };

  image.onerror = (e) => {
    logger.error(`❌ Failed to load image ${overlay.file.name}:`, e);
    URL.revokeObjectURL(blobUrl);
  };

  image.src = blobUrl;
}

function wrapText(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  letterSpacing: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine + (currentLine ? " " : "") + word;
    const testWidth = measureTextWithSpacing(ctx, testLine, letterSpacing);

    if (testWidth > maxWidth && currentLine) {
      // Current line is full, start a new line
      lines.push(currentLine);
      currentLine = word;

      // Check if the single word itself is too wide - if so, force it anyway
      const wordWidth = measureTextWithSpacing(ctx, word, letterSpacing);
      if (wordWidth > maxWidth) {
        // Word is too long, but we have to include it
        lines.push(word);
        currentLine = "";
      }
    } else {
      currentLine = testLine;
    }
  }

  // Add the last line if it exists
  if (currentLine) {
    lines.push(currentLine);
  }

  // Ensure we always return at least one line
  return lines.length > 0 ? lines : [text];
}

function measureTextWithSpacing(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  letterSpacing: number
): number {
  if (letterSpacing <= 0) {
    return ctx.measureText(text).width;
  }

  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    totalWidth += ctx.measureText(text[i]).width;
    if (i < text.length - 1) {
      totalWidth += letterSpacing;
    }
  }
  return totalWidth;
}

function renderTextWithSpacing(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
  alignment: TextOverlay["alignment"],
  maxWidth: number
): void {
  const totalWidth = measureTextWithSpacing(ctx, text, letterSpacing);
  const actualWidth = Math.min(totalWidth, maxWidth);

  let currentX = x;

  // If text is wider than maxWidth, we need to compress the spacing
  const compressionRatio =
    actualWidth < totalWidth ? actualWidth / totalWidth : 1;
  const adjustedSpacing = letterSpacing * compressionRatio;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    ctx.fillText(char, currentX, y);
    currentX +=
      ctx.measureText(char).width + (i < text.length - 1 ? adjustedSpacing : 0);
  }
}
