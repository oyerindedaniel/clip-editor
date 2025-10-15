"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Trash2, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AudioTrack } from "@/types/app";
import { useShallowSelector } from "react-shallow-store";
import { AudioContext } from "@/contexts/audio-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AudioItemProps {
  track: AudioTrack;
  duration: number;
  onUpdate: (id: string, updates: Partial<AudioTrack>) => void;
  onDelete: (id: string) => void;
}

const AudioItem: React.FC<AudioItemProps> = ({
  track,
  duration,
  onUpdate,
  onDelete,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="w-full rounded-3xl border border-subtle bg-surface-secondary overflow-hidden cursor-pointer">
          <div className="flex items-center justify-between px-3 h-10">
            <div className="min-w-0 mr-2 flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl border border-subtle bg-surface-tertiary flex items-center justify-center">
                <Music size={14} className="text-foreground-muted" />
              </div>
              <div className="text-xs tracking-wide font-medium text-foreground-default truncate">
                {track.name}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => onUpdate(track.id, { visible: !track.visible })}
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
                onClick={() => onDelete(track.id)}
                className="h-7 w-7 p-0 text-error hover:text-error/80"
                variant="ghost"
                size="icon"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          <div className="px-3 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] tracking-wide text-foreground-subtle mb-1">
                  Start (s)
                </label>
                <Input
                  type="number"
                  min="0"
                  max={(duration - 1000) / 1000}
                  value={Math.floor(track.startTime / 1000)}
                  onChange={(e) =>
                    onUpdate(track.id, {
                      startTime: parseInt(e.target.value) * 1000,
                    })
                  }
                  className="px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-wide text-foreground-subtle mb-1">
                  End (s)
                </label>
                <Input
                  type="number"
                  min="0"
                  max={duration / 1000}
                  value={Math.floor(track.endTime / 1000)}
                  onChange={(e) =>
                    onUpdate(track.id, {
                      endTime: parseInt(e.target.value) * 1000,
                    })
                  }
                  className="px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="flex flex-col gap-1">
          <div className="text-xs tracking-tight font-medium text-foreground-default truncate">
            {track.name}
          </div>
          <div className="text-[11px] tracking-wide text-foreground-subtle">
            Start: {Math.floor(track.startTime / 1000)}s • End:{" "}
            {Math.floor(track.endTime / 1000)}s
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface AudioItemContainerProps {
  duration: number;
}

const AudioItemContainer: React.FC<AudioItemContainerProps> = ({
  duration,
}) => {
  const { audioTracks, updateAudioTrack, deleteAudioTrack } =
    useShallowSelector(AudioContext, (state) => ({
      audioTracks: state.audioTracks,
      updateAudioTrack: state.updateAudioTrack,
      deleteAudioTrack: state.deleteAudioTrack,
    }));

  return (
    <div className="flex flex-col gap-2">
      {audioTracks.map((track) => (
        <AudioItem
          key={track.id}
          track={track}
          duration={duration}
          onUpdate={updateAudioTrack}
          onDelete={deleteAudioTrack}
        />
      ))}
    </div>
  );
};

export default memo(AudioItemContainer);
