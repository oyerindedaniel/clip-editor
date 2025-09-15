"use client";

import {
  useRef,
  useState,
  useCallback,
  ReactNode,
  RefObject,
  useEffect,
  createContext,
} from "react";

import {
  TextOverlay,
  ImageOverlay,
  Overlay,
  DualVideoClip,
  DualVideoSettings,
} from "@/types/app";
import { getOverlayNormalizedCoords, getVideoBoundingBox } from "@/utils/video";
import logger from "@/utils/logger";
import { useLatestValue } from "@/hooks/use-latest-value";
import type { Position } from "@/components/resize-handle";
import { debounce } from "@/utils/app";
import { type StoreApi, useContextStore } from "react-shallow-store";

export type OverlayType = "text" | "image";

export type ContainerContext = "primary" | "dual";

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  element: HTMLElement | null;
  offsetX: number;
  offsetY: number;
  overlayId: string | null;
  rafId: number | null;
  finalLeft: number;
  finalTop: number;
  containerContext: "primary" | "dual";
}

interface ResizeState {
  isResizing: boolean;
  handle: string | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
  finalLeft: number;
  finalTop: number;
  finalWidth: number;
  finalHeight: number;
  rafId: number | null;
  overlayId: string | null;
  containerContext: ContainerContext;
}

interface RotationState {
  isRotating: boolean;
  startAngle: number;
  startRotation: number;
  finalRotation: number;
  element: HTMLElement | null;
  overlayId: string | null;
  rafId: number | null;
  containerContext: ContainerContext;
}

export function calculateMaxWidth(value: number): string {
  return `${Math.round(value * 0.65)}px`;
}

type OverlaysContextValue = {
  textOverlays: TextOverlay[];
  imageOverlays: ImageOverlay[];
  selectedOverlay: string | null;
  setSelectedOverlay: React.Dispatch<React.SetStateAction<string | null>>;
  addTextOverlay: (currentTime?: number, duration?: number) => void;
  addImageOverlay: (
    file: File,
    currentTime?: number,
    duration?: number
  ) => void;
  registerTextOverlayRef: (id: string, element: HTMLElement | null) => void;
  registerImageOverlayRef: (id: string, element: HTMLElement | null) => void;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  updateImageOverlay: (id: string, updates: Partial<ImageOverlay>) => void;
  deleteTextOverlay: (id: string) => void;
  deleteImageOverlay: (id: string) => void;
  getTimeBasedOverlays: (currentTime: number) => {
    textOverlays: TextOverlay[];
    imageOverlays: ImageOverlay[];
  };
  containerRef: RefObject<HTMLDivElement | null>;
  secondaryContainerRef: RefObject<HTMLDivElement | null>;
  startDrag: (
    overlayId: string,
    e: React.MouseEvent,
    containerContext?: ContainerContext
  ) => void;
  startResize: (
    overlayId: string,
    handle: Position,
    e: React.MouseEvent,
    containerContext?: ContainerContext
  ) => void;
  startRotation: (
    overlayId: string,
    e: React.MouseEvent,
    containerContext?: ContainerContext
  ) => void;

  textOverlaysRef: RefObject<TextOverlay[]>;
  imageOverlaysRef: RefObject<ImageOverlay[]>;

  videoRef: RefObject<HTMLVideoElement | null>;
  setVideoRef: (ref: RefObject<HTMLVideoElement | null>) => void;
  dualVideoRef: RefObject<HTMLVideoElement | null>;
  setDualVideoRef: (ref: RefObject<HTMLVideoElement | null>) => void;
  secondaryClip: DualVideoClip | null;
  dualVideoSettings: DualVideoSettings;
  dualVideoOffsetMs: number;
  setSecondaryClip: React.Dispatch<React.SetStateAction<DualVideoClip | null>>;
  setDualVideoSettings: React.Dispatch<React.SetStateAction<DualVideoSettings>>;
  setDualVideoOffsetMs: React.Dispatch<React.SetStateAction<number>>;
  onOffsetChange: (offsetMs: number) => void;
  onCutSecondaryAt: (timeMs: number) => void;
  getActiveContainer: () => HTMLDivElement | null;
};

export type Orientation = "portrait" | "horizontal";

export const OverlaysContext =
  createContext<StoreApi<OverlaysContextValue> | null>(null);

export const OverlaysProvider = ({ children }: { children: ReactNode }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dualVideoRef = useRef<HTMLVideoElement | null>(null);

  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);

  const [secondaryClip, setSecondaryClip] = useState<DualVideoClip | null>(
    null
  );
  const secondaryClipRef = useLatestValue(secondaryClip);
  const [dualVideoSettings, setDualVideoSettings] = useState<DualVideoSettings>(
    {
      layout: "vertical",
      outputOrientation: "vertical",
      primaryAudio: "primary",
      normalizeAudio: true,
      primaryVolume: 0.8,
      secondaryVolume: 0.6,
    }
  );
  const [dualVideoOffsetMs, setDualVideoOffsetMs] = useState<number>(0);

  const textOverlaysRef = useLatestValue(textOverlays);
  const imageOverlaysRef = useLatestValue(imageOverlays);

  const textOverlayRefs = useRef<Map<string, HTMLElement>>(new Map());
  const imageOverlayRefs = useRef<Map<string, HTMLElement>>(new Map());
  const previousVideoDimensions = useRef<{
    width: number;
    height: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const secondaryContainerRef = useRef<HTMLDivElement | null>(null);

  const getActiveContainer = useCallback(() => {
    // return secondaryClipRef.current
    //   ? secondaryContainerRef.current
    //   : containerRef.current;
    return containerRef.current;
  }, []);

  const getContainer = useCallback(
    (containerContext: ContainerContext = "primary") => {
      return containerContext === "dual"
        ? secondaryContainerRef.current
        : containerRef.current;
    },
    []
  );

  const dragRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    element: null,
    offsetX: 0,
    offsetY: 0,
    overlayId: null,
    rafId: null,
    finalLeft: 0,
    finalTop: 0,
    containerContext: "primary",
  });

  const resizeRef = useRef<ResizeState>({
    isResizing: false,
    handle: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startLeft: 0,
    startTop: 0,
    finalLeft: 0,
    finalTop: 0,
    finalHeight: 0,
    finalWidth: 0,
    rafId: null,
    overlayId: null,
    containerContext: "primary",
  });

  const rotationRef = useRef<RotationState>({
    isRotating: false,
    startAngle: 0,
    startRotation: 0,
    finalRotation: 0,
    element: null,
    overlayId: null,
    rafId: null,
    containerContext: "primary",
  });

  const setVideoRef = useCallback(
    (ref: React.RefObject<HTMLVideoElement | null>) => {
      videoRef.current = ref.current;
    },
    []
  );

  const setDualVideoRef = useCallback(
    (ref: React.RefObject<HTMLVideoElement | null>) => {
      dualVideoRef.current = ref.current;
    },
    []
  );

  const vGuideRef = useRef<HTMLDivElement | null>(null);
  const hGuideRef = useRef<HTMLDivElement | null>(null);

  function ensureGuides(container: HTMLDivElement) {
    if (!vGuideRef.current) {
      const v = document.createElement("div");
      v.style.position = "absolute";
      v.style.top = "0";
      v.style.bottom = "0";
      v.style.width = "1px";
      v.style.background = "var(--color-primary)";
      v.style.pointerEvents = "none";
      v.style.zIndex = "14";
      v.style.display = "none";
      container.appendChild(v);
      vGuideRef.current = v;
    }
    if (!hGuideRef.current) {
      const h = document.createElement("div");
      h.style.position = "absolute";
      h.style.left = "0";
      h.style.right = "0";
      h.style.height = "1px";
      h.style.background = "var(--color-primary)";
      h.style.pointerEvents = "none";
      h.style.zIndex = "14";
      h.style.display = "none";
      container.appendChild(h);
      hGuideRef.current = h;
    }
  }

  function removeGuides(): void {
    if (hGuideRef.current) {
      hGuideRef.current.remove();
      hGuideRef.current = null;
    }

    if (vGuideRef.current) {
      vGuideRef.current.remove();
      vGuideRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      removeGuides();
    };
  }, []);

  const addTextOverlay = useCallback(
    (currentTime: number = 0, duration?: number) => {
      const video = videoRef.current;
      const dualVideo = dualVideoRef.current;

      if (!video || !dualVideo) {
        logger.warn(
          "⚠️ Cannot add text overlay: video elements are not available."
        );
        return;
      }

      // For 16:9 video
      const { x, y, width: videoWidth } = getVideoBoundingBox(video);
      const { x: normX, y: normY } = getOverlayNormalizedCoords(video, {
        overlayX: x,
        overlayY: y,
      });

      // For 9:16 dual video
      const {
        x: dualX,
        y: dualY,
        width: dualVideoWidth,
      } = getVideoBoundingBox(dualVideo);
      const { x: dualNormX, y: dualNormY } = getOverlayNormalizedCoords(
        dualVideo,
        {
          overlayX: dualX,
          overlayY: dualY,
        }
      );

      const newOverlay: TextOverlay = {
        type: "text",
        id: `text_${Date.now()}`,
        text: "New Text",
        startTime: currentTime,
        endTime: duration ?? Infinity,
        x,
        y,
        normX,
        normY,
        fontSize: 24,
        fontFamily: "var(--font-inter), sans-serif",
        letterSpacing: "-0.03em",
        color: "#ffffff",
        backgroundColor: "#000000",
        opacity: 1,
        bold: false,
        italic: false,
        underline: false,
        alignment: "left",
        visible: true,
        maxWidth: calculateMaxWidth(videoWidth),
        // 9:16 dimensions
        dualX,
        dualY,
        dualNormX,
        dualNormY,
        dualMaxWidth: calculateMaxWidth(dualVideoWidth),
      };

      console.log("newOverlay", newOverlay);
      setTextOverlays((prev) => [...prev, newOverlay]);
      setSelectedOverlay(newOverlay.id);
    },
    []
  );

  const addImageOverlay = useCallback(
    (file: File, currentTime: number = 0, duration?: number) => {
      const video = videoRef.current;
      const dualVideo = dualVideoRef.current;

      if (!video || !dualVideo) {
        logger.warn(
          "⚠️ Cannot add image overlay: video elements are not available."
        );
        return;
      }

      // For 16:9 video
      const {
        x,
        y,
        width: videoWidth,
        height: videoHeight,
      } = getVideoBoundingBox(video);
      const { x: normX, y: normY } = getOverlayNormalizedCoords(video, {
        overlayX: x,
        overlayY: y,
      });

      // For 9:16 dual video
      const {
        x: dualX,
        y: dualY,
        width: dualVideoWidth,
        height: dualVideoHeight,
      } = getVideoBoundingBox(dualVideo);
      const { x: dualNormX, y: dualNormY } = getOverlayNormalizedCoords(
        dualVideo,
        {
          overlayX: dualX,
          overlayY: dualY,
        }
      );

      const url = URL.createObjectURL(file);

      const img = new Image();
      img.src = url;
      img.onload = () => {
        const { width, height } = getImageOverlaySizeByArea(
          videoWidth,
          videoHeight,
          img.naturalWidth,
          img.naturalHeight
        );

        const { width: dualWidth, height: dualHeight } =
          getImageOverlaySizeByArea(
            dualVideoWidth,
            dualVideoHeight,
            img.naturalWidth,
            img.naturalHeight
          );

        const newOverlay: ImageOverlay = {
          type: "image",
          id: `image_${Date.now()}`,
          file,
          startTime: currentTime,
          endTime: duration ?? Infinity,
          x,
          y,
          normX,
          normY,
          width,
          height,
          opacity: 1,
          visible: true,
          rotation: 0,
          scale: 1,
          // 9:16 dimensions
          dualX,
          dualY,
          dualNormX,
          dualNormY,
          dualWidth,
          dualHeight,
        };

        setImageOverlays((prev) => [...prev, newOverlay]);
        setSelectedOverlay(newOverlay.id);

        URL.revokeObjectURL(url);
      };
    },
    []
  );

  const registerTextOverlayRef = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element) {
        textOverlayRefs.current.set(id, element);
      } else {
        textOverlayRefs.current.delete(id);
      }
    },
    []
  );

  const registerImageOverlayRef = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element) {
        imageOverlayRefs.current.set(id, element);
      } else {
        imageOverlayRefs.current.delete(id);
      }
    },
    []
  );

  const updateTextOverlay = useCallback(
    (id: string, updates: Partial<TextOverlay>) => {
      setTextOverlays((prev) =>
        prev.map((overlay) =>
          overlay.id === id ? { ...overlay, ...updates } : overlay
        )
      );
    },
    []
  );

  const updateImageOverlay = useCallback(
    (id: string, updates: Partial<ImageOverlay>) => {
      setImageOverlays((prev) =>
        prev.map((overlay) =>
          overlay.id === id ? { ...overlay, ...updates } : overlay
        )
      );
    },
    []
  );

  const debouncedUpdateNormalizedCoords = useCallback(
    debounce(() => {
      const video = videoRef.current;
      if (!video) return;

      if (
        textOverlayRefs.current.size === 0 &&
        imageOverlayRefs.current.size === 0
      ) {
        return;
      }

      textOverlayRefs.current.forEach((element, id) => {
        const overlay = textOverlaysRef.current.find((o) => o.id === id);
        if (overlay) {
          const { x, y } = overlay;
          const { x: normX, y: normY } = getOverlayNormalizedCoords(video, {
            overlayX: x,
            overlayY: y,
          });
          updateTextOverlay(id, { x, y, normX, normY });
        }
      });

      imageOverlayRefs.current.forEach((element, id) => {
        const overlay = imageOverlaysRef.current.find((o) => o.id === id);
        if (overlay) {
          const { x, y, width, height } = overlay;
          const { x: normX, y: normY } = getOverlayNormalizedCoords(video, {
            overlayX: x,
            overlayY: y,
          });
          updateImageOverlay(id, { x, y, normX, normY, width, height });
        }
      });
    }, 300),
    [updateTextOverlay, updateImageOverlay]
  );

  const rafIdRef = useRef<number | null>(null);

  // TODO: Review this function
  const handleWindowResize = useCallback(() => {
    const container = getActiveContainer();
    if (!container) return;

    if (
      textOverlayRefs.current.size === 0 &&
      imageOverlayRefs.current.size === 0
    ) {
      return;
    }

    const { width: newContainerWidth, height: newContainerHeight } =
      container.getBoundingClientRect();
    const prevDimensions = previousVideoDimensions.current;

    if (!prevDimensions) {
      previousVideoDimensions.current = {
        width: newContainerWidth,
        height: newContainerHeight,
      };
      return;
    }

    const scaleX = newContainerWidth / prevDimensions.width;
    const scaleY = newContainerHeight / prevDimensions.height;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      textOverlayRefs.current.forEach((element, id) => {
        const overlay = textOverlaysRef.current.find((o) => o.id === id);
        if (overlay) {
          const { x: currentX, y: currentY } = overlay;

          const finalLeft = currentX * scaleX;
          const finalTop = currentY * scaleY;

          const elementRect = element.getBoundingClientRect();
          const constrainedLeft = Math.max(
            0,
            Math.min(newContainerWidth - elementRect.width, finalLeft)
          );
          const constrainedTop = Math.max(
            0,
            Math.min(newContainerHeight - elementRect.height, finalTop)
          );

          element.style.transform = `translate3d(${constrainedLeft}px, ${constrainedTop}px, 0) rotate(0deg) scale(1)`;
          element.style.maxWidth = calculateMaxWidth(newContainerWidth);
        }
      });

      imageOverlayRefs.current.forEach((element, id) => {
        const overlay = imageOverlaysRef.current.find((o) => o.id === id);
        if (overlay) {
          const {
            x: currentX,
            y: currentY,
            scale,
            rotation,
            width: currentWidth,
            height: currentHeight,
          } = overlay;

          const finalLeft = currentX * scaleX;
          const finalTop = currentY * scaleY;

          const targetWidth = currentWidth * scaleX;
          const targetHeight = currentHeight * scaleY;

          const constrainedLeft = Math.max(
            0,
            Math.min(newContainerWidth - targetWidth, finalLeft)
          );
          const constrainedTop = Math.max(
            0,
            Math.min(newContainerHeight - targetHeight, finalTop)
          );

          element.style.transform = `translate3d(${constrainedLeft}px, ${constrainedTop}px, 0) rotate(${rotation}deg) scale(${scale})`;
          element.style.width = `${targetWidth}px`;
          element.style.height = `${targetHeight}px`;
        }
      });

      previousVideoDimensions.current = {
        width: newContainerWidth,
        height: newContainerHeight,
      };
    });

    debouncedUpdateNormalizedCoords();
  }, [debouncedUpdateNormalizedCoords, getActiveContainer]);

  useEffect(() => {
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      debouncedUpdateNormalizedCoords.cancel?.();
    };
  }, [handleWindowResize]);

  const deleteTextOverlay = useCallback((id: string) => {
    setTextOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
    setSelectedOverlay((prev) => (prev === id ? null : prev));
  }, []);

  const deleteImageOverlay = useCallback((id: string) => {
    setImageOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
    setSelectedOverlay((prev) => (prev === id ? null : prev));
  }, []);

  const getTimeBasedOverlays = useCallback((currentTime: number) => {
    const visibleTextOverlays = textOverlaysRef.current.filter(
      (overlay) =>
        overlay.visible &&
        currentTime >= overlay.startTime &&
        currentTime <= overlay.endTime
    );
    const visibleImageOverlays = imageOverlaysRef.current.filter(
      (overlay) =>
        overlay.visible &&
        currentTime >= overlay.startTime &&
        currentTime <= overlay.endTime
    );
    return {
      textOverlays: visibleTextOverlays,
      imageOverlays: visibleImageOverlays,
    };
  }, []);

  const startDrag = useCallback(
    (
      overlayId: string,
      e: React.MouseEvent,
      containerContext: ContainerContext = "primary"
    ) => {
      const target = e.currentTarget as HTMLElement;
      const container = getContainer(containerContext);
      if (!container) return;
      ensureGuides(container);

      const overlay: Overlay | undefined = [
        ...imageOverlaysRef.current,
        ...textOverlaysRef.current,
      ].find((o) => o.id === overlayId);

      console.log("overlay", overlay);

      if (!overlay) return;

      const {
        x: currentX,
        y: currentY,
        dualX: currentDualX,
        dualY: currentDualY,
      } = overlay;
      let scale = 1;
      let rotation = 0;

      if (overlay.type === "image") {
        scale = overlay.scale;
        rotation = overlay.rotation;
      }

      dragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        element: target,
        offsetX: containerContext === "dual" ? currentDualX : currentX,
        offsetY: containerContext === "dual" ? currentDualY : currentY,
        overlayId,
        rafId: null,
        finalLeft: containerContext === "dual" ? currentDualX : currentX,
        finalTop: containerContext === "dual" ? currentDualY : currentY,
        containerContext,
      };
      setSelectedOverlay(overlayId);

      const onMouseMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag.isDragging || !drag.element) return;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        const container = getContainer(drag.containerContext);
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        const elementRect = drag.element.getBoundingClientRect();
        const elementWidth = elementRect.width;
        const elementHeight = elementRect.height;
        let newLeft = drag.offsetX + dx;
        let newTop = drag.offsetY + dy;
        newLeft = Math.max(
          0,
          Math.min(containerRect.width - elementWidth, newLeft)
        );
        newTop = Math.max(
          0,
          Math.min(containerRect.height - elementHeight, newTop)
        );
        drag.finalLeft = newLeft;
        drag.finalTop = newTop;
        const containerCenterX = containerRect.width / 2;
        const containerCenterY = containerRect.height / 2;
        const elementCenterX = newLeft + elementWidth / 2;
        const elementCenterY = newTop + elementHeight / 2;
        const threshold = 2;
        if (vGuideRef.current) {
          if (Math.abs(elementCenterX - containerCenterX) <= threshold) {
            vGuideRef.current.style.left = `${containerCenterX}px`;
            vGuideRef.current.style.display = "block";
          } else {
            vGuideRef.current.style.display = "none";
          }
        }
        if (hGuideRef.current) {
          if (Math.abs(elementCenterY - containerCenterY) <= threshold) {
            hGuideRef.current.style.top = `${containerCenterY}px`;
            hGuideRef.current.style.display = "block";
          } else {
            hGuideRef.current.style.display = "none";
          }
        }
        if (drag.rafId) {
          cancelAnimationFrame(drag.rafId);
        }
        drag.rafId = requestAnimationFrame(() => {
          if (drag.element) {
            drag.element.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0) rotate(${rotation}deg) scale(${scale})`;
          }
        });
      };
      const onMouseUp = () => {
        const drag = dragRef.current;
        drag.isDragging = false;

        if (drag.overlayId) {
          const video =
            containerContext === "dual"
              ? dualVideoRef.current
              : videoRef.current;
          if (video) {
            const { x: normX, y: normY } = getOverlayNormalizedCoords(video, {
              overlayX: drag.finalLeft,
              overlayY: drag.finalTop,
            });

            const textOverlay = textOverlaysRef.current.find(
              (o) => o.id === drag.overlayId
            );
            const imageOverlay = imageOverlaysRef.current.find(
              (o) => o.id === drag.overlayId
            );

            if (textOverlay) {
              const updates =
                containerContext === "dual"
                  ? {
                      dualX: drag.finalLeft,
                      dualY: drag.finalTop,
                      dualNormX: normX,
                      dualNormY: normY,
                    }
                  : { x: drag.finalLeft, y: drag.finalTop, normX, normY };
              updateTextOverlay(drag.overlayId, updates);
            } else if (imageOverlay) {
              const updates =
                containerContext === "dual"
                  ? {
                      dualX: drag.finalLeft,
                      dualY: drag.finalTop,
                      dualNormX: normX,
                      dualNormY: normY,
                    }
                  : { x: drag.finalLeft, y: drag.finalTop, normX, normY };
              updateImageOverlay(drag.overlayId, updates);
            }

            logger.log("[Overlay Position]", {
              container: containerContext,
              x: drag.finalLeft,
              y: drag.finalTop,
              normX,
              normY,
            });
          }
        }

        removeGuides();
        drag.element = null;
        drag.overlayId = null;
        drag.finalLeft = 0;
        drag.finalTop = 0;
        drag.offsetX = 0;
        drag.offsetY = 0;
        drag.containerContext = "primary";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateTextOverlay, updateImageOverlay, getContainer]
  );

  const startResize = useCallback(
    (
      overlayId: string,
      handle: Position,
      e: React.MouseEvent,
      containerContext: ContainerContext = "primary"
    ) => {
      e.stopPropagation();
      const target = e.currentTarget.parentElement as HTMLElement;
      const container = getContainer(containerContext);
      if (!container) return;

      const overlay = imageOverlaysRef.current.find(
        (overlay) => overlay.id === overlayId
      );

      if (!overlay) return;

      const {
        x: currentX,
        y: currentY,
        width: currentWidth,
        height: currentHeight,
        dualWidth: currentDualWidth,
        dualHeight: currentDualHeight,
        rotation,
        scale,
        dualX: currentDualX,
        dualY: currentDualY,
      } = overlay;

      resizeRef.current = {
        isResizing: true,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth:
          containerContext === "dual" ? currentDualWidth : currentWidth,
        startHeight:
          containerContext === "dual" ? currentDualHeight : currentHeight,
        startLeft: containerContext === "dual" ? currentDualX : currentX,
        startTop: containerContext === "dual" ? currentDualY : currentY,
        finalWidth:
          containerContext === "dual" ? currentDualWidth : currentWidth,
        finalHeight:
          containerContext === "dual" ? currentDualHeight : currentHeight,
        finalLeft: containerContext === "dual" ? currentDualX : currentX,
        finalTop: containerContext === "dual" ? currentDualY : currentY,
        rafId: null,
        overlayId,
        containerContext,
      };

      setSelectedOverlay(overlayId);

      const onMouseMove = (ev: MouseEvent) => {
        const resize = resizeRef.current;
        if (!resize.isResizing) return;

        const dx = ev.clientX - resize.startX;
        const dy = ev.clientY - resize.startY;

        const containerRect = container.getBoundingClientRect();
        let newWidth = resize.startWidth;
        let newHeight = resize.startHeight;
        let newLeft = resize.startLeft;
        let newTop = resize.startTop;

        switch (resize.handle) {
          case "nw":
            newWidth = Math.max(50, resize.startWidth - dx);
            newHeight = Math.max(50, resize.startHeight - dy);
            newLeft = resize.startLeft + (resize.startWidth - newWidth);
            newTop = resize.startTop + (resize.startHeight - newHeight);
            break;
          case "ne":
            newWidth = Math.max(50, resize.startWidth + dx);
            newHeight = Math.max(50, resize.startHeight - dy);
            newTop = resize.startTop + (resize.startHeight - newHeight);
            break;
          case "sw":
            newWidth = Math.max(50, resize.startWidth - dx);
            newHeight = Math.max(50, resize.startHeight + dy);
            newLeft = resize.startLeft + (resize.startWidth - newWidth);
            break;
          case "se":
            newWidth = Math.max(50, resize.startWidth + dx);
            newHeight = Math.max(50, resize.startHeight + dy);
            break;
          case "n":
            newHeight = Math.max(50, resize.startHeight - dy);
            newTop = resize.startTop + (resize.startHeight - newHeight);
            break;
          case "s":
            newHeight = Math.max(50, resize.startHeight + dy);
            break;
          case "w":
            newWidth = Math.max(50, resize.startWidth - dx);
            newLeft = resize.startLeft + (resize.startWidth - newWidth);
            break;
          case "e":
            newWidth = Math.max(50, resize.startWidth + dx);
            break;
        }

        newLeft = Math.max(
          0,
          Math.min(containerRect.width - newWidth, newLeft)
        );
        newTop = Math.max(
          0,
          Math.min(containerRect.height - newHeight, newTop)
        );
        if (newLeft === 0) newWidth = Math.min(newWidth, containerRect.width);
        if (newTop === 0) newHeight = Math.min(newHeight, containerRect.height);

        resizeRef.current.finalHeight = newHeight;
        resizeRef.current.finalWidth = newWidth;
        resizeRef.current.finalTop = newTop;
        resizeRef.current.finalLeft = newLeft;

        if (resize.rafId) cancelAnimationFrame(resize.rafId);
        resize.rafId = requestAnimationFrame(() => {
          if (target) {
            target.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0) rotate(${rotation}deg) scale(${scale})`;
            target.style.width = `${newWidth}px`;
            target.style.height = `${newHeight}px`;
          }
        });
      };

      const onMouseUp = () => {
        const resize = resizeRef.current;
        const { overlayId, finalLeft, finalTop, finalWidth, finalHeight } =
          resize;
        resize.isResizing = false;

        if (overlayId) {
          const video =
            containerContext === "dual"
              ? dualVideoRef.current
              : videoRef.current;
          if (video) {
            const { x: normX, y: normY } = getOverlayNormalizedCoords(video, {
              overlayX: finalLeft,
              overlayY: finalTop,
            });

            const updates =
              containerContext === "dual"
                ? {
                    dualWidth: finalWidth,
                    dualHeight: finalHeight,
                    dualX: finalLeft,
                    dualY: finalTop,
                    dualNormX: normX,
                    dualNormY: normY,
                  }
                : {
                    width: finalWidth,
                    height: finalHeight,
                    x: finalLeft,
                    y: finalTop,
                    normX,
                    normY,
                  };

            updateImageOverlay(overlayId, updates);
          }
        }

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateImageOverlay, getContainer]
  );

  const startRotation = useCallback(
    (
      overlayId: string,
      e: React.MouseEvent,
      containerContext: ContainerContext = "primary"
    ) => {
      e.stopPropagation();
      const target = e.currentTarget.parentElement as HTMLElement;
      const container = getContainer(containerContext);
      if (!target || !container) return;

      const imageOverlay = imageOverlaysRef.current.find(
        (o) => o.id === overlayId
      );
      if (!imageOverlay) return;

      const { rotation, scale, x, y } = imageOverlay;

      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const startAngle =
        Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

      rotationRef.current = {
        isRotating: true,
        startAngle,
        startRotation: rotation,
        finalRotation: rotation,
        element: target,
        overlayId,
        rafId: null,
        containerContext,
      };

      setSelectedOverlay(overlayId);

      const onMouseMove = (ev: MouseEvent) => {
        const rotation = rotationRef.current;
        if (!rotation.isRotating || !rotation.element) return;

        const currentAngle =
          Math.atan2(ev.clientY - centerY, ev.clientX - centerX) *
          (180 / Math.PI);

        const deltaAngle = currentAngle - rotation.startAngle;
        const newRotation = rotation.startRotation + deltaAngle;

        rotation.finalRotation = newRotation;

        if (rotation.rafId) cancelAnimationFrame(rotation.rafId);
        rotation.rafId = requestAnimationFrame(() => {
          if (rotation.element) {
            rotation.element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${newRotation}deg) scale(${scale})`;
          }
        });
      };

      const onMouseUp = () => {
        const rotation = rotationRef.current;
        rotation.isRotating = false;

        if (rotation.overlayId) {
          updateImageOverlay(rotation.overlayId, {
            rotation: rotation.finalRotation,
            scale,
          });
        }

        rotation.element = null;
        rotation.overlayId = null;
        rotation.containerContext = "primary";
        if (rotation.rafId) {
          cancelAnimationFrame(rotation.rafId);
          rotation.rafId = null;
        }

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateImageOverlay]
  );

  const onOffsetChange = useCallback((offsetMs: number) => {
    setDualVideoOffsetMs(offsetMs);
  }, []);

  const onCutSecondaryAt = useCallback((timeMs: number) => {
    logger.log("Cut secondary video at:", timeMs);
  }, []);

  const contextValue = {
    videoRef,
    setVideoRef,
    dualVideoRef,
    setDualVideoRef,
    textOverlays,
    imageOverlays,
    selectedOverlay,
    registerTextOverlayRef,
    registerImageOverlayRef,
    setSelectedOverlay,
    addTextOverlay,
    addImageOverlay,
    updateTextOverlay,
    updateImageOverlay,
    deleteTextOverlay,
    deleteImageOverlay,
    getTimeBasedOverlays,
    containerRef,
    secondaryContainerRef,
    startDrag,
    startResize,
    startRotation,
    textOverlaysRef,
    imageOverlaysRef,
    secondaryClip,
    dualVideoSettings,
    dualVideoOffsetMs,
    setSecondaryClip,
    setDualVideoSettings,
    setDualVideoOffsetMs,
    onOffsetChange,
    onCutSecondaryAt,
    getActiveContainer,
  };

  const overlaysStore = useContextStore(contextValue);

  return (
    <OverlaysContext.Provider value={overlaysStore}>
      {children}
    </OverlaysContext.Provider>
  );
};

function getImageOverlaySizeByArea(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
  scaleFactor: number = 0.1
): { width: number; height: number } {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return { width: 0, height: 0 };
  }

  const containerArea = containerWidth * containerHeight;
  const targetArea = containerArea * scaleFactor;

  const aspectRatio = imageWidth / imageHeight;

  const height = Math.sqrt(targetArea / aspectRatio);
  const width = height * aspectRatio;

  return { width, height };
}

export function getTransformPosition(target: HTMLElement): {
  x: number;
  y: number;
} {
  const style = window.getComputedStyle(target);
  const transform = style.transform;
  let x = 0;
  let y = 0;

  if (transform && transform !== "none") {
    const matrixValues = transform.match(/matrix3d\((.+)\)|matrix\((.+)\)/);

    if (matrixValues) {
      const values = (matrixValues[1] || matrixValues[2])
        ?.split(",")
        .map((v) => parseFloat(v.trim()));

      if (values) {
        if (matrixValues[1]) {
          // matrix3d
          x = values[12] || 0;
          y = values[13] || 0;
        } else {
          // matrix
          x = values[4] || 0;
          y = values[5] || 0;
        }
      }
    }
  }

  return { x, y };
}
