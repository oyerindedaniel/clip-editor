"use client";

import React, {
  createContext,
  useMemo,
  useState,
  ReactNode,
  useCallback,
} from "react";
import type { AudioTrack } from "@/types/app";
import { useContextStore, type StoreApi } from "react-shallow-store";
import { useLatestValue } from "@/hooks/use-latest-value";

type AudioContextValue = {
  audioTracks: AudioTrack[];
  audioTracksRef: React.RefObject<AudioTrack[]>;
  setAudioTracks: React.Dispatch<React.SetStateAction<AudioTrack[]>>;
  addAudioTrack: (file: File, duration: number) => void;
  updateAudioTrack: (id: string, updates: Partial<AudioTrack>) => void;
  deleteAudioTrack: (id: string) => void;
};

export const AudioContext = createContext<StoreApi<AudioContextValue> | null>(
  null
);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);

  const audioTracksRef = useLatestValue(audioTracks);

  const addAudioTrack = useCallback((file: File, duration: number): void => {
    const id = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const url = URL.createObjectURL(file);

    setAudioTracks((prev) => [
      ...prev,
      {
        id,
        name: file.name,
        file,
        url,
        startTime: 0,
        endTime: duration,
        volume: 1,
        visible: true,
      },
    ]);
  }, []);

  const updateAudioTrack = useCallback(
    (id: string, updates: Partial<AudioTrack>) => {
      setAudioTracks((tracks) =>
        tracks.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const deleteAudioTrack = useCallback((id: string) => {
    setAudioTracks((tracks) => {
      const track = tracks.find((t) => t.id === id);
      if (track && track.url?.startsWith("blob:"))
        URL.revokeObjectURL(track.url);
      return tracks.filter((t) => t.id !== id);
    });
  }, []);

  const value = useMemo(
    () => ({
      audioTracks,
      setAudioTracks,
      addAudioTrack,
      updateAudioTrack,
      deleteAudioTrack,
      audioTracksRef,
    }),
    [audioTracks, addAudioTrack, updateAudioTrack, deleteAudioTrack]
  );

  const store = useContextStore(value);

  return (
    <AudioContext.Provider value={store}>{children}</AudioContext.Provider>
  );
}
