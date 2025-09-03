"use client";

import React, { useRef, useCallback, useId } from "react";
import { Button } from "./button";
import { Upload } from "lucide-react";

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

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const isFile = value && value.length > 0;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2">
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

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={disabled}
        onClick={handleClick}
      >
        <Upload size={12} className="mr-2" />
        Choose
      </Button>

      <div className="min-w-0 flex-1 text-xs text-foreground-subtle truncate">
        {isFile ? value![0]?.name : hint}
      </div>
    </div>
  );
};

export { FileUpload };
