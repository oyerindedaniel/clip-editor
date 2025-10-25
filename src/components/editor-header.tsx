"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Download, Crosshair } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";

interface EditorHeaderProps {
  isVideoLoaded: boolean;
  isExporting: boolean;
  onToggleTrace: () => void;
  onOpenExport: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  isVideoLoaded,
  isExporting,
  onToggleTrace,
  onOpenExport,
}) => {
  const isMd = useMediaQuery("(min-width: 768px)");

  return (
    <div className="sticky top-0 z-50 w-full bg-surface-primary border-default border-b">
      <div className="flex relative items-center justify-between px-5 py-2">
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
              variant="outline"
              size={isMd ? "sm" : "icon"}
              disabled={!isVideoLoaded}
              onClick={onToggleTrace}
            >
              <Crosshair size={14} className={isMd ? "md:mr-1" : ""} />
              <span className="hidden md:inline-block">Trace</span>
            </Button>
          </div>

          <Button
            onClick={onOpenExport}
            disabled={isExporting || !isVideoLoaded}
            size="sm"
          >
            <Download size={14} className="mr-2" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditorHeader;
