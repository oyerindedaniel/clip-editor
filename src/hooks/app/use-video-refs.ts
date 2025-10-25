import { useRef, useCallback } from "react";

export function useVideoRefs() {
  // Video element refs
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  const primaryDualVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryDualVideoRef = useRef<HTMLVideoElement | null>(null);

  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  // Helper to select video element
  const getVideoRef = useCallback(
    (player: "primary" | "secondary") =>
      player === "primary" ? primaryVideoRef : secondaryVideoRef,
    []
  );

  return {
    primaryVideoRef,
    secondaryVideoRef,
    primaryDualVideoRef,
    secondaryDualVideoRef,
    pipVideoRef,
    getVideoRef,
  };
}
