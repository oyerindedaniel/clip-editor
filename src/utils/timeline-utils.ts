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

export function getScrollState(
  scrollContainer: HTMLDivElement,
  maxContentWidth?: number,
  logicalMaxPx?: number
) {
  const scrollLeft = scrollContainer.scrollLeft;
  const containerWidth = scrollContainer.clientWidth;

  const naturalScrollWidth = scrollContainer.scrollWidth;
  const scrollWidth =
    maxContentWidth && maxContentWidth > 0
      ? Math.min(naturalScrollWidth, maxContentWidth)
      : naturalScrollWidth;

  const maxScrollLeft = Math.max(0, scrollWidth - containerWidth);

  let canScrollRight = scrollLeft < maxScrollLeft;
  const canScrollLeft = scrollLeft > 0;

  if (logicalMaxPx != null) {
    canScrollRight =
      canScrollRight && scrollLeft + containerWidth < logicalMaxPx;
  }

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
