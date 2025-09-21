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
    >
  ) => void;
  isBufferDownloaded: boolean;
}

export const ExportNamingDialog: React.FC<ExportNamingDialogProps> = ({
  isOpen,
  onOpenChange,
  streamerName,
  onExport,
  isBufferDownloaded,
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
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[475px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Name Your Clip</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="streamerName" className="text-right text-xs">
              Streamer
            </label>
            <Input
              required
              id="streamerName"
              defaultValue=""
              className="col-span-3 text-xs"
              ref={streamerNameRef}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="clipTitle" className="text-right text-xs">
              Title
            </label>
            <Input
              required
              id="clipTitle"
              defaultValue=""
              className="col-span-3 text-xs"
              ref={clipTitleRef}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="date" className="text-right text-xs">
              Date
            </label>
            <Input
              required
              id="date"
              type="date"
              defaultValue=""
              className="col-span-3 text-xs"
              ref={dateRef}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="time" className="text-right text-xs">
              Time
            </label>
            <Input
              required
              id="time"
              type="time"
              defaultValue=""
              className="col-span-3 text-xs"
              ref={timeRef}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="resolution" className="text-right text-xs">
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
                className="col-span-3 h-auto px-2 py-1 text-xs"
              >
                <SelectValue placeholder="Select resolution" />
              </SelectTrigger>
              <SelectContent>
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
            <label htmlFor="fps" className="text-right text-xs">
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
              <SelectTrigger
                id="fps"
                className="col-span-3 h-auto px-2 py-1 text-xs"
              >
                <SelectValue placeholder="Select FPS" />
              </SelectTrigger>
              <SelectContent>
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
            <label htmlFor="bitrate" className="text-right text-xs">
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
                className="col-span-3 h-auto px-2 py-1 text-xs"
              >
                <SelectValue placeholder="Select bitrate" />
              </SelectTrigger>
              <SelectContent>
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
              <label htmlFor="customBitrate" className="text-right text-xs">
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
                className="col-span-3 text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="format" className="text-right text-xs">
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
                className="col-span-3 h-auto px-2 py-1 text-xs"
              >
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
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

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="preset" className="text-right text-xs">
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
                className="col-span-3 h-auto px-2 py-1 text-xs"
              >
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
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
            <label htmlFor="crf" className="text-right text-xs">
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
                className="col-span-3 h-auto px-2 py-1 text-xs"
              >
                <SelectValue placeholder="Select CRF" />
              </SelectTrigger>
              <SelectContent>
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
          <div className="flex items-center gap-2 w-full">
            <Button
              type="button"
              onClick={handleExportClick}
              disabled={!isBufferDownloaded}
              className="flex-1"
            >
              Export Clip
            </Button>
            <InfoTooltip
              content={
                isBufferDownloaded
                  ? "Export the video clip with your selected settings"
                  : "Please wait for the video buffer to finish downloading before exporting"
              }
              disabled={isBufferDownloaded}
            />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
