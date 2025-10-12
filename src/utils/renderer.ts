import * as React from "react";

export const CANVAS_RENDERER_SYMBOL = Symbol("renderer.canvas");

export const DOM_RENDERER_SYMBOL = Symbol("renderer.dom");

export interface TaggedRendererComponent<P = {}> extends React.FC<P> {
  _rendererType: symbol;
}

const isRendererOfType = (
  element: React.ReactNode,
  rendererSymbol: symbol
): boolean => {
  if (!React.isValidElement(element)) return false;
  const component = element.type;
  if (typeof component !== "function") return false;
  return (
    "_rendererType" in component && component._rendererType === rendererSymbol
  );
};

const getRendererType = (element: React.ReactNode): symbol | null => {
  if (!React.isValidElement(element)) return null;
  const component = element.type;
  if (typeof component !== "function") return null;
  return "_rendererType" in component &&
    typeof component._rendererType === "symbol"
    ? component._rendererType
    : null;
};

export { getRendererType, isRendererOfType };
