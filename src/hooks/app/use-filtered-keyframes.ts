import * as React from "react";
import {
  groupKeyframesByTarget,
  KeyframeData,
  SortOrder,
} from "@/utils/keyframe";

export function useFilteredKeyframes(
  keyframes: KeyframeData[],
  query: string,
  order: SortOrder = "asc"
) {
  return React.useMemo(() => {
    const filtered = keyframes.filter((keyframe) => {
      if (!query.trim()) return true;

      const time = keyframe.time.toFixed(2);
      const lowerQuery = query.toLowerCase();

      const idMatch = keyframe.id.toLowerCase().includes(lowerQuery);
      const nameMatch =
        keyframe.name?.toLowerCase().includes(lowerQuery) ?? false;
      const timeMatch = time.includes(query);

      return idMatch || nameMatch || timeMatch;
    });

    return groupKeyframesByTarget(filtered, order);
  }, [keyframes, query, order]);
}
