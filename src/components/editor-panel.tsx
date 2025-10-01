import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  forwardRef,
  useCallback,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { X } from "lucide-react";
import { useAnimatePresence } from "@/hooks/use-animate-presence";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useClientOnly } from "@/hooks/use-client-only";
import { useControllableState } from "@/hooks/use-controllable-state";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type EditorSide = "left" | "right";

type AnimationState = "entering" | "exiting" | "idle";

interface EditorPanelContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: EditorSide;
  disablePortal?: boolean;
  triggerId: string;
  contentId: string;
  titleId: string;
  descriptionId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  animationState: AnimationState;
  shouldRender: boolean;
}

interface EditorPanelRootProps extends React.ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  side?: EditorSide;
  disablePortal?: boolean;
}

interface EditorPanelTriggerProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  asChild?: boolean;
}

interface EditorPanelContentProps
  extends React.ComponentPropsWithoutRef<"div"> {
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onPointerDownOutside?: (event: PointerEvent) => void;
  sideOffset?: number;
  forceMount?: boolean;
  focusFirst?: boolean;
}

interface EditorPanelPortalProps {
  children: React.ReactNode;
  container?: Element | null;
  forceMount?: boolean;
}

const EditorPanelContext = createContext<EditorPanelContextType | null>(null);

const useEditorPanel = () => {
  const context = useContext(EditorPanelContext);
  if (!context) {
    throw new Error(
      "EditorPanel components must be used within EditorPanel.Root"
    );
  }
  return context;
};

const EditorPanelRoot = forwardRef<HTMLDivElement, EditorPanelRootProps>(
  (
    {
      children,
      open: controlledOpen,
      onOpenChange,
      defaultOpen = false,
      side = "right",
      disablePortal = false,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = useControllableState({
      defaultValue: defaultOpen,
      controlled: controlledOpen,
      onChange: onOpenChange,
    });

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    const triggerId = useId();
    const contentId = useId();
    const titleId = useId();
    const descriptionId = useId();

    const [animationState, setAnimationState] =
      useState<AnimationState>("idle");

    const handleAnimation = (presence: boolean) => {
      return new Promise<void>((resolve) => {
        if (presence) {
          setAnimationState("entering");
          resolve();
          return;
        }

        setAnimationState("exiting");

        const node = contentRef.current;
        if (!node) {
          setAnimationState("idle");
          resolve();
          return;
        }

        const onAnimationEnd = () => {
          setAnimationState("idle");
          node.removeEventListener("animationend", onAnimationEnd);
          node.removeEventListener("transitionend", onAnimationEnd);
          resolve();
        };

        node.addEventListener("animationend", onAnimationEnd);
        node.addEventListener("transitionend", onAnimationEnd);
      });
    };

    const shouldRender = useAnimatePresence(open, handleAnimation, {
      initial: false,
    });

    const contextValue: EditorPanelContextType = {
      open,
      onOpenChange: setOpen,
      side,
      disablePortal,
      triggerId,
      contentId,
      titleId,
      descriptionId,
      triggerRef,
      contentRef,
      animationState,
      shouldRender,
    };

    return (
      <EditorPanelContext.Provider value={contextValue}>
        <div ref={ref} {...props}>
          {children}
        </div>
      </EditorPanelContext.Provider>
    );
  }
);

EditorPanelRoot.displayName = "EditorPanel.Root";

const EditorPanelTrigger = forwardRef<
  HTMLButtonElement,
  EditorPanelTriggerProps
>(({ children, asChild = false, onClick, className, ...props }, ref) => {
  const { onOpenChange, open, triggerId, contentId, triggerRef } =
    useEditorPanel();
  const composedRefs = useComposedRefs(ref, triggerRef);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        onOpenChange(!open);
      }
    },
    [onClick, onOpenChange, open]
  );

  const triggerProps = {
    ref: composedRefs,
    id: triggerId,
    "aria-expanded": open,
    "aria-controls": contentId,
    "aria-haspopup": "dialog" as const,
    onClick: handleClick,
    ...props,
  };

  if (asChild) {
    return <Slot {...triggerProps}>{children}</Slot>;
  }

  return (
    <Button type="button" {...triggerProps}>
      {children}
    </Button>
  );
});

EditorPanelTrigger.displayName = "EditorPanel.Trigger";

const EditorPanelPortal: React.FC<EditorPanelPortalProps> = ({
  children,
  container,
  forceMount = false,
}) => {
  const { disablePortal, shouldRender } = useEditorPanel();
  const hasMounted = useClientOnly();

  if (!hasMounted) return null;
  if (!forceMount && !shouldRender) return null;
  if (disablePortal) return <>{children}</>;

  const portalContainer = container || document.body;
  return createPortal(children, portalContainer);
};

EditorPanelPortal.displayName = "EditorPanel.Portal";

const EditorPanelContent = forwardRef<HTMLDivElement, EditorPanelContentProps>(
  (
    {
      children,
      className = "",
      onEscapeKeyDown,
      onPointerDownOutside,
      sideOffset = 0,
      forceMount = false,
      focusFirst = false,
      style,
      ...props
    },
    forwardedRef
  ) => {
    const {
      open,
      onOpenChange,
      side,
      contentId,
      triggerRef,
      contentRef,
      titleId,
      descriptionId,
      shouldRender,
      animationState,
    } = useEditorPanel();

    const ref = useRef<HTMLDivElement | null>(null);

    const composedRefs = useComposedRefs(ref, forwardedRef, contentRef);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          onEscapeKeyDown?.(event);
          onOpenChange(false);
        }
      };

      if (open) {
        document.addEventListener("keydown", handleKeyDown, { capture: true });
        return () =>
          document.removeEventListener("keydown", handleKeyDown, {
            capture: true,
          });
      }
    }, [open, onEscapeKeyDown, onOpenChange]);

    useEffect(() => {
      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as Node;
        const content = ref.current;
        const trigger = triggerRef.current;

        if (
          open &&
          content &&
          !content.contains(target) &&
          trigger &&
          !trigger.contains(target)
        ) {
          onPointerDownOutside?.(event);
        }
      };

      if (open) {
        document.addEventListener("pointerdown", handlePointerDown, {
          capture: true,
        });
        return () =>
          document.removeEventListener("pointerdown", handlePointerDown, {
            capture: true,
          });
      }
    }, [open, onPointerDownOutside, triggerRef]);

    useEffect(() => {
      const content = ref.current;
      if (!content) return;

      if (open) {
        const focusableElements = content.querySelectorAll(
          'input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0] as HTMLElement;
        firstFocusable?.focus();

        const handleTabKey = (event: KeyboardEvent) => {
          if (event.key !== "Tab") return;

          const focusableArray = Array.from(focusableElements) as HTMLElement[];
          const firstElement = focusableArray[0];
          const lastElement = focusableArray[focusableArray.length - 1];

          if (event.shiftKey) {
            if (document.activeElement === firstElement) {
              event.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              event.preventDefault();
              firstElement?.focus();
            }
          }
        };

        content.addEventListener("keydown", handleTabKey);
        return () => content.removeEventListener("keydown", handleTabKey);
      }
    }, [open]);

    if (!shouldRender && !forceMount) return null;

    const dataState =
      animationState === "entering"
        ? "open"
        : animationState === "exiting"
        ? "closed"
        : undefined;

    return (
      <div
        ref={composedRefs}
        id={contentId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        data-state={dataState}
        className={cn(
          "fixed top-0 bottom-0 z-50",
          "bg-surface-secondary/95 backdrop-blur-sm",
          "border-l border-default",
          "shadow-2xl shadow-black/20",
          side === "right" ? "right-0" : "left-0",
          side === "right"
            ? "data-[state=open]:animate-panel-enter-right data-[state=closed]:animate-panel-exit-right"
            : "data-[state=open]:animate-panel-enter-left data-[state=closed]:animate-panel-exit-left",
          className
        )}
        style={{
          ...(side === "right"
            ? { marginRight: `${sideOffset}px` }
            : { marginLeft: `${sideOffset}px` }),
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

EditorPanelContent.displayName = "EditorPanel.Content";

const EditorPanelHeader = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ children, className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between",
      "px-6 py-3",
      "border-b border-subtle",
      "bg-surface-secondary/80",
      className
    )}
    {...props}
  >
    {children}
  </div>
));

EditorPanelHeader.displayName = "EditorPanel.Header";

const EditorPanelTitle = forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<"h2">
>(({ children, className = "", ...props }, ref) => {
  const { titleId } = useEditorPanel();

  return (
    <h2
      ref={ref}
      id={titleId}
      className={cn(
        "text-lg font-semibold",
        "text-foreground-default",
        "truncate",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
});

EditorPanelTitle.displayName = "EditorPanel.Title";

const EditorPanelCloseButton = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ className = "", onClick, ...props }, ref) => {
  const { onOpenChange } = useEditorPanel();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        onOpenChange(false);
      }
    },
    [onClick, onOpenChange]
  );

  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn("", className)}
      aria-label="Close panel"
      {...props}
    >
      <X size={18} />
    </Button>
  );
});

EditorPanelCloseButton.displayName = "EditorPanel.CloseButton";

const EditorPanelBody = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ children, className = "", ...props }, ref) => {
  const { descriptionId } = useEditorPanel();

  return (
    <div
      ref={ref}
      id={descriptionId}
      className={cn("flex-1 overflow-y-auto", "px-6 py-4", className)}
      {...props}
    >
      {children}
    </div>
  );
});

EditorPanelBody.displayName = "EditorPanel.Body";

const EditorPanelFooter = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ children, className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-end gap-3",
      "px-6 py-4",
      "border-t border-subtle",
      "bg-surface-secondary/50",
      className
    )}
    {...props}
  >
    {children}
  </div>
));

EditorPanelFooter.displayName = "EditorPanel.Footer";

const EditorPanel = {
  Root: EditorPanelRoot,
  Trigger: EditorPanelTrigger,
  Portal: EditorPanelPortal,
  Content: EditorPanelContent,
  Header: EditorPanelHeader,
  Title: EditorPanelTitle,
  CloseButton: EditorPanelCloseButton,
  Body: EditorPanelBody,
  Footer: EditorPanelFooter,
};

export default EditorPanel;
