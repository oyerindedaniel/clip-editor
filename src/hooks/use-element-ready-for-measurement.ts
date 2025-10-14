import * as React from "react";

// TODO: Find a better approach
/**
 * Detects when an element becomes measurable (not display:none).
 * Lightweight and avoids unnecessary reflows.
 */
export function useElementReadyForMeasurement(
  ref: React.RefObject<HTMLElement | null>
): boolean {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame: number;
    const check = () => {
      const measurable = el.offsetWidth > 0 || el.offsetHeight > 0;

      if (measurable) {
        setReady(true);
        cancelAnimationFrame(frame);
        return;
      }

      frame = requestAnimationFrame(check);
    };

    check();
    return () => cancelAnimationFrame(frame);
  }, [ref]);

  return ready;
}
