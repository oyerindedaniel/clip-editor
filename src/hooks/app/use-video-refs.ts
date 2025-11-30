import { useRef, useCallback } from "react";
import type { PlayerType } from "@/types/app";

export function useVideoRefs() {
  // Video element refs
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  const primaryDualVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryDualVideoRef = useRef<HTMLVideoElement | null>(null);

  const primaryRendererVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryRendererVideoRef = useRef<HTMLVideoElement | null>(null);

  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  // Helper to select video element
  const getVideoRef = useCallback(
    (player: PlayerType) =>
      player === "primary" ? primaryVideoRef : secondaryVideoRef,
    []
  );

  return {
    primaryVideoRef,
    secondaryVideoRef,
    primaryDualVideoRef,
    secondaryDualVideoRef,
    primaryRendererVideoRef,
    secondaryRendererVideoRef,
    pipVideoRef,
    getVideoRef,
  };
}
