import * as React from "react";
import { useShallowSelector } from "react-shallow-store";
import { ClipContext } from "@/contexts/clip-context";
import { secondsToMs, msToSeconds } from "@/utils/video";
import type { KeyframeData } from "@/utils/keyframe";

export function useNormalizeKeyframeTime() {
  const { primaryTrim, secondaryTrim } = useShallowSelector(
    ClipContext,
    (state) => ({
      primaryTrim: state.primaryTrim,
      secondaryTrim: state.secondaryTrim,
    })
  );

  return React.useCallback(
    function (keyframe: KeyframeData): number {
      const timeMs = secondsToMs(keyframe.time);
      const trim = keyframe.target === "primary" ? primaryTrim : secondaryTrim;

      if (!trim) return keyframe.time;

      const normalizedMs = Math.max(0, timeMs - trim.trimStart);
      return msToSeconds(normalizedMs);
    },
    [primaryTrim, secondaryTrim]
  );
}
