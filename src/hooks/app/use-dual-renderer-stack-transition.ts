import React, { useCallback, useRef } from "react";

interface UseDualRendererStackTransitionOptions {
  // Dual view video refs
  primaryDualVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryDualVideoRef: React.RefObject<HTMLVideoElement | null>;

  // Renderer/preview refs
  primaryRendererVideoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryRendererVideoRef: React.RefObject<HTMLVideoElement | null>;

  toggleStack: () => void;
  activeStack: "dual" | "renderer";
  hasSecondaryClip: boolean;
}

export function useDualRendererStackTransition({
  primaryDualVideoRef,
  secondaryDualVideoRef,
  primaryRendererVideoRef,
  secondaryRendererVideoRef,
  toggleStack,
  activeStack,
  hasSecondaryClip,
}: UseDualRendererStackTransitionOptions) {
  const wasPlayingRef = useRef<{
    dual: { primary: boolean; secondary: boolean };
    renderer: { primary: boolean; secondary: boolean };
  }>({
    dual: { primary: false, secondary: false },
    renderer: { primary: false, secondary: false },
  });

  const toggleWithPlaybackControl = useCallback(() => {
    // Determine which stack is currently active
    const isDualActive = activeStack === "dual";
    const currentPrimaryRef = isDualActive
      ? primaryDualVideoRef
      : primaryRendererVideoRef;
    const currentSecondaryRef = isDualActive
      ? secondaryDualVideoRef
      : secondaryRendererVideoRef;

    // Save current playback states for active stack
    const currentStackKey = isDualActive ? "dual" : "renderer";
    wasPlayingRef.current[currentStackKey] = {
      primary: !!currentPrimaryRef.current && !currentPrimaryRef.current.paused,
      secondary:
        hasSecondaryClip &&
        !!currentSecondaryRef.current &&
        !currentSecondaryRef.current.paused,
    };

    // Pause all videos in the current stack
    if (currentPrimaryRef.current && !currentPrimaryRef.current.paused) {
      currentPrimaryRef.current.pause();
    }
    if (
      hasSecondaryClip &&
      currentSecondaryRef.current &&
      !currentSecondaryRef.current.paused
    ) {
      currentSecondaryRef.current.pause();
    }

    // Trigger the stack transition
    toggleStack();

    // Restore playback states after transition
    queueMicrotask(() => {
      const becomingActive = isDualActive ? "renderer" : "dual";
      const newPrimaryRef = isDualActive
        ? primaryRendererVideoRef
        : primaryDualVideoRef;
      const newSecondaryRef = isDualActive
        ? secondaryRendererVideoRef
        : secondaryDualVideoRef;

      // Restore playback for the stack that's becoming active
      if (
        wasPlayingRef.current[becomingActive].primary &&
        newPrimaryRef.current
      ) {
        newPrimaryRef.current.play().catch(() => {});
      }

      if (
        hasSecondaryClip &&
        wasPlayingRef.current[becomingActive].secondary &&
        newSecondaryRef.current
      ) {
        newSecondaryRef.current.play().catch(() => {});
      }
    });
  }, [
    primaryDualVideoRef,
    secondaryDualVideoRef,
    primaryRendererVideoRef,
    secondaryRendererVideoRef,
    toggleStack,
    activeStack,
    hasSecondaryClip,
  ]);

  return { toggleWithPlaybackControl };
}
