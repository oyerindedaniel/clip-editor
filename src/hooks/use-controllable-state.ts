import * as React from "react";
import { useStableHandler } from "./use-stable-handler";

type OnChangeHandler<T> = (value: T) => void;

interface UseControllableStateOptions<T> {
  defaultValue: T;
  controlled?: T;
  onChange?: OnChangeHandler<T>;
}

/**
 * Creates a controllable state that can be either controlled or uncontrolled.
 * - Controlled when `controlled` is defined.
 * - Uncontrolled otherwise, starting from `defaultValue`.
 */
export function useControllableState<T>({
  defaultValue,
  controlled,
  onChange,
}: UseControllableStateOptions<T>) {
  const [uncontrolled, setUncontrolled] = React.useState<T>(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? (controlled as T) : uncontrolled;

  const stableOnChange = useStableHandler(onChange!);

  const setValue = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      if (isControlled) {
        const newValue =
          typeof next === "function"
            ? (next as (prev: T) => T)(controlled as T)
            : next;

        if (newValue !== controlled) {
          stableOnChange?.(newValue);
        }
      } else {
        setUncontrolled(next);
      }
    },
    [isControlled, controlled]
  );

  return [value, setValue] as const;
}
