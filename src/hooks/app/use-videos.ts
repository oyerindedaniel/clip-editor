import { useRef, useMemo, useState } from "react";
import { useLatestValue } from "../use-latest-value";

export function useVideos() {
  // Video element refs
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  // Playback state (state + latest ref)
  const [repeatPrimary, setRepeatPrimary] = useState(false);
  const repeatPrimaryRef = useLatestValue(repeatPrimary);

  const [ratePrimary, setRatePrimary] = useState(1);
  const ratePrimaryRef = useLatestValue(ratePrimary);

  const [repeatSecondary, setRepeatSecondary] = useState(false);
  const repeatSecondaryRef = useLatestValue(repeatSecondary);

  const [rateSecondary, setRateSecondary] = useState(1);
  const rateSecondaryRef = useLatestValue(rateSecondary);

  // Helper to select video element
  const getVideoRef = useMemo(
    () => (player: "primary" | "secondary") =>
      player === "primary" ? primaryVideoRef : secondaryVideoRef,
    []
  );

  return {
    primaryVideoRef,
    secondaryVideoRef,
    repeatPrimary,
    setRepeatPrimary,
    repeatPrimaryRef,
    ratePrimary,
    setRatePrimary,
    ratePrimaryRef,
    repeatSecondary,
    setRepeatSecondary,
    repeatSecondaryRef,
    rateSecondary,
    setRateSecondary,
    rateSecondaryRef,
    getVideoRef,
  };
}
