import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ExportSettings } from "@/types/app";
import InfoTooltip from "@/components/info-tooltip";
import { Switch } from "@/components/ui/switch";
import {
  CRF_VALUES,
  EXPORT_BITRATE_MAP,
  FORMAT_OPTIONS,
  FPS_OPTIONS,
  PRESETS,
  RESOLUTION_OPTIONS,
} from "@/constants/app";

interface ExportNamingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  streamerName: string | undefined;
  onExport: (
    outputName: string,
    exportSettings: Pick<
      ExportSettings,
      | "preset"
      | "crf"
      | "fps"
      | "format"
      | "resolution"
      | "bitrate"
      | "customBitrateKbps"
      | "audioBitrateKbps"
      | "audioCompressed"
    >
  ) => void;
}

const ExportNamingDialog: React.FC<ExportNamingDialogProps> = ({
  isOpen,
  onOpenChange,
  streamerName,
  onExport,
}) => {
  const streamerNameRef = useRef<HTMLInputElement | null>(null);
  const clipTitleRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);

  const [preset, setPreset] = useState<ExportSettings["preset"]>("fast");
  const [crf, setCrf] = useState<ExportSettings["crf"]>(23);
  const [fps, setFps] = useState<ExportSettings["fps"]>(30);
  const [format, setFormat] = useState<ExportSettings["format"]>("mp4");
  const [resolution, setResolution] =
    useState<ExportSettings["resolution"]>("720p");
  const [bitrate, setBitrate] =
    useState<ExportSettings["bitrate"]>("recommended");
  const [customBitrateKbps, setCustomBitrateKbps] = useState<number>(8000);
  const [audioQuality, setAudioQuality] = useState<
    "medium" | "high" | "very-high" | "default"
  >("medium");
  const [movCompressed, setMovCompressed] = useState<boolean>(false);

  const audioBitrateForSelection = useCallback(() => {
    if (format === "mp4") {
      // AAC mappings
      if (audioQuality === "medium") return 128;
      if (audioQuality === "high") return 192;
      return 256; // very-high
    }
    if (format === "webm") {
      // Opus mappings
      if (audioQuality === "default") return 96;
      if (audioQuality === "high") return 160;
      return 256; // very-high
    }
    // mov: if not compressed, undefined (PCM). If compressed, reuse AAC options
    if (format === "mov") {
      if (!movCompressed) return undefined;
      if (audioQuality === "medium") return 128;
      if (audioQuality === "high") return 192;
      return 256; // very-high
    }
    return undefined;
  }, [format, audioQuality, movCompressed]);

  const getRecommendedBitrate = useCallback(() => {
    const selectedResolution = resolution;
    const selectedFps = fps;
    return (
      EXPORT_BITRATE_MAP[selectedResolution]?.[selectedFps]?.standard || 8000
    );
  }, [resolution, fps]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const now = new Date();
        const date = now.toISOString().split("T")[0];
        const time = now.toTimeString().split(" ")[0].substring(0, 5);

        if (dateRef.current) dateRef.current.value = date;
        if (timeRef.current) timeRef.current.value = time;
        if (clipTitleRef.current) clipTitleRef.current.value = "MyClip";

        if (streamerNameRef.current)
          streamerNameRef.current.value = streamerName || "UnknownStreamer";
      }, 0);
    }
  }, [isOpen]);

  const handleExportClick = () => {
    const streamerName = streamerNameRef.current?.value || "UnknownStreamer";
    const clipTitle = clipTitleRef.current?.value || "MyClip";
    const date = dateRef.current?.value || "";
    const time = timeRef.current?.value || "";

    const outputName = `${streamerName}_${date}_${time}_${clipTitle}`.replace(
      /[^a-zA-Z0-9-_.]/g,
      "_"
    );
    onExport(outputName, {
      preset,
      crf,
      fps,
      format,
      resolution,
      bitrate,
      customBitrateKbps,
      audioBitrateKbps: audioBitrateForSelection(),
      audioCompressed: format === "mov" ? movCompressed : true,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[575px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Name Your Clip</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="streamerName"
              className="text-right text-sm md:text-[0.8rem]"
            >
              Streamer
            </label>
            <Input
              required
              id="streamerName"
              defaultValue=""
              className="col-span-3"
              ref={streamerNameRef}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="clipTitle"
              className="text-right text-sm md:text-[0.8rem]"
            >
              Title
            </label>
            <Input
              required
              id="clipTitle"
              defaultValue=""
              className="col-span-3"
              ref={clipTitleRef}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="date"
              className="text-right text-sm md:text-[0.8rem]"
            >
              Date
            </label>
            <Input
              required
              id="date"
              type="date"
              defaultValue=""
              className="col-span-3"
              ref={dateRef}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="time"
              className="text-right text-sm md:text-[0.8rem]"
            >
              Time
            </label>
            <Input
              required
              id="time"
              type="time"
              defaultValue=""
              className="col-span-3"
              ref={timeRef}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="resolution"
              className="text-right text-sm md:text-[0.8rem]"
            >
              Resolution
            </label>
            <Select
              value={String(resolution)}
              onValueChange={(value) => {
                setResolution(value as ExportSettings["resolution"]);

                if (bitrate === "recommended") {
                  setCustomBitrateKbps(getRecommendedBitrate());
                }
              }}
            >
              <SelectTrigger
                id="resolution"
                className="col-span-3 h-auto px-2 py-1"
              >
                <SelectValue placeholder="Select resolution" />
              </SelectTrigger>
              <SelectContent className="z-210">
                {RESOLUTION_OPTIONS.map((res) => (
                  <SelectItem key={res.value} value={res.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{res.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {res.description}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="fps"
              className="text-right text-sm md:text-[0.8rem]"
            >
              Frame Rate
            </label>
            <Select
              value={String(fps)}
              onValueChange={(value) => {
                setFps(parseInt(value) as ExportSettings["fps"]);

                if (bitrate === "recommended") {
                  setCustomBitrateKbps(getRecommendedBitrate());
                }
              }}
            >
              <SelectTrigger id="fps" className="col-span-3 h-auto px-2 py-1">
                <SelectValue placeholder="Select FPS" />
              </SelectTrigger>
              <SelectContent className="z-210">
                {FPS_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={String(f.value)}>
                    <div className="flex items-center justify-between w-full">
                      <span>{f.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {f.description}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="bitrate"
              className="text-right text-sm md:text-[0.8rem]"
            >
              Bitrate
            </label>
            <Select
              value={bitrate}
              onValueChange={(value) => {
                setBitrate(value as ExportSettings["bitrate"]);
                if (value === "recommended") {
                  setCustomBitrateKbps(getRecommendedBitrate());
                } else if (value === "high") {
                  const highBitrate =
                    EXPORT_BITRATE_MAP[resolution][fps]?.high || 12000;
                  setCustomBitrateKbps(highBitrate * 1000);
                } else if (value === "min") {
                  const minBitrate =
                    EXPORT_BITRATE_MAP[resolution][fps]?.min || 4000;
                  setCustomBitrateKbps(minBitrate * 1000);
                }
              }}
            >
              <SelectTrigger
                id="bitrate"
                className="col-span-3 h-auto px-2 py-1"
              >
                <SelectValue placeholder="Select bitrate" />
              </SelectTrigger>
              <SelectContent className="z-210">
                <SelectItem value="recommended">
                  <div className="flex items-center justify-between w-full">
                    <span>Recommended</span>
                    <Badge variant="secondary" className="ml-2">
                      {getRecommendedBitrate()} kbps
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center justify-between w-full">
                    <span>High Quality</span>
                    <Badge variant="secondary" className="ml-2">
                      {EXPORT_BITRATE_MAP[resolution][fps]?.high || 12000} kbps
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="min">
                  <div className="flex items-center justify-between w-full">
                    <span>Minimum</span>
                    <Badge variant="secondary" className="ml-2">
                      {EXPORT_BITRATE_MAP[resolution][fps]?.min || 4000} kbps
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="custom">
                  <div className="flex items-center justify-between w-full">
                    <span>Custom</span>
                    <Badge variant="secondary" className="ml-2">
                      Manual Input
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {bitrate === "custom" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor="customBitrate"
                className="text-right text-sm md:text-[0.8rem]"
              >
                Custom Bitrate (kbps)
              </label>
              <Input
                required
                id="customBitrate"
                type="number"
                min="1000"
                max="50000"
                defaultValue={customBitrateKbps}
                onChange={(e) => setCustomBitrateKbps(parseInt(e.target.value))}
                className="col-span-3"
              />
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="format"
              className="text-right text-sm md:text-[0.8rem]"
            >
              Format
            </label>
            <Select
              value={format}
              onValueChange={(value) =>
                setFormat(value as ExportSettings["format"])
              }
            >
              <SelectTrigger
                id="format"
                className="col-span-3 h-auto px-2 py-1"
              >
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent className="z-210">
                {FORMAT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{f.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {f.description}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {format === "mov" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                className="text-right text-sm md:text-[0.8rem]"
                htmlFor="movCompressed"
              >
                Use compressed audio
              </label>
              <div className="col-span-3 flex items-center gap-2">
                <Switch
                  id="movCompressed"
                  checked={movCompressed}
                  onCheckedChange={(v: boolean) => setMovCompressed(v)}
                />
                <span className="text-[0.8rem] text-foreground/70">
                  {movCompressed
                    ? "AAC (select quality)"
                    : "PCM (uncompressed)"}
                </span>
              </div>
            </div>
          )}

          {(format === "mp4" ||
            format === "webm" ||
            (format === "mov" && movCompressed)) && (
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                className="text-right text-sm md:text-[0.8rem]"
                htmlFor="audioQuality"
              >
                Audio Quality
              </label>
              <Select
                value={
                  format === "webm" && audioQuality === "medium"
                    ? "default"
                    : audioQuality
                }
                onValueChange={(value) => {
                  if (format === "webm" && value === "default") {
                    setAudioQuality("default");
                  } else if (
                    value === "medium" ||
                    value === "high" ||
                    value === "very-high"
                  ) {
                    setAudioQuality(value);
                  } else if (value === "default") {
                    setAudioQuality("default");
                  }
                }}
              >
                <SelectTrigger
                  id="audioQuality"
                  className="col-span-3 h-auto px-2 py-1"
                >
                  <SelectValue placeholder="Select audio quality" />
                </SelectTrigger>
                <SelectContent className="z-210">
                  {format === "mp4" && (
                    <>
                      <SelectItem value="medium">
                        <div className="flex items-center justify-between w-full">
                          <span>Medium</span>
                          <Badge variant="secondary" className="ml-2">
                            AAC 128k
                          </Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center justify-between w-full">
                          <span>High</span>
                          <Badge variant="secondary" className="ml-2">
                            AAC 192k
                          </Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="very-high">
                        <div className="flex items-center justify-between w-full">
                          <span>Very High</span>
                          <Badge variant="secondary" className="ml-2">
                            AAC 256k
                          </Badge>
                        </div>
                      </SelectItem>
                    </>
                  )}
                  {format === "webm" && (
                    <>
                      <SelectItem value="default">
                        <div className="flex items-center justify-between w-full">
                          <span>Default</span>
                          <Badge variant="secondary" className="ml-2">
                            Opus 96k
                          </Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center justify-between w-full">
                          <span>High</span>
                          <Badge variant="secondary" className="ml-2">
                            Opus 160k
                          </Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="very-high">
                        <div className="flex items-center justify-between w-full">
                          <span>Very High</span>
                          <Badge variant="secondary" className="ml-2">
                            Opus 256k
                          </Badge>
                        </div>
                      </SelectItem>
                    </>
                  )}
                  {format === "mov" && movCompressed && (
                    <>
                      <SelectItem value="medium">
                        <div className="flex items-center justify-between w-full">
                          <span>Medium</span>
                          <Badge variant="secondary" className="ml-2">
                            AAC 128k
                          </Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center justify-between w-full">
                          <span>High</span>
                          <Badge variant="secondary" className="ml-2">
                            AAC 192k
                          </Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="very-high">
                        <div className="flex items-center justify-between w-full">
                          <span>Very High</span>
                          <Badge variant="secondary" className="ml-2">
                            AAC 256k
                          </Badge>
                        </div>
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="preset"
              className="text-right text-sm md:text-[0.8rem]"
            >
              Preset
            </label>
            <Select
              value={preset}
              onValueChange={(value) =>
                setPreset(value as ExportSettings["preset"])
              }
            >
              <SelectTrigger
                id="preset"
                className="col-span-3 h-auto px-2 py-1"
              >
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent className="z-210">
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{p.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {p.description}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label
              htmlFor="crf"
              className="text-right text-sm md:text-[0.8rem]"
            >
              CRF
            </label>
            <Select
              value={String(crf)}
              onValueChange={(value) =>
                setCrf(parseInt(value) as ExportSettings["crf"])
              }
            >
              <SelectTrigger
                id="crf"
                className="col-span-3 h-auto px-2 py-1 text-sm md:text-[0.8rem]"
              >
                <SelectValue placeholder="Select CRF" />
              </SelectTrigger>
              <SelectContent className="z-210">
                {CRF_VALUES.map((c) => (
                  <SelectItem key={c.value} value={String(c.value)}>
                    <div className="flex items-center justify-between w-full">
                      <span>{c.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {c.description}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleExportClick} className="flex-1">
            Export Clip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportNamingDialog;
