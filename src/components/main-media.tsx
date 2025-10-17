import * as React from "react";
import { useConstrainedVideo } from "@/hooks/app/use-constrained-video";
import { useLatestValue } from "@/hooks/use-latest-value";
import { ClipContext } from "@/contexts/clip-context";
import { useShallowSelector } from "react-shallow-store";
import { Playback } from "./video-controls";
import { Volume } from "./volume";
import { getPlayingState } from "@/hooks/app/use-video-controls-core";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { AlertTriangle, Loader2 } from "lucide-react";
import { msToSeconds } from "@/utils/video";

// Component for 16:9 main media

interface MainMediaProps {
  mediaUrl: string;
  setVideoRef: (element: HTMLVideoElement | null) => void;
  playerType: "primary" | "secondary";
}

const MainMedia = React.forwardRef<HTMLVideoElement, MainMediaProps>(
  function MainMedia(
    { mediaUrl, playerType: mediaType, setVideoRef },
    forwardedRef
  ) {
    const repeatRef = React.useRef(false);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);

    const composedRefs = useComposedRefs(videoRef, forwardedRef, setVideoRef);

    const { primaryTrim, secondaryTrim, primaryTrimRef, secondaryTrimRef } =
      useShallowSelector(ClipContext, function (state) {
        return {
          primaryTrim: state.primaryTrim,
          secondaryTrim: state.secondaryTrim,
          primaryTrimRef: state.primaryTrimRef,
          secondaryTrimRef: state.secondaryTrimRef,
        };
      });

    const { controls, status, buffered, isBuffering, hasError } =
      useConstrainedVideo({
        videoRef: videoRef,
        trimStartRef: useLatestValue(
          mediaType === "primary"
            ? msToSeconds(primaryTrimRef.current.trimStart) ?? 0
            : msToSeconds(secondaryTrimRef.current.trimStart) ?? 0
        ),
        trimEndRef: useLatestValue(
          mediaType === "primary"
            ? msToSeconds(primaryTrimRef.current.trimEnd) ?? 0
            : msToSeconds(secondaryTrimRef.current.trimEnd) ?? 0
        ),
        repeatRef,
      });

    const playState = getPlayingState(status);

    return (
      <>
        <video
          src={mediaUrl}
          ref={composedRefs}
          controls={false}
          playsInline
          muted={false}
          className="w-full h-full object-contain rounded-lg"
          poster="/thumbnails/video-thumb-2.webp"
        />
        <Playback.Root
          defaultPlaying={playState.isPlaying}
          onPlayingChangeAlways={(shouldPlay) => {
            if (shouldPlay) {
              controls.play();
            } else {
              controls.pause();
            }
          }}
          playingStatus={status}
        >
          {isBuffering && (
            <div className="absolute top-1/2 left-2/4 -translate-y-1/2 -translate-x-2/4 z-10">
              <Loader2 className="h-12 w-12 animate-spin glass" />
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 bg-black/80 text-white backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center text-foreground-default p-4 flex flex-col items-center gap-2 w-[85%]">
                <AlertTriangle className="size-12 text-error mb-px" />
                <div className="text-base font-semibold tracking-tight">
                  Video failed to load
                </div>
              </div>
            </div>
          )}

          <Playback.Controls className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Playback.PlayToggle />
              <Playback.Volume>
                <Volume.Root
                  orientation="horizontal"
                  defaultValue={controls.getVolume()}
                  onValueChangeAlways={controls.setVolume}
                >
                  <Volume.Controls
                    variant="pill"
                    className="!p-0 !border-none bg-transparent hover:!glass"
                  >
                    <Volume.Button
                      size="icon"
                      variant="glass"
                      aria-label="Primary volume"
                    />
                    <Volume.Slider>
                      <Volume.Slider.Track className="!glass">
                        <Volume.Slider.Range className="bg-white" />
                        <Volume.Slider.Thumb className="bg-white" />
                      </Volume.Slider.Track>
                    </Volume.Slider>
                  </Volume.Controls>
                </Volume.Root>
              </Playback.Volume>
            </div>
            <div className="w-full">
              <Playback.Seek
                primaryVideoRef={videoRef}
                primaryTrim={
                  mediaType === "primary" ? primaryTrim : secondaryTrim
                }
                secondaryTrim={null}
                primaryBuffered={buffered}
                secondaryBuffered={null}
                isPlaying={playState.isPlaying}
                onSeek={controls.seek}
              />
            </div>
            <div className="flex items-center gap-3">
              <Playback.LoopToggle
                defaultLoop={repeatRef.current}
                onLoopChangeAlways={(value) => {
                  repeatRef.current = value;
                }}
              />
              <Playback.RateControl
                defaultRate={controls.getPlaybackRate()}
                onRateChangeAlways={controls.setPlaybackRate}
              />
            </div>
          </Playback.Controls>
        </Playback.Root>
      </>
    );
  }
);

MainMedia.displayName = "MainMedia";

export default MainMedia;
