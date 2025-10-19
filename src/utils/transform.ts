export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  normX: number;
  normY: number;
}

export const DEFAULT_TRANSFORM: Transform = Object.freeze({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  scale: 1,
  normX: 0,
  normY: 0,
});
