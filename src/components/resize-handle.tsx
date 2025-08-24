"use client";

import React from "react";

interface ResizeHandleProps {
  position: string;
  cursor: string;
  onMouseDown: (e: React.MouseEvent) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({
  position,
  cursor,
  onMouseDown,
}) => {
  const getPositionStyles = () => {
    const size = 8;
    const offset = size / 2;

    switch (position) {
      case "nw":
        return { top: -offset, left: -offset };
      case "n":
        return { top: -offset, left: "50%", transform: "translateX(-50%)" };
      case "ne":
        return { top: -offset, right: -offset };
      case "e":
        return { top: "50%", right: -offset, transform: "translateY(-50%)" };
      case "se":
        return { bottom: -offset, right: -offset };
      case "s":
        return { bottom: -offset, left: "50%", transform: "translateX(-50%)" };
      case "sw":
        return { bottom: -offset, left: -offset };
      case "w":
        return { top: "50%", left: -offset, transform: "translateY(-50%)" };
      default:
        return {};
    }
  };

  return (
    <div
      className="absolute w-2 h-2 bg-primary border border-white rounded-full shadow-sm z-10"
      style={{
        ...getPositionStyles(),
        cursor,
      }}
      onMouseDown={onMouseDown}
    />
  );
};

export { ResizeHandle };
