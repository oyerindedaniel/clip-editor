import { msToSeconds, secondsToMs } from "@/utils/video";
import type { TrimData } from "@/types/app";
import type { KeyframeBounds } from "@/utils/keyframe";

/**
 * Validates and clamps keyframe bounds to trim data boundaries
 */
export function validateKeyframeBounds(
  keyframeBounds: KeyframeBounds,
  trimData: TrimData
): KeyframeBounds {
  const trimStartSec = msToSeconds(trimData.trimStart);
  const trimEndSec = msToSeconds(trimData.trimEnd);

  const clampedStart = Math.max(keyframeBounds.start, trimStartSec);
  const clampedEnd = Math.min(keyframeBounds.end, trimEndSec);

  // If bounds are invalid, fall back to trim data
  if (clampedStart >= clampedEnd) {
    return { start: trimStartSec, end: trimEndSec };
  }

  return { start: clampedStart, end: clampedEnd };
}

/**
 * Creates bound trim data from validated keyframe bounds
 */
export function createBoundTrimData(
  keyframeBounds: KeyframeBounds,
  trimData: TrimData
): TrimData {
  const validatedBounds = validateKeyframeBounds(keyframeBounds, trimData);

  return {
    trimStart: secondsToMs(validatedBounds.start),
    trimEnd: secondsToMs(validatedBounds.end),
    timelineOffset: trimData.timelineOffset,
  };
}

/**
 * Creates bound trim data for dual video setup (both primary and secondary)
 */
export function createDualBoundTrimData(
  primaryKeyframeBounds: KeyframeBounds,
  primaryTrimData: TrimData,
  secondaryKeyframeBounds: KeyframeBounds,
  secondaryTrimData: TrimData
): {
  primaryBoundTrimData: TrimData;
  secondaryBoundTrimData: TrimData;
  primaryValidatedBounds: KeyframeBounds;
  secondaryValidatedBounds: KeyframeBounds;
} {
  const primaryValidatedBounds = validateKeyframeBounds(
    primaryKeyframeBounds,
    primaryTrimData
  );
  const secondaryValidatedBounds = validateKeyframeBounds(
    secondaryKeyframeBounds,
    secondaryTrimData
  );

  return {
    primaryBoundTrimData: {
      trimStart: secondsToMs(primaryValidatedBounds.start),
      trimEnd: secondsToMs(primaryValidatedBounds.end),
      timelineOffset: primaryTrimData.timelineOffset,
    },
    secondaryBoundTrimData: {
      trimStart: secondsToMs(secondaryValidatedBounds.start),
      trimEnd: secondsToMs(secondaryValidatedBounds.end),
      timelineOffset: secondaryTrimData.timelineOffset,
    },
    primaryValidatedBounds,
    secondaryValidatedBounds,
  };
}
