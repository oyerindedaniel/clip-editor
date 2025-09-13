"use client";

import React, { useRef, useCallback, useId, useMemo, useState } from "react";
import { Button } from "./button";
import { Upload, X, Image as ImageIcon, File as FileIcon } from "lucide-react";

interface FileUploadProps {
  accept: string;
  hint?: string;
  value?: FileList | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  name: string;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  hint = "No file chosen",
  value,
  onChange,
  onBlur,
  name,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const isFile = value && value.length > 0;
  const selectedFile = isFile ? value![0] : null;
  const previewUrl = useMemo(() => {
    if (!selectedFile) return null;
    if (selectedFile.type.startsWith("image/")) {
      return URL.createObjectURL(selectedFile);
    }
    return null;
  }, [selectedFile]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearFile = useCallback(() => {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    const dt = new DataTransfer();
    inputRef.current.files = dt.files;
    inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      if (!inputRef.current) return;
      const dt = new DataTransfer();
      dt.items.add(files[0]);
      inputRef.current.files = dt.files;
      inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [disabled]
  );

  return (
    <div className="rounded-lg border border-subtle bg-surface-secondary overflow-hidden">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={
          "cursor-pointer p-3 transition-colors " +
          (isDragging ? "bg-surface-hover" : "bg-surface-secondary")
        }
        aria-disabled={disabled}
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-md border border-subtle flex items-center justify-center bg-surface-tertiary overflow-hidden">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="preview"
                className="h-full w-full object-cover"
              />
            ) : isFile ? (
              <FileIcon size={20} className="text-foreground-muted" />
            ) : (
              <ImageIcon size={20} className="text-foreground-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-foreground-default truncate">
              {isFile ? selectedFile!.name : hint}
            </div>
            <div className="text-xs text-foreground-subtle">
              {isFile
                ? `${selectedFile!.type || "Unknown type"} • ${formatSize(
                    selectedFile!.size
                  )}`
                : formatAccept(accept)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isFile ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                disabled={disabled}
              >
                <X size={14} />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={disabled}
              >
                <Upload size={12} className="mr-2" />
                Browse
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 text-xs text-foreground-subtle">
          Drag & drop or click to {isFile ? "replace" : "upload"}
        </div>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        disabled={disabled}
        onChange={onChange}
        onBlur={onBlur}
        className="hidden"
      />
    </div>
  );
};

export { FileUpload };

function formatAccept(accept: string): string {
  if (!accept) return "Any file";

  return accept
    .split(",")
    .map((type) => {
      type = type.trim();

      if (type.endsWith("/*")) {
        const category = type.split("/")[0];
        switch (category) {
          case "image":
            return "Image";
          case "video":
            return "Video";
          case "audio":
            return "Audio";
          default:
            return category.charAt(0).toUpperCase() + category.slice(1);
        }
      }

      const parts = type.split("/");
      if (parts.length === 2) {
        return parts[1].toUpperCase();
      }

      return type;
    })
    .join(", ");
}
