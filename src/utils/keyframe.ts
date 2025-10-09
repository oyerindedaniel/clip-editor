import { DEFAULT_COLORS } from "@/constants/app";

interface KeyframeTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  normX: number;
  normY: number;
}

type Transform = KeyframeTransform;

type KeyframeEasing = (typeof KEYFRAME_EASINGS)[number];

interface KeyframeData {
  id: string;
  time: number;
  transform: KeyframeTransform;
  easing: KeyframeEasing;
  color?: (typeof DEFAULT_COLORS)[number];
}

const KEYFRAME_EASINGS = Object.freeze([
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "ease-in-cubic",
  "ease-out-cubic",
] as const);

const DEFAULT_TRANSFORM: Transform = Object.freeze({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  scale: 1,
  normX: 0,
  normY: 0,
});

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

export type { KeyframeTransform, Transform, KeyframeData, KeyframeEasing };

export { KEYFRAME_EASINGS, DEFAULT_TRANSFORM };
