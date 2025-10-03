"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Scissors, Type, Image as ImageIcon, Music, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import DualVideoControls from "./dual-video-controls";
import TextOverlayItemContainer from "./text-overlay-item";
import ImageOverlayItemContainer from "./image-overlay-item";
import { FileUpload } from "./ui/file-upload";
import AudioItem from "@/components/audio-item";
import type { S3ClipData, AudioTrack } from "@/types/app";
import { formatTime } from "@/utils/app";
import { toast } from "sonner";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface EditorRightPanelProps {
  isVideoLoaded: boolean;
  duration: number;
  clipData: S3ClipData;
  audioTracks: AudioTrack[];
  onAudioTrackUpdate: (id: string, updates: Partial<AudioTrack>) => void;
  onAudioTrackDelete: (id: string) => void;
  onAddAudioTrack: () => void;
}

const STORAGE_KEY = "zinc:lastActiveSections";

export function EditorRightPanel({
  isVideoLoaded,
  duration,
  clipData,
  audioTracks,
  onAudioTrackUpdate,
  onAudioTrackDelete,
  onAddAudioTrack,
}: EditorRightPanelProps) {
  const [activeSections, setActiveSections] = useState<string[]>(["clips"]);

  const { addTextOverlay, addImageOverlay } = useShallowSelector(
    OverlaysContext,
    (state) => ({
      addTextOverlay: state.addTextOverlay,
      addImageOverlay: state.addImageOverlay,
    })
  );

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActiveSections(parsed);
        }
      } catch {}
    }
  }, []);

  const handleImageFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      addImageOverlay(file, 0, duration);
    },
    [addImageOverlay, duration]
  );

  const handleAccordionChange = (sections: string[]) => {
    setActiveSections(sections);

    if (sections.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const renderAccordion = useCallback(
    () => (
      <Accordion
        type="multiple"
        value={activeSections}
        onValueChange={(v) => handleAccordionChange(v)}
      >
        <AccordionItem value="clips">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Scissors size={16} />
              <span>Clips</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="text">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Type size={16} />
              <span>Text</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => addTextOverlay(0, duration)}
                  className="h-8 px-2 text-xs"
                  variant="outline"
                  size="sm"
                >
                  <Type size={14} className="mr-1" /> Add Text
                </Button>
              </div>
              <TextOverlayItemContainer duration={duration} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="image">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <ImageIcon size={16} />
              <span>Image</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <FileUpload
                accept="image/*"
                hint="Add an image overlay"
                onChange={handleImageFileSelect}
                name="image-overlay"
              />
              <ImageOverlayItemContainer duration={duration} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="audio">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Music size={16} />
              <span>Audio</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <Button
                onClick={onAddAudioTrack}
                className="h-8 px-2 text-xs"
                variant="outline"
                size="sm"
              >
                <Music size={14} className="mr-1" /> Add Audio
              </Button>
              {audioTracks.map((track) => (
                <AudioItem
                  key={track.id}
                  track={track}
                  duration={duration}
                  onUpdate={onAudioTrackUpdate}
                  onDelete={onAudioTrackDelete}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dual">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Video size={16} />
              <span>Dual Video</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <DualVideoControls
              primaryClip={clipData}
              disabled={!isVideoLoaded}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    ),
    [
      activeSections,
      addTextOverlay,
      clipData,
      duration,
      isVideoLoaded,
      onAddAudioTrack,
      onAudioTrackDelete,
      onAudioTrackUpdate,
      audioTracks,
      handleImageFileSelect,
    ]
  );

  return (
    <div className="w-full h-full bg-surface-primary flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 h-full">
        {renderAccordion()}
      </div>
    </div>
  );
}
