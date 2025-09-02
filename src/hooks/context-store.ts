import {
  Context,
  useContext,
  useRef,
  useSyncExternalStore,
  useCallback,
} from "react";
import { useIsomorphicLayoutEffect } from "./use-Isomorphic-layout-effect";

/**
 * Selector function type: picks slice S from full state T.
 */
export type Selector<T, S> = (state: T) => S;

/**
 * Store interface that gets passed through React Context.
 */
export interface StoreApi<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void, selector: Selector<T, any>) => () => void;
}

/**
 * Listener data for tracking selector + last selected value.
 */
interface ListenerData<T> {
  selector: Selector<T, any>;
  lastValue: any;
  hasValue: boolean;
}

/**
 * Shallow equality comparison for objects.
 */
function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }
    if (!Object.is((a as any)[key], (b as any)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Hook: Creates a stable store reference for any value that can be passed to React Context.
 * The store reference never changes - only the internal state updates.
 * Only notifies listeners whose selected slice actually changed.
 */
export function useContextStore<T>(value: T): StoreApi<T> {
  const stateRef = useRef(value);
  const listenersRef = useRef(new Map<() => void, ListenerData<T>>());
  const storeRef = useRef<StoreApi<T> | null>(null);
  const pendingValueRef = useRef<T | null>(null);

  const prevValue = stateRef.current;
  const hasChanged = !Object.is(prevValue, value);

  if (hasChanged) {
    stateRef.current = value;
    pendingValueRef.current = value;
  }

  useIsomorphicLayoutEffect(() => {
    if (pendingValueRef.current === null) return;

    const newValue = pendingValueRef.current;
    pendingValueRef.current = null;

    listenersRef.current.forEach((data, listener) => {
      try {
        const newSelected = data.selector(newValue);

        if (!data.hasValue || !shallowEqual(data.lastValue, newSelected)) {
          data.lastValue = newSelected;
          data.hasValue = true;
          listener();
        }
      } catch (error) {
        console.error("Error in listener", error);
      }
    });
  });

  if (!storeRef.current) {
    storeRef.current = {
      getSnapshot: () => stateRef.current,
      subscribe: (listener: () => void, selector: Selector<T, any>) => {
        listenersRef.current.set(listener, {
          selector,
          lastValue: undefined,
          hasValue: false,
        });
        return () => listenersRef.current.delete(listener);
      },
    };
  }

  return storeRef.current;
}

/**
 * Hook: select a slice from context store with shallow equality.
 * Only re-renders when the selected slice actually changes.
 */
export function useShallowSelector<T, S>(
  context: Context<StoreApi<T> | null>,
  selector: Selector<T, S>
): S {
  const store = useContext(context);

  if (!store) {
    throw new Error(
      "useShallowSelector must be used within a Context.Provider"
    );
  }

  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const lastSelectedRef = useRef<{ hasValue: boolean; value?: S }>({
    hasValue: false,
  });

  const createSnapshot = useCallback(() => {
    const state = store.getSnapshot();
    const selected = selectorRef.current(state);

    if (lastSelectedRef.current.hasValue) {
      const prev = lastSelectedRef.current.value as S;
      if (shallowEqual(prev, selected)) {
        return prev;
      }
    }

    lastSelectedRef.current = { hasValue: true, value: selected };
    return selected;
  }, [store]);

  const subscribe = useCallback(
    (listener: () => void) => {
      return store.subscribe(listener, selectorRef.current);
    },
    [store]
  );

  return useSyncExternalStore(subscribe, createSnapshot, createSnapshot);
}
