import * as React from "react";
import { useStableHandler } from "./use-stable-handler";

type OnChangeHandler<T> = (value: T) => void;

interface UseControllableStateWithCallbackOptions<T> {
  defaultValue: T;
  controlled?: T;
  onChange?: OnChangeHandler<T>;
  onValueChangeAlways?: OnChangeHandler<T>;
}

/**
 * Same as useControllableState, but adds an `onValueChangeAlways` callback
 * that runs on *every* change (both controlled and uncontrolled).
 */
export function useControllableStateWithCallback<T>({
  defaultValue,
  controlled,
  onChange,
  onValueChangeAlways,
}: UseControllableStateWithCallbackOptions<T>) {
  const [uncontrolled, setUncontrolled] = React.useState<T>(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? (controlled as T) : uncontrolled;

  const stableOnChange = useStableHandler(onChange!);
  const stableOnValueChangeAlways = useStableHandler(onValueChangeAlways!);

  const setValue = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = value;
      const nextValue =
        typeof next === "function" ? (next as (prev: T) => T)(prev) : next;

      if (isControlled) {
        if (nextValue !== controlled) {
          stableOnChange?.(nextValue);
        }
      } else {
        setUncontrolled(nextValue);
      }

      // always fire this one
      stableOnValueChangeAlways?.(nextValue);
    },
    [isControlled, value, controlled]
  );

  return [value, setValue] as const;
}
