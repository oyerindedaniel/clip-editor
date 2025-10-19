import { useRef, useMemo } from "react";

export function useVideoRefs() {
  // Video element refs
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  // Helper to select video element
  const getVideoRef = useMemo(
    () => (player: "primary" | "secondary") =>
      player === "primary" ? primaryVideoRef : secondaryVideoRef,
    []
  );

  return {
    primaryVideoRef,
    secondaryVideoRef,
    getVideoRef,
  };
}
