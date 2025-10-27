"use client";

import React, { useRef, useCallback, useState } from "react";
import { Upload, LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import logger from "@/utils/logger";

interface UploadVideoItemProps {
  onVideoUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
  className?: string;
}

export default function UploadVideoItem({
  onVideoUpload,
  isUploading = false,
  className,
}: UploadVideoItemProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("video/")) {
        logger.warn("Invalid file type selected:", file.type);
        return;
      }

      try {
        await onVideoUpload(file);
      } catch (error) {
        logger.error("Failed to upload video:", error);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onVideoUpload]
  );

  const handleClick = useCallback(() => {
    if (isUploading) return;
    fileInputRef.current?.click();
  }, [isUploading]);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isUploading) {
        setIsDragOver(true);
      }
    },
    [isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (isUploading) return;

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const file = files[0];
      if (!file.type.startsWith("video/")) {
        logger.warn("Invalid file type dropped:", file.type);
        return;
      }

      try {
        await onVideoUpload(file);
      } catch (error) {
        logger.error("Failed to upload video:", error);
      }
    },
    [onVideoUpload, isUploading]
  );

  return (
    <div
      className={cn(
        "p-4 bg-surface-secondary rounded-3xl aspect-[4/3] w-full h-full group",
        className
      )}
    >
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "bg-surface-secondary rounded-2xl h-full overflow-hidden border-2 border-dashed transition-all duration-200 cursor-pointer group",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-subtle hover:border-primary/50 hover:bg-surface-hover/50",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="bg-surface-tertiary relative overflow-hidden aspect-[4/3] w-full h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              {isUploading ? (
                <LoaderIcon className="text-primary animate-spin" size={24} />
              ) : (
                <Upload className="text-primary" size={24} />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground-default mb-1">
                {isUploading ? "Processing..." : "Add New Video"}
              </p>
              <p className="text-xs text-foreground-subtle font-mono">
                MP4, WebM, MOV
              </p>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
    </div>
  );
}
