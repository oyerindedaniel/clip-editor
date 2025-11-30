import { RefObject, useRef } from "react";
import { useIsoLayoutEffect } from "./use-Isomorphic-layout-effect";

/**
 * Hook to get the latest value of a variable.
 * @param value - The value to track.
 * @returns The latest value.
 */
export function useLatestValue<T>(value: T): RefObject<T> {
  const valueRef = useRef(value);

  useIsoLayoutEffect(() => {
    if (valueRef.current !== value) {
      valueRef.current = value;
    }
  });

  return valueRef;
}
