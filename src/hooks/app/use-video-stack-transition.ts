import React, { useCallback, useRef } from "react";

interface UseVideoStackTransitionOptions<K extends string> {
  videoRefs: Record<K, React.RefObject<HTMLVideoElement | null>>;
  toggleStack: () => void;
  activeKey: K;
}

export function useVideoStackTransition<K extends string>({
  videoRefs,
  toggleStack,
  activeKey,
}: UseVideoStackTransitionOptions<K>) {
  const wasPlayingRef = useRef<Record<K, boolean>>({} as Record<K, boolean>);

  const toggleWithPlaybackControl = useCallback(() => {
    // Save current playback states
    const playbackStates = {} as Record<K, boolean>;
    Object.entries(videoRefs).forEach(([key, ref]) => {
      const videoRef = ref as React.RefObject<HTMLVideoElement>;
      playbackStates[key as K] = !!videoRef.current && !videoRef.current.paused;
    });
    wasPlayingRef.current = playbackStates;

    // Trigger the stack transition
    toggleStack();

    // Restore playback states after transition
    queueMicrotask(() => {
      Object.entries(videoRefs).forEach(([key, ref]) => {
        const videoRef = ref as React.RefObject<HTMLVideoElement>;
        const isBecomingActive = key !== activeKey; // Will become active after toggle

        if (isBecomingActive) {
          // Restore playback if it was playing before
          if (wasPlayingRef.current[key as K] && videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        } else {
          // Pause the currently active video (becoming inactive)
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        }
      });
    });
  }, [videoRefs, toggleStack, activeKey]);

  return { toggleWithPlaybackControl };
}
