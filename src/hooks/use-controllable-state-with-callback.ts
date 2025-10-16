import * as React from "react";
import { useStableHandler } from "./use-stable-handler";

type OnChangeHandler<T, ExtraArgs extends any[] = []> = (
  value: T,
  ...args: ExtraArgs
) => void;

interface UseControllableStateWithCallbackOptions<
  T,
  ExtraArgs extends any[] = []
> {
  defaultValue: T;
  controlled?: T;
  onChange?: OnChangeHandler<T, ExtraArgs>;
  onValueChangeAlways?: OnChangeHandler<T, ExtraArgs>;
}

/**
 * Same as useControllableState, but adds an `onValueChangeAlways` callback
 * that runs on *every* change (both controlled and uncontrolled).
 */
export function useControllableStateWithCallback<
  T,
  ExtraArgs extends any[] = []
>({
  defaultValue,
  controlled,
  onChange,
  onValueChangeAlways,
}: UseControllableStateWithCallbackOptions<T, ExtraArgs>) {
  const [uncontrolled, setUncontrolled] = React.useState<T>(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? (controlled as T) : uncontrolled;

  const stableOnChange = useStableHandler(onChange!);
  const stableOnChangeAlways = useStableHandler(onValueChangeAlways!);

  const setValue = React.useCallback(
    (next: T | ((prev: T) => T), ...args: ExtraArgs) => {
      const prev = value;
      const nextValue =
        typeof next === "function" ? (next as (prev: T) => T)(prev) : next;

      if (isControlled) {
        if (nextValue !== controlled) {
          stableOnChange?.(nextValue, ...args);
        }
      } else {
        setUncontrolled(nextValue);
      }

      // always fire this one
      stableOnChangeAlways?.(nextValue, ...args);
    },
    [isControlled, value, controlled]
  );

  return [value, setValue] as const;
}
