import { useCallback } from "react";

type Ref<T> = React.Ref<T> | undefined;

/**
 * Composes multiple refs into a single ref callback
 * Useful when a component needs to forward refs to multiple elements
 */
export function useComposedRefs<T>(...refs: Ref<T>[]) {
  return useCallback(
    (node: T) => {
      refs.forEach((ref) => {
        if (typeof ref === "function") {
          ref(node);
        } else if (ref && typeof ref === "object" && "current" in ref) {
          (ref as React.RefObject<T>).current = node;
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs
  );
}
