"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Scissors, Type, Image as ImageIcon, Music, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import DualVideoControls from "./dual-video-controls";
import TextOverlayItemContainer from "./text-overlay-item";
import ImageOverlayItemContainer from "./image-overlay-item";
import { FileUpload } from "./ui/file-upload";
import AudioItemContainer from "@/components/audio-item";
import type { S3ClipData } from "@/types/app";
import { AudioContext } from "@/contexts/audio-context";
import { formatTime, getStorageKey } from "@/utils/app";
import { toast } from "sonner";
import { useShallowSelector } from "react-shallow-store";
import { OverlaysContext } from "@/contexts/overlays-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { KeyframeContext } from "@/contexts/keyframe-context";
import KeyframePanelLists from "@/components/keyframe-panel-lists";

interface EditorRightPanelProps {
  isVideoLoaded: boolean;
  duration: number;
  clipData: S3ClipData;
}

const STORAGE_KEY = getStorageKey("lastActiveSections");

export function EditorRightPanel({
  isVideoLoaded,
  duration,
  clipData,
}: EditorRightPanelProps) {
  const [activeSections, setActiveSections] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return ["clips"];
    }

    try {
      const saved = localStorage.getItem(getStorageKey("lastActiveSections"));
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    return ["clips"];
  });

  const { addAudioTrack } = useShallowSelector(AudioContext, (state) => ({
    addAudioTrack: state.addAudioTrack,
  }));

  const { addTextOverlay, addImageOverlay } = useShallowSelector(
    OverlaysContext,
    (state) => ({
      addTextOverlay: state.addTextOverlay,
      addImageOverlay: state.addImageOverlay,
    })
  );

  const { keyframes, currentKeyframeId, setCurrentKeyframeId, setKeyframes } =
    useShallowSelector(KeyframeContext, (state) => ({
      keyframes: state.keyframes,
      currentKeyframeId: state.currentKeyframeId,
      setCurrentKeyframeId: state.setCurrentKeyframeId,
      setKeyframes: state.setKeyframes,
    }));

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

  const handleAudioFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      addAudioTrack(file, duration);
    },
    [addAudioTrack, duration]
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
              <Scissors size={14} />
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
                  <div className="text-sm md:text-[0.8rem] text-foreground-subtle">
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
              <Type size={14} />
              <span>Text</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => addTextOverlay(0, duration)}
                  className="h-8 px-2 text-sm md:text-[0.8rem]"
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
              <ImageIcon size={14} />
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
              <Music size={14} />
              <span>Audio</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <FileUpload
                accept="audio/*"
                hint="Add an audio track"
                onChange={handleAudioFileSelect}
                name="audio-track"
              />
              <AudioItemContainer duration={duration} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="keyframes">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Type size={14} />
              <span>Keyframes</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <KeyframePanelLists
              keyframes={keyframes}
              currentKeyframeId={currentKeyframeId}
              onKeyframeSelect={(id) => setCurrentKeyframeId(id)}
              onKeyframeRemove={(id) => {
                setKeyframes((prev) => prev.filter((x) => x.id !== id));
                if (currentKeyframeId === id) {
                  setCurrentKeyframeId(null);
                }
              }}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dual">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Video size={14} />
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
      handleImageFileSelect,
      keyframes,
      currentKeyframeId,
      setCurrentKeyframeId,
      setKeyframes,
    ]
  );

  return (
    <div className="w-full h-full bg-surface-primary flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 h-full no-scrollbar">
        {renderAccordion()}
      </div>
    </div>
  );
}
