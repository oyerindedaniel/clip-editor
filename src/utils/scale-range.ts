export type Variant = "crop" | "stretch" | "letterbox";

/**
 * Returns a safe [min, max] range for scale.
 * - min is the smallest scale that still fills the target without letterboxing (so min = 1)
 * - max is a practical upper bound to prevent absurd zoom amounts
 */
export function getScaleRange(
  baseAR: number,
  targetAR: number,
  variant: Variant
): { min: number; max: number } {
  if (variant === "letterbox") {
    return { min: 1, max: 1 };
  }

  if (variant === "crop") {
    const min = 1;
    // How far you can zoom into the base so that the target remains covered
    const computed = baseAR / targetAR;
    const max = Number.isFinite(computed) ? Math.max(min, computed) : min * 4;
    return { min, max };
  }

  // stretch
  const min = 1;
  // fillScale: by how much we must scale to convert base->target (absolute fill)
  const fillScale = Math.max(targetAR / baseAR, baseAR / targetAR);
  const max = fillScale * 2;
  return { min, max };
}
