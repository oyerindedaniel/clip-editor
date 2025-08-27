"use client";

import {
  useRef,
  useState,
  useCallback,
  ReactNode,
  RefObject,
  useEffect,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { TextOverlay, ImageOverlay } from "@/types/app";
import { getOverlayNormalizedCoords, getVideoBoundingBox } from "@/utils/video";
import logger from "@/utils/logger";
import { useLatestValue } from "@/hooks/use-latest-value";
import type { Position } from "@/components/resize-handle";

export type OverlayType = "text" | "image";

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
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  updateImageOverlay: (id: string, updates: Partial<ImageOverlay>) => void;
  deleteTextOverlay: (id: string) => void;
  deleteImageOverlay: (id: string) => void;
  getTimeBasedOverlays: (currentTime: number) => {
    textOverlays: TextOverlay[];
    imageOverlays: ImageOverlay[];
  };
  getAllVisibleOverlays: () => {
    textOverlays: TextOverlay[];
    imageOverlays: ImageOverlay[];
  };
  containerRef: RefObject<HTMLDivElement | null>;
  startDrag: (overlayId: string, e: React.MouseEvent) => void;
  startResize: (
    overlayId: string,
    handle: Position,
    e: React.MouseEvent
  ) => void;

  textOverlaysRef: RefObject<TextOverlay[]>;
  imageOverlaysRef: RefObject<ImageOverlay[]>;

  videoRef: RefObject<HTMLVideoElement | null>;
  setVideoRef: (ref: RefObject<HTMLVideoElement | null>) => void;
};

const OverlaysContext = createContext<OverlaysContextValue>(null!);

function getTransformPosition(target: HTMLElement): {
  x: number;
  y: number;
} {
  const style: CSSStyleDeclaration = window.getComputedStyle(target);
  const transformMatrix: string = style.transform;
  let x = 0;
  let y = 0;

  if (transformMatrix && transformMatrix !== "none") {
    const matrixValues: RegExpMatchArray | null = transformMatrix.match(
      /matrix3d\((.+)\)|matrix\((.+)\)/
    );

    if (matrixValues) {
      const values: string = matrixValues[1] || matrixValues[2];
      const parsedValues: number[] = values.split(",").map(Number);

      if (matrixValues[1]) {
        x = parsedValues[12];
        y = parsedValues[13];
      } else {
        x = parsedValues[4];
        y = parsedValues[5];
      }
    }
  }

  return { x, y };
}

export const OverlaysProvider = ({ children }: { children: ReactNode }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);

  const textOverlaysRef = useLatestValue(textOverlays);
  const imageOverlaysRef = useLatestValue(imageOverlays);

  const containerRef = useRef<HTMLDivElement | null>(null);
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
  });

  const setVideoRef = (ref: React.RefObject<HTMLVideoElement | null>) => {
    videoRef.current = ref.current;
  };

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

  useEffect(() => {
    return () => {
      if (hGuideRef.current) {
        hGuideRef.current.remove();
        hGuideRef.current = null;
      }

      if (vGuideRef.current) {
        vGuideRef.current.remove();
        vGuideRef.current = null;
      }
    };
  }, []);

  const addTextOverlay = useCallback(
    (currentTime: number = 0, duration?: number) => {
      const video = videoRef.current;
      if (!video) {
        logger.warn(
          "⚠️ Cannot add text overlay: video element is not available."
        );
        return;
      }
      const { width: videoWidth } = getVideoBoundingBox(video);
      const newOverlay: TextOverlay = {
        id: `text_${Date.now()}`,
        text: "New Text",
        startTime: currentTime,
        endTime: duration ?? Infinity,
        x: 0,
        y: 0,
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
      };
      setTextOverlays((prev) => [...prev, newOverlay]);
      setSelectedOverlay(newOverlay.id);
    },
    [videoRef]
  );

  const addImageOverlay = useCallback(
    (file: File, currentTime: number = 0, duration?: number) => {
      const video = videoRef.current;
      if (!video) {
        logger.warn(
          "⚠️ Cannot add image overlay: video element is not available."
        );
        return;
      }
      const { width: videoWidth, height: videoHeight } =
        getVideoBoundingBox(video);
      const newOverlay: ImageOverlay = {
        id: `image_${Date.now()}`,
        file,
        startTime: currentTime,
        endTime: duration ?? Infinity,
        x: 0,
        y: 0,
        width: Math.min(200, videoWidth * 0.3),
        height: Math.min(200, videoHeight * 0.3),
        opacity: 1,
        visible: true,
        rotation: 0,
        scale: 1,
      };
      setImageOverlays((prev) => [...prev, newOverlay]);
      setSelectedOverlay(newOverlay.id);
    },
    [videoRef]
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

  const deleteTextOverlay = useCallback((id: string) => {
    setTextOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
    setSelectedOverlay((prev) => (prev === id ? null : prev));
  }, []);

  const deleteImageOverlay = useCallback((id: string) => {
    setImageOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
    setSelectedOverlay((prev) => (prev === id ? null : prev));
  }, []);

  const getTimeBasedOverlays = useCallback(
    (currentTime: number) => {
      const visibleTextOverlays = textOverlays.filter(
        (overlay) =>
          overlay.visible &&
          currentTime >= overlay.startTime &&
          currentTime <= overlay.endTime
      );
      const visibleImageOverlays = imageOverlays.filter(
        (overlay) =>
          overlay.visible &&
          currentTime >= overlay.startTime &&
          currentTime <= overlay.endTime
      );
      return {
        textOverlays: visibleTextOverlays,
        imageOverlays: visibleImageOverlays,
      };
    },
    [textOverlays, imageOverlays]
  );

  const getAllVisibleOverlays = useCallback(() => {
    const visibleTextOverlays = textOverlays.filter(
      (overlay) => overlay.visible
    );
    const visibleImageOverlays = imageOverlays.filter(
      (overlay) => overlay.visible
    );
    return {
      textOverlays: visibleTextOverlays,
      imageOverlays: visibleImageOverlays,
    };
  }, [textOverlays, imageOverlays]);

  const startDrag = useCallback(
    (overlayId: string, e: React.MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      const container = containerRef.current;
      if (!container) return;
      ensureGuides(container);
      const { x: currentX, y: currentY } = getTransformPosition(target);

      dragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        element: target,
        offsetX: currentX,
        offsetY: currentY,
        overlayId,
        rafId: null,
        finalLeft: 0,
        finalTop: 0,
      };
      setSelectedOverlay(overlayId);
      const onMouseMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag.isDragging || !drag.element) return;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        const container = containerRef.current;
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
            drag.element.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0)`;
          }
        });
      };
      const onMouseUp = () => {
        const drag = dragRef.current;
        drag.isDragging = false;
        if (videoRef?.current && drag.overlayId) {
          const { x, y } = getOverlayNormalizedCoords(videoRef.current, {
            overlayX: drag.finalLeft,
            overlayY: drag.finalTop,
          });
          const textOverlay = textOverlays.find((o) => o.id === drag.overlayId);
          const imageOverlay = imageOverlays.find(
            (o) => o.id === drag.overlayId
          );
          if (textOverlay) {
            updateTextOverlay(drag.overlayId, { x, y });
          } else if (imageOverlay) {
            updateImageOverlay(drag.overlayId, { x, y });
          }
          logger.log("[Normalized Overlay Position]", { x, y });
        }
        if (vGuideRef.current) vGuideRef.current.style.display = "none";
        if (hGuideRef.current) hGuideRef.current.style.display = "none";
        drag.element = null;
        drag.overlayId = null;
        drag.finalLeft = 0;
        drag.finalTop = 0;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [
      updateTextOverlay,
      updateImageOverlay,
      videoRef,
      textOverlays,
      imageOverlays,
    ]
  );

  const startResize = useCallback(
    (overlayId: string, handle: Position, e: React.MouseEvent) => {
      e.stopPropagation();
      const target = e.currentTarget.parentElement as HTMLElement;
      const container = containerRef.current;
      if (!container) return;

      const elementRect = target.getBoundingClientRect();

      const { x: currentX, y: currentY } = getTransformPosition(target);

      resizeRef.current = {
        isResizing: true,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: elementRect.width,
        startHeight: elementRect.height,
        startLeft: currentX,
        startTop: currentY,
        finalHeight: 0,
        finalLeft: 0,
        finalTop: 0,
        finalWidth: 0,
        rafId: null,
        overlayId,
      };

      setSelectedOverlay(overlayId);

      const onMouseMove = (ev: MouseEvent) => {
        const resize = resizeRef.current;
        if (!resize.isResizing) return;

        const dx = ev.clientX - resize.startX;
        const dy = ev.clientY - resize.startY;
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
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
            target.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0)`;
            target.style.width = `${newWidth}px`;
            target.style.height = `${newHeight}px`;
          }
        });
      };

      const onMouseUp = () => {
        const { overlayId, finalLeft, finalTop } = resizeRef.current;
        resizeRef.current.isResizing = false;

        if (overlayId && videoRef?.current) {
          const newWidth = parseFloat(target.style.width);
          const newHeight = parseFloat(target.style.height);

          const { x, y } = getOverlayNormalizedCoords(videoRef.current, {
            overlayX: finalLeft,
            overlayY: finalTop,
          });

          updateImageOverlay(overlayId, {
            width: newWidth,
            height: newHeight,
            x,
            y,
          });
        }

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateImageOverlay, videoRef]
  );

  return (
    <OverlaysContext.Provider
      value={{
        videoRef,
        setVideoRef,
        textOverlays,
        imageOverlays,
        selectedOverlay,
        setSelectedOverlay,
        addTextOverlay,
        addImageOverlay,
        updateTextOverlay,
        updateImageOverlay,
        deleteTextOverlay,
        deleteImageOverlay,
        getTimeBasedOverlays,
        getAllVisibleOverlays,
        containerRef,
        startDrag,
        startResize,
        textOverlaysRef,
        imageOverlaysRef,
      }}
    >
      {children}
    </OverlaysContext.Provider>
  );
};

export const useTextOverlays = () =>
  useContextSelector(OverlaysContext, (state) => ({
    textOverlays: state.textOverlays,
    updateTextOverlay: state.updateTextOverlay,
    deleteTextOverlay: state.deleteTextOverlay,
  }));

export const useImageOverlays = () =>
  useContextSelector(OverlaysContext, (state) => ({
    imageOverlays: state.imageOverlays,
    updateImageOverlay: state.updateImageOverlay,
    deleteImageOverlay: state.deleteImageOverlay,
  }));

export const useOverlayControls = () =>
  useContextSelector(OverlaysContext, (state) => ({
    selectedOverlay: state.selectedOverlay,
    setSelectedOverlay: state.setSelectedOverlay,
    addTextOverlay: state.addTextOverlay,
    addImageOverlay: state.addImageOverlay,
    getTimeBasedOverlays: state.getTimeBasedOverlays,
    getAllVisibleOverlays: state.getAllVisibleOverlays,
    containerRef: state.containerRef,
    startDrag: state.startDrag,
    startResize: state.startResize,
    textOverlaysRef: state.textOverlaysRef,
    imageOverlaysRef: state.imageOverlaysRef,
    videoRef: state.videoRef,
    setVideoRef: state.setVideoRef,
  }));
