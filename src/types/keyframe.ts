export interface KeyframeTransform {
  x: number;
  y: number;
  scale: number;
  normX: number;
  normY: number;
}

export interface KeyframeData {
  id: string;
  time: number;
  transform: KeyframeTransform;
  easing: string;
}
