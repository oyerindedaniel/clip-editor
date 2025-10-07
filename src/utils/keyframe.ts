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

export type { KeyframeTransform, Transform, KeyframeData, KeyframeEasing };

export { KEYFRAME_EASINGS, DEFAULT_TRANSFORM };
