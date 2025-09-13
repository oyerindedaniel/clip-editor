import React, { useMemo, useCallback } from "react";
import { DraggableTextOverlay } from "./draggable-text-overlay";
import { DraggableImageOverlay } from "./draggable-image-overlay";
import { Position } from "./resize-handle";
import { useShallowSelector } from "@/hooks/context-store";
import { OverlaysContext } from "@/contexts/overlays-context";

interface PersistentOverlaysProps {
  duration: number;
  isDualVideo?: boolean;
}

export function PersistentOverlays({
  duration,
  isDualVideo = false,
}: PersistentOverlaysProps) {
  const {
    selectedOverlay,
    textOverlays,
    imageOverlays,
    startDrag,
    startResize,
    startRotation,
  } = useShallowSelector(OverlaysContext, (state) => ({
    selectedOverlay: state.selectedOverlay,
    startDrag: state.startDrag,
    startResize: state.startResize,
    startRotation: state.startRotation,
    textOverlays: state.textOverlays,
    imageOverlays: state.imageOverlays,
  }));

  const persistentTextOverlays = useMemo(
    () =>
      textOverlays.filter(
        (overlay) =>
          overlay.startTime === 0 &&
          overlay.endTime >= duration &&
          overlay.visible
      ),
    [textOverlays, duration]
  );

  const persistentImageOverlays = useMemo(
    () =>
      imageOverlays.filter(
        (overlay) =>
          overlay.startTime === 0 &&
          overlay.endTime >= duration &&
          overlay.visible
      ),
    [imageOverlays, duration]
  );

  const containerContext = isDualVideo ? "dual" : "primary";

  const handleMouseDown = useCallback(
    (overlayId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      startDrag(overlayId, event, containerContext);
    },
    [startDrag, containerContext]
  );

  const handleResizeStart = useCallback(
    (overlayId: string, handle: Position, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      startResize(overlayId, handle, event, containerContext);
    },
    [startResize, containerContext]
  );

  const handleRotationStart = useCallback(
    (overlayId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      startRotation(overlayId, event, containerContext);
    },
    [startRotation, containerContext]
  );

  return (
    <>
      {persistentTextOverlays.map((overlay) => (
        <DraggableTextOverlay
          key={`persistent-${overlay.id}-${containerContext}`}
          overlay={overlay}
          isSelected={selectedOverlay === overlay.id}
          onMouseDown={(e) => handleMouseDown(overlay.id, e)}
          isDualVideo={isDualVideo}
          containerContext={containerContext}
        />
      ))}

      {persistentImageOverlays.map((overlay) => (
        <DraggableImageOverlay
          key={`persistent-${overlay.id}-${containerContext}`}
          overlay={overlay}
          isSelected={selectedOverlay === overlay.id}
          onMouseDown={(e) => handleMouseDown(overlay.id, e)}
          onResizeStart={(handle, e) =>
            handleResizeStart(overlay.id, handle, e)
          }
          onRotationStart={(e) => handleRotationStart(overlay.id, e)}
          isDualVideo={isDualVideo}
          containerContext={containerContext}
        />
      ))}
    </>
  );
}

export default React.memo(PersistentOverlays);
