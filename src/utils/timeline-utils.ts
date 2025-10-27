export interface TimelineRenderingOptions {
  pxPerMs: number;
  durationMs: number;
  frames?: string[];
  frameWidth?: number;
  container: HTMLDivElement | null;
}

export interface RulerRenderingOptions {
  pxPerMs: number;
  durationMs: number;
  container: HTMLDivElement | null;
}

/**
 * Renders thumbnail strips or pattern blocks for a timeline track
 */
export function renderTimelineStrips({
  pxPerMs,
  durationMs,
  frames,
  frameWidth = 48,
  container,
}: TimelineRenderingOptions) {
  if (!container) return;
  container.innerHTML = "";

  if (pxPerMs <= 0) return;

  if (frames && frames.length > 0) {
    const totalWidth = durationMs * pxPerMs;
    const numFrames = Math.ceil(totalWidth / frameWidth);

    for (let i = 0; i < numFrames; i++) {
      const thumb = document.createElement("div");
      thumb.style.width = `${frameWidth}px`;
      thumb.style.height = "100%";

      const frameIndex = Math.min(i, frames.length - 1);
      if (frames[frameIndex]) {
        thumb.style.backgroundImage = `url(${frames[frameIndex]})`;
        thumb.style.backgroundSize = "cover";
        thumb.style.backgroundPosition = "center";
      } else {
        thumb.style.background =
          i % 2 === 0
            ? "var(--color-surface-tertiary)"
            : "var(--color-surface-hover)";
      }

      thumb.style.borderRight = "1px solid var(--color-subtle)";
      container.appendChild(thumb);
    }
  } else {
    const totalWidth = durationMs * pxPerMs;
    const numBlocks = Math.ceil(totalWidth / frameWidth);

    for (let i = 0; i < numBlocks; i++) {
      const block = document.createElement("div");
      block.style.width = `${frameWidth}px`;
      block.style.height = "100%";
      block.style.background =
        i % 2 === 0
          ? "var(--color-surface-tertiary)"
          : "var(--color-surface-hover)";
      block.style.borderRight = "1px solid var(--color-subtle)";
      container.appendChild(block);
    }
  }
}

/**
 * Renders a ruler with second markers for a timeline
 */
export function renderTimelineRuler({
  pxPerMs,
  durationMs,
  container,
}: RulerRenderingOptions) {
  if (!container) return;
  container.innerHTML = "";

  if (pxPerMs <= 0) return;

  const totalSeconds = Math.floor(durationMs / 1000);

  for (let s = 0; s <= totalSeconds; s++) {
    const x = Math.round(s * 1000 * pxPerMs);
    const tick = document.createElement("div");
    tick.style.position = "absolute";
    tick.style.left = `${x}px`;
    tick.style.top = "0";
    tick.style.bottom = "0";
    tick.style.width = "1px";
    tick.style.background = "var(--color-subtle)";

    const label = document.createElement("div");
    label.style.position = "absolute";
    label.style.left = `${x + 2}px`;
    label.style.top = "0";
    label.style.fontSize = "10px";
    label.style.color = "var(--color-foreground-muted)";
    label.textContent = `${s}s`;

    container.appendChild(tick);
    container.appendChild(label);
  }
}

export function getScrollState(scrollContainer: HTMLDivElement) {
  const EPSILON = 1;

  const scrollLeft = scrollContainer.scrollLeft;
  const containerWidth = scrollContainer.clientWidth;
  const scrollWidth = scrollContainer.scrollWidth;

  const maxScrollLeft = Math.max(0, scrollWidth - containerWidth);

  const canScrollRight = scrollLeft < maxScrollLeft - EPSILON;
  const canScrollLeft = scrollLeft > EPSILON;

  return {
    scrollLeft,
    scrollWidth,
    containerWidth,
    maxScrollLeft,
    canScrollLeft,
    canScrollRight,
  };
}

export function msToPx(ms: number, pxPerMs: number) {
  return ms * pxPerMs;
}

export function pxToMs(px: number, pxPerMs: number) {
  return px / pxPerMs;
}

export function msToSecondsRate(ratePxPerMs: number) {
  return ratePxPerMs * 1000;
}

export function secondsToMsRate(ratePxPerSecond: number) {
  return ratePxPerSecond / 1000;
}

/**
 * Convert absolute video time to relative trimmed time
 * @param absoluteTimeMs - Time in milliseconds from video start
 * @param trimStartMs - Trim start time in milliseconds
 * @returns Relative time in milliseconds (0-based for trimmed area)
 */
export function absoluteToRelativeTime(
  absoluteTimeMs: number,
  trimStartMs: number
): number {
  return Math.max(0, absoluteTimeMs - trimStartMs);
}

/**
 * Convert relative trimmed time back to absolute video time
 * @param relativeTimeMs - Time in milliseconds from trim start (0-based)
 * @param trimStartMs - Trim start time in milliseconds
 * @returns Absolute time in milliseconds from video start
 */
export function relativeToAbsoluteTime(
  relativeTimeMs: number,
  trimStartMs: number
): number {
  return relativeTimeMs + trimStartMs;
}
