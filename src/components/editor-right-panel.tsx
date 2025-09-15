"use client";

import React, { startTransition, useState } from "react";
import {
  Scissors,
  Type,
  Image as ImageIcon,
  Music,
  Video,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DualVideoControls } from "./dual-video-controls";
import TextOverlayItemContainer from "./text-overlay-item";
import ImageOverlayItemContainer from "./image-overlay-item";
import { FileUpload } from "./ui/file-upload";
import type {
  ClipToolType,
  DualVideoClip,
  DualVideoSettings,
  S3ClipData,
  AudioTrack,
} from "@/types/app";
import { formatTime } from "@/utils/app";
import { toast } from "sonner";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";

interface EditorRightPanelProps {
  isVideoLoaded: boolean;
  duration: number;
  clipData: S3ClipData;
  audioTracks: AudioTrack[];
  onAudioTrackUpdate: (id: string, updates: Partial<AudioTrack>) => void;
  onAudioTrackDelete: (id: string) => void;
  onAddAudioTrack: () => void;
  secondaryClip: DualVideoClip | null;
  dualVideoSettings: DualVideoSettings;
  onSecondaryClipChange: (clip: DualVideoClip | null) => void;
  onDualVideoSettingsChange: (settings: DualVideoSettings) => void;
  onAddSecondaryClip: (file: File) => void;
}

const TAB_CONFIG = [
  {
    id: "clips" as const,
    icon: Scissors,
    label: "Clips",
  },
  {
    id: "text" as const,
    icon: Type,
    label: "Text",
  },
  {
    id: "image" as const,
    icon: ImageIcon,
    label: "Image",
  },
  {
    id: "audio" as const,
    icon: Music,
    label: "Audio",
  },
  {
    id: "dual" as const,
    icon: Video,
    label: "Dual Video",
  },
];

export function EditorRightPanel({
  isVideoLoaded,
  duration,
  clipData,
  audioTracks,
  onAudioTrackUpdate,
  onAudioTrackDelete,
  onAddAudioTrack,
  secondaryClip,
  dualVideoSettings,
  onSecondaryClipChange,
  onDualVideoSettingsChange,
  onAddSecondaryClip,
}: EditorRightPanelProps) {
  const [activeTab, setActiveTab] = useState<ClipToolType>("clips");
  const { addTextOverlay, addImageOverlay } = useShallowSelector(
    OverlaysContext,
    (state) => ({
      addTextOverlay: state.addTextOverlay,
      addImageOverlay: state.addImageOverlay,
    })
  );

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    addImageOverlay(file, 0, duration);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "clips":
        return (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground-default flex items-center gap-2">
              <Scissors size={16} />
              <span>Clips</span>
            </h3>
            {[
              {
                id: clipData.metadata.clipId,
                startTime: clipData.metadata.clipStartTime,
                endTime: clipData.metadata.clipEndTime,
              },
            ].map((clip) => (
              <div key={clip.id}>
                <div className="font-medium text-foreground-default text-sm">{`Clip ${clip.id}`}</div>
                <div className="text-xs text-foreground-subtle">
                  {formatTime(clip.endTime - clip.startTime)}
                </div>
              </div>
            ))}
          </div>
        );

      case "text":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground-default flex items-center gap-2">
                <Type size={16} />
                <span>Text</span>
              </h3>
              <Button
                onClick={() => addTextOverlay(0, duration)}
                className="h-7 w-7 p-0"
                variant="default"
                size="icon"
              >
                <Type size={16} />
              </Button>
            </div>
            <TextOverlayItemContainer duration={duration} />
          </div>
        );

      case "image":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground-default flex items-center gap-2">
                <ImageIcon size={16} />
                <span>Image</span>
              </h3>
            </div>
            <FileUpload
              accept="image/*"
              hint="Select an image to add as overlay"
              onChange={handleImageFileSelect}
              name="image-overlay"
            />
            <ImageOverlayItemContainer duration={duration} />
          </div>
        );

      case "audio":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground-default flex items-center gap-2">
                <Music size={16} />
                <span>Audio</span>
              </h3>
              <Button
                onClick={onAddAudioTrack}
                className="h-7 w-7 p-0"
                variant="default"
                size="icon"
              >
                <Music size={16} />
              </Button>
            </div>
            {audioTracks.map((track) => (
              <div
                key={track.id}
                className="p-3 rounded-lg border border-subtle bg-surface-secondary"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium truncate text-foreground-default text-sm">
                    {track.name}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Button
                      onClick={() =>
                        onAudioTrackUpdate(track.id, {
                          visible: !track.visible,
                        })
                      }
                      className={cn(
                        "h-7 w-7 p-0",
                        track.visible
                          ? "text-accent-primary"
                          : "text-foreground-muted"
                      )}
                      variant="ghost"
                      size="icon"
                    >
                      {track.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </Button>
                    <Button
                      onClick={() => onAudioTrackDelete(track.id)}
                      className="h-7 w-7 p-0 text-error hover:text-error/80"
                      variant="ghost"
                      size="icon"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-foreground-subtle mb-1">
                      Volume
                    </label>
                    <Input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={track.volume}
                      onChange={(e) =>
                        onAudioTrackUpdate(track.id, {
                          volume: parseFloat(e.target.value),
                        })
                      }
                      className="h-7"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-foreground-subtle mb-1">
                        Start Time
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max={(duration - 1000) / 1000}
                        value={Math.floor(track.startTime / 1000)}
                        onChange={(e) =>
                          onAudioTrackUpdate(track.id, {
                            startTime: parseInt(e.target.value) * 1000,
                          })
                        }
                        className="px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-subtle mb-1">
                        End Time
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max={duration / 1000}
                        value={Math.floor(track.endTime / 1000)}
                        onChange={(e) =>
                          onAudioTrackUpdate(track.id, {
                            endTime: parseInt(e.target.value) * 1000,
                          })
                        }
                        className="px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "dual":
        return (
          <DualVideoControls
            primaryClip={clipData}
            secondaryClip={secondaryClip}
            settings={dualVideoSettings}
            onSecondaryClipChange={onSecondaryClipChange}
            onSettingsChange={onDualVideoSettingsChange}
            onAddSecondaryClip={onAddSecondaryClip}
            disabled={!isVideoLoaded}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full bg-surface-primary flex flex-col">
      <div className="flex">
        {TAB_CONFIG.map(({ id, icon: Icon }) => (
          <Button
            key={id}
            onClick={() => startTransition(() => setActiveTab(id))}
            className={cn(
              "flex-1 rounded-none text-xs transition-colors",
              activeTab === id
                ? "bg-primary text-foreground-on-accent border-b-2 border-primary"
                : "text-foreground-subtle hover:text-foreground-default hover:bg-surface-hover"
            )}
            size="sm"
            variant="ghost"
            disabled={!isVideoLoaded}
          >
            <Icon size={16} />
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 h-full">
        {renderTabContent()}
      </div>
    </div>
  );
}
