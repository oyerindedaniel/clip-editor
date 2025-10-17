"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { debounce } from "@/utils/app";
import { KeyframeData } from "@/utils/keyframe";

interface KeyframeNameInputProps extends React.ComponentProps<typeof Input> {
  currentKeyframeId: string;
  updateKeyframe: (id: string, updates: Partial<KeyframeData>) => void;
  keyframe: KeyframeData;
}

export default function KeyframeNameInput({
  id,
  keyframe,
  currentKeyframeId,
  updateKeyframe,
  ...props
}: KeyframeNameInputProps) {
  const name = keyframe?.name || "Keyframe";
  const [value, setValue] = useState(name);

  const debounced = useMemo(
    () =>
      debounce((next) => {
        updateKeyframe(currentKeyframeId, { name: next });
      }, 300),
    [currentKeyframeId, updateKeyframe]
  );

  useEffect(() => {
    setValue(name);
  }, [name]);

  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        debounced(next);
      }}
      placeholder="Enter name"
      {...props}
    />
  );
}
