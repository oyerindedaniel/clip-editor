"use client";

import {
  useRef,
  useState,
  useCallback,
  ReactNode,
  RefObject,
  useEffect,
  createContext,
  useMemo,
} from "react";

import type {
  TextOverlay,
  ImageOverlay,
  Overlay,
  Dimensions,
} from "@/types/app";
import { getOverlayNormalizedCoords, getVideoBoundingBox } from "@/utils/video";
import logger from "@/utils/logger";
import { useLatestValue } from "@/hooks/use-latest-value";
import type { Position } from "@/components/resize-handle";
import { debounce } from "@/utils/app";
import { type StoreApi, useContextStore } from "react-shallow-store";
import { DEFAULT_FONT } from "@/constants/app";

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
  aspectRatio: number;
  preserveAspectRatio: boolean;
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
  registerTextOverlayRef: (
    id: string,
    element: HTMLElement | null,
    containerContext: ContainerContext
  ) => void;
  registerImageOverlayRef: (
    id: string,
    element: HTMLElement | null,
    containerContext: ContainerContext
  ) => void;
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
  setDualVideoRef: (ref: RefObject<HTMLVideoElement | null>) => void;
  textOverlaysRef: RefObject<TextOverlay[]>;
  imageOverlaysRef: RefObject<ImageOverlay[]>;
  videoRef: RefObject<HTMLVideoElement | null>;
  setVideoRef: (element: HTMLVideoElement | null) => void;
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

  const textOverlaysRef = useLatestValue(textOverlays);
  const imageOverlaysRef = useLatestValue(imageOverlays);

  const primaryTextOverlayRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dualTextOverlayRefs = useRef<Map<string, HTMLElement>>(new Map());
  const primaryImageOverlayRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dualImageOverlayRefs = useRef<Map<string, HTMLElement>>(new Map());

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
    aspectRatio: 1,
    preserveAspectRatio: false,
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

  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);

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

  // useEffect(() => {
  //   const handleMouseDown = (ev: MouseEvent) => {
  //     const target = ev.target as Node | null;
  //     if (!target) return;

  //     for (const element of textOverlayRefs.current.values()) {
  //       if (element && element.contains(target)) return;
  //     }
  //     for (const element of imageOverlayRefs.current.values()) {
  //       if (element && element.contains(target)) return;
  //     }

  //     setSelectedOverlay(null);
  //   };

  //   document.addEventListener("mousedown", handleMouseDown, true);
  //   return () => {
  //     document.removeEventListener("mousedown", handleMouseDown, true);
  //   };
  // }, []);

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
      const { width: videoWidth } = getVideoBoundingBox(video);

      // For 9:16 dual video
      const { width: dualVideoWidth } = getVideoBoundingBox(dualVideo);

      const newOverlay: TextOverlay = {
        type: "text",
        id: `text_${Date.now()}`,
        text: "New Text",
        startTime: currentTime,
        endTime: duration ?? Infinity,
        x: 0,
        y: 0,
        normX: 0,
        normY: 0,
        fontSize: 24,
        fontFamily: DEFAULT_FONT,
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
        dualX: 0,
        dualY: 0,
        dualNormX: 0,
        dualNormY: 0,
        dualMaxWidth: calculateMaxWidth(dualVideoWidth),
      };

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
      const { width: videoWidth, height: videoHeight } =
        getVideoBoundingBox(video);

      // For 9:16 dual video
      const { width: dualVideoWidth, height: dualVideoHeight } =
        getVideoBoundingBox(dualVideo);

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
          x: 0,
          y: 0,
          normX: 0,
          normY: 0,
          width,
          height,
          opacity: 1,
          visible: true,
          rotation: 0,
          scale: 1,
          // 9:16 dimensions
          dualX: 0,
          dualY: 0,
          dualNormX: 0,
          dualNormY: 0,
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
    (
      id: string,
      element: HTMLElement | null,
      containerContext: ContainerContext
    ) => {
      const refMap =
        containerContext === "dual"
          ? dualTextOverlayRefs
          : primaryTextOverlayRefs;
      if (element) {
        refMap.current.set(id, element);
      } else {
        refMap.current.delete(id);
      }
    },
    []
  );

  const registerImageOverlayRef = useCallback(
    (
      id: string,
      element: HTMLElement | null,
      containerContext: ContainerContext
    ) => {
      const refMap =
        containerContext === "dual"
          ? dualImageOverlayRefs
          : primaryImageOverlayRefs;
      if (element) {
        refMap.current.set(id, element);
      } else {
        refMap.current.delete(id);
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

  const debouncedUpdateNormalizedCoords = useMemo(() => {
    const fn = () => {
      const primaryVideo = videoRef.current;
      const dualVideo = dualVideoRef.current;
      if (!primaryVideo || !dualVideo) return;

      primaryTextOverlayRefs.current.forEach((element, id) => {
        const overlay = textOverlaysRef.current.find((o) => o.id === id);
        if (overlay) {
          const { x, y, dualX, dualY } = overlay;
          const { x: normX, y: normY } = getOverlayNormalizedCoords(
            primaryVideo,
            {
              overlayX: x,
              overlayY: y,
            }
          );
          const { x: dualNormX, y: dualNormY } = getOverlayNormalizedCoords(
            dualVideo,
            {
              overlayX: dualX,
              overlayY: dualY,
            }
          );
          updateTextOverlay(id, {
            x,
            y,
            normX,
            normY,
            dualX,
            dualY,
            dualNormX,
            dualNormY,
          });
        }
      });

      primaryImageOverlayRefs.current.forEach((element, id) => {
        const overlay = imageOverlaysRef.current.find((o) => o.id === id);
        if (overlay) {
          const { x, y, width, height, dualX, dualY, dualWidth, dualHeight } =
            overlay;
          const { x: normX, y: normY } = getOverlayNormalizedCoords(
            primaryVideo,
            {
              overlayX: x,
              overlayY: y,
            }
          );
          const { x: dualNormX, y: dualNormY } = getOverlayNormalizedCoords(
            dualVideo,
            {
              overlayX: dualX,
              overlayY: dualY,
            }
          );
          updateImageOverlay(id, {
            x,
            y,
            width,
            height,
            normX,
            normY,
            dualX,
            dualY,
            dualWidth,
            dualHeight,
            dualNormX,
            dualNormY,
          });
        }
      });
    };

    return debounce(fn, 300);
  }, [updateTextOverlay, updateImageOverlay]);

  const rafIdRef = useRef<number | null>(null);

  const handleWindowResize = useCallback(() => {
    const primaryContainer = getContainer("primary");
    const dualContainer = getContainer("dual");

    if (!primaryContainer || !dualContainer) return;

    if (
      primaryTextOverlayRefs.current.size === 0 &&
      primaryImageOverlayRefs.current.size === 0
    ) {
      return;
    }

    const primaryRect = primaryContainer.getBoundingClientRect();
    const dualRect = dualContainer.getBoundingClientRect();
    const prevDimensions = previousVideoDimensions.current;

    if (!prevDimensions) {
      previousVideoDimensions.current = {
        width: primaryRect.width,
        height: primaryRect.height,
      };
      return;
    }

    const scaleX = primaryRect.width / prevDimensions.width;
    const scaleY = primaryRect.height / prevDimensions.height;
    const dualScaleX = dualRect.width / prevDimensions.width;
    const dualScaleY = dualRect.height / prevDimensions.height;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      primaryTextOverlayRefs.current.forEach((element, id) => {
        const overlay = textOverlaysRef.current.find((o) => o.id === id);
        if (overlay) {
          const { x: currentX, y: currentY } = overlay;
          const finalLeft = currentX * scaleX;
          const finalTop = currentY * scaleY;

          const elementRect = element.getBoundingClientRect();
          const constrainedLeft = Math.max(
            0,
            Math.min(primaryRect.width - elementRect.width, finalLeft)
          );
          const constrainedTop = Math.max(
            0,
            Math.min(primaryRect.height - elementRect.height, finalTop)
          );

          element.style.transform = `translate3d(${constrainedLeft}px, ${constrainedTop}px, 0) rotate(0deg) scale(1)`;
          element.style.maxWidth = calculateMaxWidth(primaryRect.width);
        }
      });

      dualTextOverlayRefs.current.forEach((element, id) => {
        const overlay = textOverlaysRef.current.find((o) => o.id === id);
        if (overlay) {
          const { dualX: currentX, dualY: currentY } = overlay;
          const finalLeft = currentX * dualScaleX;
          const finalTop = currentY * dualScaleY;

          const elementRect = element.getBoundingClientRect();
          const constrainedLeft = Math.max(
            0,
            Math.min(dualRect.width - elementRect.width, finalLeft)
          );
          const constrainedTop = Math.max(
            0,
            Math.min(dualRect.height - elementRect.height, finalTop)
          );

          element.style.transform = `translate3d(${constrainedLeft}px, ${constrainedTop}px, 0) rotate(0deg) scale(1)`;
          element.style.maxWidth = calculateMaxWidth(dualRect.width);
        }
      });

      primaryImageOverlayRefs.current.forEach((element, id) => {
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
            Math.min(primaryRect.width - targetWidth, finalLeft)
          );
          const constrainedTop = Math.max(
            0,
            Math.min(primaryRect.height - targetHeight, finalTop)
          );

          element.style.transform = `translate3d(${constrainedLeft}px, ${constrainedTop}px, 0) rotate(${rotation}deg) scale(${scale})`;
          element.style.width = `${targetWidth}px`;
          element.style.height = `${targetHeight}px`;
        }
      });

      dualImageOverlayRefs.current.forEach((element, id) => {
        const overlay = imageOverlaysRef.current.find((o) => o.id === id);
        if (overlay) {
          const {
            dualX: currentX,
            dualY: currentY,
            scale,
            rotation,
            dualWidth: currentWidth,
            dualHeight: currentHeight,
          } = overlay;

          const finalLeft = currentX * dualScaleX;
          const finalTop = currentY * dualScaleY;
          const targetWidth = currentWidth * dualScaleX;
          const targetHeight = currentHeight * dualScaleY;

          const constrainedLeft = Math.max(
            0,
            Math.min(dualRect.width - targetWidth, finalLeft)
          );
          const constrainedTop = Math.max(
            0,
            Math.min(dualRect.height - targetHeight, finalTop)
          );

          element.style.transform = `translate3d(${constrainedLeft}px, ${constrainedTop}px, 0) rotate(${rotation}deg) scale(${scale})`;
          element.style.width = `${targetWidth}px`;
          element.style.height = `${targetHeight}px`;
        }
      });

      previousVideoDimensions.current = {
        width: primaryRect.width,
        height: primaryRect.height,
      };
    });

    debouncedUpdateNormalizedCoords();
  }, [debouncedUpdateNormalizedCoords]);

  useEffect(() => {
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      debouncedUpdateNormalizedCoords.cancel?.();
    };
  }, [handleWindowResize, debouncedUpdateNormalizedCoords]);

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
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const container = getContainer(containerContext);
      if (!container) return;
      ensureGuides(container);

      const overlay: Overlay | undefined = [
        ...imageOverlaysRef.current,
        ...textOverlaysRef.current,
      ].find((o) => o.id === overlayId);

      if (!overlay) return;

      const isDualContainer = containerContext === "dual";
      const initialX = isDualContainer ? overlay.dualX : overlay.x;
      const initialY = isDualContainer ? overlay.dualY : overlay.y;

      let scale = 1;
      let rotation = 0;
      const targetRect = target.getBoundingClientRect();
      const elementWidth = targetRect.width;
      const elementHeight = targetRect.height;

      if (overlay.type === "image") {
        scale = overlay.scale;
        rotation = overlay.rotation;
      }

      const otherContainerContext: ContainerContext = isDualContainer
        ? "primary"
        : "dual";
      const otherContainer = getContainer(otherContainerContext);

      let otherElement: HTMLElement | null = null;
      if (overlay.type === "text") {
        const otherRefMap = isDualContainer
          ? primaryTextOverlayRefs
          : dualTextOverlayRefs;
        otherElement = otherRefMap.current.get(overlayId) || null;
      } else {
        const otherRefMap = isDualContainer
          ? primaryImageOverlayRefs
          : dualImageOverlayRefs;
        otherElement = otherRefMap.current.get(overlayId) || null;
      }

      let otherElementWidth = elementWidth;
      let otherElementHeight = elementHeight;
      if (otherElement) {
        const otherRect = otherElement.getBoundingClientRect();
        otherElementWidth = otherRect.width;
        otherElementHeight = otherRect.height;
      }

      const otherInitialX = isDualContainer ? overlay.x : overlay.dualX;
      const otherInitialY = isDualContainer ? overlay.y : overlay.dualY;

      dragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        element: target,
        offsetX: initialX,
        offsetY: initialY,
        overlayId,
        rafId: null,
        finalLeft: initialX,
        finalTop: initialY,
        containerContext,
      };

      setSelectedOverlay(overlayId);

      const onMouseMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag.isDragging || !drag.element) return;

        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;

        const currentContainer = getContainer(drag.containerContext);
        if (!currentContainer) return;

        const containerRect = currentContainer.getBoundingClientRect();

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

        // Snap guides
        const containerCenterX = containerRect.width / 2;
        const containerCenterY = containerRect.height / 2;
        const elementCenterX = newLeft + elementWidth / 2;
        const elementCenterY = newTop + elementHeight / 2;
        const THRESHOLD = 2;

        if (vGuideRef.current) {
          if (Math.abs(elementCenterX - containerCenterX) <= THRESHOLD) {
            vGuideRef.current.style.display = "block";
            vGuideRef.current.style.left = `${containerCenterX}px`;
          } else {
            vGuideRef.current.style.display = "none";
          }
        }

        if (hGuideRef.current) {
          if (Math.abs(elementCenterY - containerCenterY) <= THRESHOLD) {
            hGuideRef.current.style.display = "block";
            hGuideRef.current.style.top = `${containerCenterY}px`;
          } else {
            hGuideRef.current.style.display = "none";
          }
        }

        if (drag.rafId) cancelAnimationFrame(drag.rafId);

        drag.rafId = requestAnimationFrame(() => {
          if (drag.element) {
            drag.element.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0) rotate(${rotation}deg) scale(${scale})`;
          }

          if (otherElement && otherContainer) {
            const otherContainerRect = otherContainer.getBoundingClientRect();

            const containerRatio =
              otherContainerRect.width / containerRect.width;
            const scaledDx = dx * containerRatio;
            const scaledDy = dy * containerRatio;

            let otherLeft = otherInitialX + scaledDx;
            let otherTop = otherInitialY + scaledDy;

            otherLeft = Math.max(
              0,
              Math.min(otherContainerRect.width - otherElementWidth, otherLeft)
            );
            otherTop = Math.max(
              0,
              Math.min(otherContainerRect.height - otherElementHeight, otherTop)
            );

            otherElement.style.transform = `translate3d(${otherLeft}px, ${otherTop}px, 0) rotate(${rotation}deg) scale(${scale})`;
          }
        });
      };

      const onMouseUp = () => {
        const drag = dragRef.current;
        drag.isDragging = false;

        if (drag.overlayId) {
          const primaryVideo = videoRef.current;
          const dualVideo = dualVideoRef.current;

          if (primaryVideo && dualVideo) {
            const primaryContainer = getContainer("primary");
            const dualContainer = getContainer("dual");

            if (!primaryContainer || !dualContainer) return;

            const primaryRect = primaryContainer.getBoundingClientRect();
            const dualRect = dualContainer.getBoundingClientRect();

            const dx = drag.finalLeft - drag.offsetX;
            const dy = drag.finalTop - drag.offsetY;

            let primaryX: number;
            let primaryY: number;
            let dualX: number;
            let dualY: number;

            if (isDualContainer) {
              dualX = drag.finalLeft;
              dualY = drag.finalTop;

              const containerRatio = primaryRect.width / dualRect.width;
              const scaledDx = dx * containerRatio;
              const scaledDy = dy * containerRatio;
              primaryX = otherInitialX + scaledDx;
              primaryY = otherInitialY + scaledDy;
            } else {
              primaryX = drag.finalLeft;
              primaryY = drag.finalTop;

              const containerRatio = dualRect.width / primaryRect.width;
              const scaledDx = dx * containerRatio;
              const scaledDy = dy * containerRatio;
              dualX = otherInitialX + scaledDx;
              dualY = otherInitialY + scaledDy;
            }

            const { x: primaryNormX, y: primaryNormY } =
              getOverlayNormalizedCoords(primaryVideo, {
                overlayX: primaryX,
                overlayY: primaryY,
              });

            const { x: dualNormX, y: dualNormY } = getOverlayNormalizedCoords(
              dualVideo,
              {
                overlayX: dualX,
                overlayY: dualY,
              }
            );

            const updates = {
              x: primaryX,
              y: primaryY,
              normX: primaryNormX,
              normY: primaryNormY,
              dualX,
              dualY,
              dualNormX,
              dualNormY,
            };

            if (overlay.type === "text") {
              updateTextOverlay(drag.overlayId, updates);
            } else {
              updateImageOverlay(drag.overlayId, updates);
            }
          }
        }

        removeGuides();
        drag.element = null;
        drag.overlayId = null;
        drag.rafId = null;
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

      const overlay = imageOverlaysRef.current.find((o) => o.id === overlayId);
      if (!overlay) return;

      const isDualContainer = containerContext === "dual";
      const startWidth = isDualContainer ? overlay.dualWidth : overlay.width;
      const startHeight = isDualContainer ? overlay.dualHeight : overlay.height;
      const startLeft = isDualContainer ? overlay.dualX : overlay.x;
      const startTop = isDualContainer ? overlay.dualY : overlay.y;
      const aspectRatio = startWidth / startHeight;

      const otherContainerContext: ContainerContext = isDualContainer
        ? "primary"
        : "dual";
      const otherContainer = getContainer(otherContainerContext);
      const otherRefMap = isDualContainer
        ? primaryImageOverlayRefs
        : dualImageOverlayRefs;
      const otherElement = otherRefMap.current.get(overlayId) || null;

      const otherStartWidth = isDualContainer
        ? overlay.width
        : overlay.dualWidth;
      const otherStartHeight = isDualContainer
        ? overlay.height
        : overlay.dualHeight;
      const otherStartLeft = isDualContainer ? overlay.x : overlay.dualX;
      const otherStartTop = isDualContainer ? overlay.y : overlay.dualY;

      resizeRef.current = {
        isResizing: true,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth,
        startHeight,
        startLeft,
        startTop,
        finalWidth: startWidth,
        finalHeight: startHeight,
        finalLeft: startLeft,
        finalTop: startTop,
        rafId: null,
        overlayId,
        containerContext,
        aspectRatio,
        preserveAspectRatio: false,
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

        resize.preserveAspectRatio = ev.shiftKey;
        const MIN_OVERLAY_SIZE = 50;

        if (resize.preserveAspectRatio) {
          switch (resize.handle) {
            case "nw":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth - dx);
              newHeight = newWidth / resize.aspectRatio;
              newLeft = resize.startLeft + (resize.startWidth - newWidth);
              newTop = resize.startTop + (resize.startHeight - newHeight);
              break;
            case "ne":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth + dx);
              newHeight = newWidth / resize.aspectRatio;
              newTop = resize.startTop + (resize.startHeight - newHeight);
              break;
            case "sw":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth - dx);
              newHeight = newWidth / resize.aspectRatio;
              newLeft = resize.startLeft + (resize.startWidth - newWidth);
              break;
            case "se":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth + dx);
              newHeight = newWidth / resize.aspectRatio;
              break;
            case "n":
              newHeight = Math.max(MIN_OVERLAY_SIZE, resize.startHeight - dy);
              newWidth = newHeight * resize.aspectRatio;
              newTop = resize.startTop + (resize.startHeight - newHeight);
              break;
            case "s":
              newHeight = Math.max(MIN_OVERLAY_SIZE, resize.startHeight + dy);
              newWidth = newHeight * resize.aspectRatio;
              break;
            case "w":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth - dx);
              newHeight = newWidth / resize.aspectRatio;
              newLeft = resize.startLeft + (resize.startWidth - newWidth);
              break;
            case "e":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth + dx);
              newHeight = newWidth / resize.aspectRatio;
              break;
          }
        } else {
          switch (resize.handle) {
            case "nw":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth - dx);
              newHeight = Math.max(MIN_OVERLAY_SIZE, resize.startHeight - dy);
              newLeft = resize.startLeft + (resize.startWidth - newWidth);
              newTop = resize.startTop + (resize.startHeight - newHeight);
              break;
            case "ne":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth + dx);
              newHeight = Math.max(MIN_OVERLAY_SIZE, resize.startHeight - dy);
              newTop = resize.startTop + (resize.startHeight - newHeight);
              break;
            case "sw":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth - dx);
              newHeight = Math.max(MIN_OVERLAY_SIZE, resize.startHeight + dy);
              newLeft = resize.startLeft + (resize.startWidth - newWidth);
              break;
            case "se":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth + dx);
              newHeight = Math.max(MIN_OVERLAY_SIZE, resize.startHeight + dy);
              break;
            case "n":
              newHeight = Math.max(MIN_OVERLAY_SIZE, resize.startHeight - dy);
              newTop = resize.startTop + (resize.startHeight - newHeight);
              break;
            case "s":
              newHeight = Math.max(MIN_OVERLAY_SIZE, resize.startHeight + dy);
              break;
            case "w":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth - dx);
              newLeft = resize.startLeft + (resize.startWidth - newWidth);
              break;
            case "e":
              newWidth = Math.max(MIN_OVERLAY_SIZE, resize.startWidth + dx);
              break;
          }
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

        resize.finalWidth = newWidth;
        resize.finalHeight = newHeight;
        resize.finalLeft = newLeft;
        resize.finalTop = newTop;

        if (resize.rafId) cancelAnimationFrame(resize.rafId);

        resize.rafId = requestAnimationFrame(() => {
          if (target) {
            target.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0) rotate(${overlay.rotation}deg) scale(${overlay.scale})`;
            target.style.width = `${newWidth}px`;
            target.style.height = `${newHeight}px`;
          }

          if (otherElement && otherContainer) {
            const otherContainerRect = otherContainer.getBoundingClientRect();
            const containerRatio =
              otherContainerRect.width / containerRect.width;

            const widthDelta = newWidth - resize.startWidth;
            const heightDelta = newHeight - resize.startHeight;
            const leftDelta = newLeft - resize.startLeft;
            const topDelta = newTop - resize.startTop;

            const otherWidth = otherStartWidth + widthDelta * containerRatio;
            const otherHeight = otherStartHeight + heightDelta * containerRatio;
            let otherLeft = otherStartLeft + leftDelta * containerRatio;
            let otherTop = otherStartTop + topDelta * containerRatio;

            otherLeft = Math.max(
              0,
              Math.min(otherContainerRect.width - otherWidth, otherLeft)
            );
            otherTop = Math.max(
              0,
              Math.min(otherContainerRect.height - otherHeight, otherTop)
            );

            otherElement.style.transform = `translate3d(${otherLeft}px, ${otherTop}px, 0) rotate(${overlay.rotation}deg) scale(${overlay.scale})`;
            otherElement.style.width = `${otherWidth}px`;
            otherElement.style.height = `${otherHeight}px`;
          }
        });
      };

      const onMouseUp = () => {
        const resize = resizeRef.current;
        resize.isResizing = false;

        if (resize.overlayId) {
          const primaryVideo = videoRef.current;
          const dualVideo = dualVideoRef.current;

          if (primaryVideo && dualVideo) {
            const primaryContainer = getContainer("primary");
            const dualContainer = getContainer("dual");

            if (!primaryContainer || !dualContainer) return;

            const primaryRect = primaryContainer.getBoundingClientRect();
            const dualRect = dualContainer.getBoundingClientRect();

            const widthDelta = resize.finalWidth - resize.startWidth;
            const heightDelta = resize.finalHeight - resize.startHeight;
            const leftDelta = resize.finalLeft - resize.startLeft;
            const topDelta = resize.finalTop - resize.startTop;

            let primaryX: number;
            let primaryY: number;
            let primaryWidth: number;
            let primaryHeight: number;
            let dualX: number;
            let dualY: number;
            let dualWidth: number;
            let dualHeight: number;

            if (isDualContainer) {
              dualX = resize.finalLeft;
              dualY = resize.finalTop;
              dualWidth = resize.finalWidth;
              dualHeight = resize.finalHeight;

              const containerRatio = primaryRect.width / dualRect.width;
              primaryWidth = otherStartWidth + widthDelta * containerRatio;
              primaryHeight = otherStartHeight + heightDelta * containerRatio;
              primaryX = otherStartLeft + leftDelta * containerRatio;
              primaryY = otherStartTop + topDelta * containerRatio;
            } else {
              primaryX = resize.finalLeft;
              primaryY = resize.finalTop;
              primaryWidth = resize.finalWidth;
              primaryHeight = resize.finalHeight;

              const containerRatio = dualRect.width / primaryRect.width;
              dualWidth = otherStartWidth + widthDelta * containerRatio;
              dualHeight = otherStartHeight + heightDelta * containerRatio;
              dualX = otherStartLeft + leftDelta * containerRatio;
              dualY = otherStartTop + topDelta * containerRatio;
            }

            const { x: primaryNormX, y: primaryNormY } =
              getOverlayNormalizedCoords(primaryVideo, {
                overlayX: primaryX,
                overlayY: primaryY,
              });

            const { x: dualNormX, y: dualNormY } = getOverlayNormalizedCoords(
              dualVideo,
              {
                overlayX: dualX,
                overlayY: dualY,
              }
            );

            updateImageOverlay(resize.overlayId, {
              x: primaryX,
              y: primaryY,
              width: primaryWidth,
              height: primaryHeight,
              normX: primaryNormX,
              normY: primaryNormY,
              dualX,
              dualY,
              dualWidth,
              dualHeight,
              dualNormX,
              dualNormY,
            });
          }
        }

        resize.overlayId = null;
        resize.rafId = null;
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

      const isDualContainer = containerContext === "dual";
      const currentX = isDualContainer ? imageOverlay.dualX : imageOverlay.x;
      const currentY = isDualContainer ? imageOverlay.dualY : imageOverlay.y;

      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle =
        Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

      const otherContainerContext: ContainerContext = isDualContainer
        ? "primary"
        : "dual";
      const otherContainer = getContainer(otherContainerContext);
      const otherRefMap = isDualContainer
        ? primaryImageOverlayRefs
        : dualImageOverlayRefs;
      const otherElement = otherRefMap.current.get(overlayId) || null;

      rotationRef.current = {
        isRotating: true,
        startAngle,
        startRotation: imageOverlay.rotation,
        finalRotation: imageOverlay.rotation,
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
            rotation.element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) rotate(${newRotation}deg) scale(${imageOverlay.scale})`;
          }

          if (otherElement && otherContainer) {
            const otherX = isDualContainer
              ? imageOverlay.x
              : imageOverlay.dualX;
            const otherY = isDualContainer
              ? imageOverlay.y
              : imageOverlay.dualY;
            otherElement.style.transform = `translate3d(${otherX}px, ${otherY}px, 0) rotate(${newRotation}deg) scale(${imageOverlay.scale})`;
          }
        });
      };

      const onMouseUp = () => {
        const rotation = rotationRef.current;
        rotation.isRotating = false;

        if (rotation.overlayId) {
          updateImageOverlay(rotation.overlayId, {
            rotation: rotation.finalRotation,
          });
        }

        rotation.element = null;
        rotation.overlayId = null;
        rotation.rafId = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateImageOverlay, getContainer]
  );

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
): Dimensions {
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
