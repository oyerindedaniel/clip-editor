import { DEFAULT_COLORS } from "@/constants/app";
import type { Transform } from "./transform";

type KeyframeTransform = Transform;

type KeyframeEasing = (typeof KEYFRAME_EASINGS)[number];

type KeyframeTarget = "primary" | "secondary";

interface KeyframeData {
  id: string;
  time: number;
  transform: KeyframeTransform;
  easing: KeyframeEasing;
  color?: (typeof DEFAULT_COLORS)[number];
  name?: string;
  target: KeyframeTarget;
}

export const KEYFRAME_EASINGS = Object.freeze([
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "ease-in-cubic",
  "ease-out-cubic",
] as const);

export function getEasingFunction(
  name?: KeyframeEasing
): (t: number) => number {
  switch (name) {
    case "linear":
    case undefined:
      return (t) => t;
    case "ease-in":
      return (t) => Math.pow(t, 2);
    case "ease-out":
      return (t) => 1 - Math.pow(1 - t, 2);
    case "ease-in-out":
      return (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    case "ease-in-cubic":
      return (t) => Math.pow(t, 3);
    case "ease-out-cubic":
      return (t) => 1 - Math.pow(1 - t, 3);
    default:
      // linear when unknown
      return (t) => t;
  }
}

export type {
  KeyframeTransform,
  Transform,
  KeyframeData,
  KeyframeEasing,
  KeyframeTarget,
};

export type SortOrder = "asc" | "desc";

export interface KeyframeBounds {
  start: number;
  end: number;
}

export function filterKeyframesByTarget(
  keyframes: KeyframeData[],
  target: KeyframeTarget,
  order: SortOrder = "asc"
): KeyframeData[] {
  return keyframes
    .filter((kf) => kf.target === target)
    .sort((a, b) => (order === "asc" ? a.time - b.time : b.time - a.time));
}

export function groupKeyframesByTarget(
  keyframes: KeyframeData[],
  order: SortOrder = "asc"
): Record<KeyframeTarget, KeyframeData[]> {
  return {
    primary: filterKeyframesByTarget(keyframes, "primary", order),
    secondary: filterKeyframesByTarget(keyframes, "secondary", order),
  };
}

export function getKeyframeBoundsForTarget(
  keyframes: KeyframeData[],
  target: KeyframeTarget
): KeyframeBounds {
  const filtered = filterKeyframesByTarget(keyframes, target);

  if (filtered.length === 0) {
    return { start: 0, end: 0 };
  }

  const times = filtered.map((kf) => kf.time);
  return {
    start: Math.min(...times),
    end: Math.max(...times),
  };
}
