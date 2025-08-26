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
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);

  const isFile = value && value.length > 0;

  return (
    <div className="flex items-center border border-gray-700/50 rounded-lg p-3 bg-surface-secondary">
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
        className="flex items-center space-x-2"
        disabled={disabled}
        onClick={handleClick}
      >
        <Upload size={16} />
        <span>Choose file</span>
      </Button>

      <span className="ml-3 text-sm text-foreground-subtle truncate">
        {isFile ? value[0]?.name : hint}
      </span>
    </div>
  );
};

export { FileUpload };
