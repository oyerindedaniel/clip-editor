import * as React from "react";

const useInsertionEffect: typeof React.useLayoutEffect =
  (React as any)["useInsertionEffect"] || React.useLayoutEffect;

type OnChangeHandler<T, ExtraArgs extends any[] = []> = (
  value: T,
  ...args: ExtraArgs
) => void;

interface UseControllableStateOptions<T, ExtraArgs extends any[] = []> {
  defaultValue: T;
  controlled?: T;
  onChange?: OnChangeHandler<T, ExtraArgs>;
}

/**
 * Creates a controllable state that can be either controlled or uncontrolled.
 * - Controlled when `controlled` is defined.
 * - Uncontrolled otherwise, starting from `defaultValue`.
 */
export function useControllableState<T, ExtraArgs extends any[] = []>({
  defaultValue,
  controlled,
  onChange,
}: UseControllableStateOptions<T, ExtraArgs>) {
  const [uncontrolled, setUncontrolled] = React.useState<T>(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? (controlled as T) : uncontrolled;

  const onChangeRef = React.useRef(onChange);
  useInsertionEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const setValue = React.useCallback(
    (next: T | ((prev: T) => T), ...args: ExtraArgs) => {
      if (isControlled) {
        const newValue =
          typeof next === "function"
            ? (next as (prev: T) => T)(controlled as T)
            : next;

        if (newValue !== controlled) {
          onChangeRef.current?.(newValue, ...args);
        }
      } else {
        setUncontrolled(next);
      }
    },
    [isControlled, controlled]
  );

  return [value, setValue] as const;
}
