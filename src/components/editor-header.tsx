"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Download, Settings, Crosshair } from "lucide-react";

interface EditorHeaderProps {
  isVideoLoaded: boolean;
  isExporting: boolean;
  showTrace: boolean;
  onToggleTrace: () => void;
  onOpenAdjust: () => void;
  onOpenExport: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  isVideoLoaded,
  isExporting,
  showTrace,
  onToggleTrace,
  onOpenAdjust,
  onOpenExport,
}) => {
  return (
    <div className="sticky top-0 z-50 w-full bg-surface-secondary">
      <div className="flex relative items-center justify-between px-5 py-1">
        <Link className="absolute top-2/4 -translate-y-2/4" href="/">
          <Image
            src="/logo/zinc_norms_white.webp"
            alt="Zinc"
            width={64}
            height={64}
            className="h-14 w-14"
            priority
          />
        </Link>
        <div />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button
              className="text-xs"
              variant="outline"
              size="sm"
              disabled={!isVideoLoaded}
              onClick={onToggleTrace}
            >
              <Crosshair size={16} className="mr-1" />
              Trace
            </Button>

            <Button
              className="text-xs"
              variant="outline"
              size="sm"
              disabled={!isVideoLoaded}
              onClick={onOpenAdjust}
            >
              <Settings size={16} className="mr-1" />
              Settings
            </Button>
          </div>

          <Button
            onClick={onOpenExport}
            disabled={isExporting || !isVideoLoaded}
            size="sm"
            className="text-xs bg-primary text-foreground-on-accent hover:bg-primary-hover"
          >
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditorHeader;
