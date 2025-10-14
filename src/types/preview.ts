import type { AspectRatio } from "@/utils/aspect-ratios";
import type { KeyframeData } from "@/utils/keyframe";

export interface VideoPreviewBaseProps {
  baseAspect: AspectRatio;
  targetAspect: AspectRatio;
  children: React.ReactElement<React.VideoHTMLAttributes<HTMLVideoElement>>;
  className?: string;
}

export interface VideoPreviewStretchCropProps extends VideoPreviewBaseProps {
  variant: "stretch" | "crop";
  keyframes?: KeyframeData[];
}

export interface VideoPreviewLetterboxProps extends VideoPreviewBaseProps {
  variant: "letterbox";
  keyframes?: never;
}

export type VideoPreviewProps =
  | VideoPreviewStretchCropProps
  | VideoPreviewLetterboxProps;
