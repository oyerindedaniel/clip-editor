import { useMemo } from "react";
import { getEasingFunction } from "@/utils/keyframe";
import { ASPECT_RATIOS, AspectRatio } from "@/utils/aspect-ratios";
import { getScaleRange } from "@/utils/scale-range";
import type { CropMode } from "@/types/app";
import type { KeyframeData } from "@/utils/keyframe";

export type InterpolatedResult = {
  x: number; // normalized 0..1 center
  y: number; // normalized 0..1 center
  scale: number; // final clamped scale
  // helpful CSS-ready strings (percent)
  clipPath: string; // inset(...) percent string
  transform: string; // translate(...) scale(...)
  baseAR: number;
  targetAR: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

function clampPercentValue(v: number): number {
  if (!isFinite(v)) return 0;
  return Math.min(Math.max(v, 0), 100);
}

/**
 * Compute clip-path inset(...) from normalized center coords and scale.
 * x,y in 0..1 are center positions in base frame. scale is zoom factor (>1 means zoom in).
 */
function computeClipPathFromNormalized(
  baseAR: number,
  targetAR: number,
  xNorm: number,
  yNorm: number,
  scale: number
): string {
  // scaleX is crop zoom; scaleY adjusts to compensate for base->target aspect mismatch
  const scaleX = scale;
  const scaleY = scale * (baseAR / targetAR);
  const visibleW = 100 / scaleX;
  const visibleH = 100 / scaleY;

  const left = clampPercentValue(xNorm * 100);
  const top = clampPercentValue(yNorm * 100);
  const right = clampPercentValue(100 - (left + visibleW));
  const bottom = clampPercentValue(100 - (top + visibleH));

  return `inset(${top.toFixed(4)}% ${right.toFixed(4)}% ${bottom.toFixed(
    4
  )}% ${left.toFixed(4)}%)`;
}

/**
 * Evaluate transforms for given time.
 * - keyframes normalized coordinates 0..1
 * - easing attached to the "from" keyframe controls the outgoing segment
 */
export function useInterpolatedTransform(
  keyframes: KeyframeData[] | undefined,
  currentTime: number, // seconds
  variant: CropMode,
  baseAspectKey: AspectRatio,
  targetAspectKey: AspectRatio
): InterpolatedResult {
  return useMemo(() => {
    const baseAR = ASPECT_RATIOS[baseAspectKey];
    const targetAR = ASPECT_RATIOS[targetAspectKey];

    // defaults
    if (!keyframes || keyframes.length === 0) {
      const defaultRes: InterpolatedResult = {
        x: 0.5,
        y: 0.5,
        scale: 1,
        clipPath: "inset(0% 0% 0% 0%)",
        transform: "translate(0%, 0%) scale(1)",
        baseAR,
        targetAR,
      };
      return defaultRes;
    }

    const arr = [...keyframes].sort((a, b) => a.time - b.time);

    // clamp before first or after last
    if (currentTime <= arr[0].time) {
      const k = arr[0];
      const x = clamp01(k.transform.normX);
      const y = clamp01(k.transform.normY);
      const { min: minScale1, max: maxScale1 } = getScaleRange(
        baseAR,
        targetAR,
        variant
      );
      const scale = Math.min(Math.max(k.transform.scale, minScale1), maxScale1);
      const clipPath = computeClipPathFromNormalized(
        baseAR,
        targetAR,
        x,
        y,
        scale
      );
      const transform = `translate(${(x - 0.5) * 100}%, ${
        (y - 0.5) * 100
      }%) scale(${scale})`;
      return { x, y, scale, clipPath, transform, baseAR, targetAR };
    }

    if (currentTime >= arr[arr.length - 1].time) {
      const k = arr[arr.length - 1];
      const x = clamp01(k.transform.normX);
      const y = clamp01(k.transform.normY);
      const { min: minScale2, max: maxScale2 } = getScaleRange(
        baseAR,
        targetAR,
        variant
      );
      const scale = Math.min(Math.max(k.transform.scale, minScale2), maxScale2);
      const clipPath = computeClipPathFromNormalized(
        baseAR,
        targetAR,
        x,
        y,
        scale
      );
      const transform = `translate(${(x - 0.5) * 100}%, ${
        (y - 0.5) * 100
      }%) scale(${scale})`;
      return { x, y, scale, clipPath, transform, baseAR, targetAR };
    }

    // find segment
    let from = arr[0];
    let to = arr[arr.length - 1];

    for (let i = 0; i < arr.length - 1; i++) {
      if (currentTime >= arr[i].time && currentTime <= arr[i + 1].time) {
        from = arr[i];
        to = arr[i + 1];
        break;
      }
    }

    const duration = to.time - from.time;
    const rawT = duration === 0 ? 0 : (currentTime - from.time) / duration;
    const easingFn = getEasingFunction(from.easing);
    const t = easingFn(Math.min(Math.max(rawT, 0), 1));

    const ix = clamp01(lerp(from.transform.normX, to.transform.normX, t));
    const iy = clamp01(lerp(from.transform.normY, to.transform.normY, t));
    const iv = lerp(from.transform.scale, to.transform.scale, t);

    const { min: minScale, max: maxScale } = getScaleRange(
      baseAR,
      targetAR,
      variant
    );
    const finalScale = Math.min(Math.max(iv, minScale), maxScale);

    const clipPath = computeClipPathFromNormalized(
      baseAR,
      targetAR,
      ix,
      iy,
      finalScale
    );
    const transform = `translate(${(ix - 0.5) * 100}%, ${
      (iy - 0.5) * 100
    }%) scale(${finalScale})`;

    return {
      x: ix,
      y: iy,
      scale: finalScale,
      clipPath,
      transform,
      baseAR,
      targetAR,
    };
  }, [keyframes, currentTime, variant, baseAspectKey, targetAspectKey]);
}
