"use client";

import React, { useState, useCallback } from "react";
import {
  Video,
  Settings,
  Trash2,
  Eye,
  EyeOff,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyCenter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";
import type {
  DualVideoClip,
  DualVideoSettings,
  DualVideoLayout,
  DualVideoOrientation,
  S3ClipData,
} from "@/types/app";

interface DualVideoControlsProps {
  primaryClip: S3ClipData;
  secondaryClip: DualVideoClip | null;
  settings: DualVideoSettings;
  onSecondaryClipChange: (clip: DualVideoClip | null) => void;
  onSettingsChange: (settings: DualVideoSettings) => void;
  onAddSecondaryClip: (file: File) => void;
  disabled?: boolean;
}

export function DualVideoControls({
  primaryClip,
  secondaryClip,
  settings,
  onSecondaryClipChange,
  onSettingsChange,
  onAddSecondaryClip,
  disabled = false,
}: DualVideoControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith("video/")) {
        onAddSecondaryClip(file);
      }
    },
    [onAddSecondaryClip]
  );

  const updateSetting = useCallback(
    <K extends keyof DualVideoSettings>(
      key: K,
      value: DualVideoSettings[K]
    ) => {
      onSettingsChange({ ...settings, [key]: value });
    },
    [settings, onSettingsChange]
  );

  const updateSecondaryClip = useCallback(
    (updates: Partial<DualVideoClip>) => {
      if (secondaryClip) {
        onSecondaryClipChange({ ...secondaryClip, ...updates });
      }
    },
    [secondaryClip, onSecondaryClipChange]
  );

  if (!secondaryClip) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground-default">🎥</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Settings size={14} />
          </Button>
        </div>

        <div className="space-y-2">
          <FileUpload
            accept="video/*"
            hint="Add a second video clip"
            onChange={handleFileSelect}
            name="secondary-video"
            disabled={disabled}
          />

          {isExpanded && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="space-y-2">
                <label className="text-xs text-foreground-subtle">Layout</label>
                <Select
                  value={settings.layout}
                  onValueChange={(value: DualVideoLayout) =>
                    updateSetting("layout", value)
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vertical">
                      <div className="flex items-center space-x-2">
                        <AlignVerticalJustifyCenter size={14} />
                        <span>Vertical</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="horizontal">
                      <div className="flex items-center space-x-2">
                        <AlignHorizontalJustifyCenter size={14} />
                        <span>Horizontal</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-foreground-subtle">
                  Output Orientation
                </label>
                <Select
                  value={settings.outputOrientation}
                  onValueChange={(value: DualVideoOrientation) =>
                    updateSetting("outputOrientation", value)
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vertical">Vertical (9:16)</SelectItem>
                    <SelectItem value="horizontal">
                      Horizontal (16:9)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground-default">🎥</h3>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Settings size={14} />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={() => onSecondaryClipChange(null)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-surface-secondary">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center space-x-2">
              <Video size={14} className="text-foreground-subtle" />
              <span className="text-xs font-medium text-foreground-default truncate">
                {secondaryClip.metadata.originalFilename || "Secondary Clip"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                updateSecondaryClip({ visible: !secondaryClip.visible })
              }
              className="p-1 h-6 w-6"
            >
              {secondaryClip.visible ? (
                <Eye size={14} className="text-accent-primary" />
              ) : (
                <EyeOff size={14} className="text-foreground-muted" />
              )}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-2">
              <label className="text-xs text-foreground-subtle">Layout</label>
              <Select
                value={settings.layout}
                onValueChange={(value: DualVideoLayout) =>
                  updateSetting("layout", value)
                }
                disabled={disabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">
                    <div className="flex items-center space-x-2">
                      <AlignVerticalJustifyCenter size={14} />
                      <span>Vertical</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="horizontal">
                    <div className="flex items-center space-x-2">
                      <AlignHorizontalJustifyCenter size={14} />
                      <span>Horizontal</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-foreground-subtle">
                Output Orientation
              </label>
              <Select
                value={settings.outputOrientation}
                onValueChange={(value: DualVideoOrientation) =>
                  updateSetting("outputOrientation", value)
                }
                disabled={disabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">Vertical</SelectItem>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
