import * as React from "react";
import { useConstrainedVideo } from "@/hooks/app/use-constrained-video";
import { useLatestValue } from "@/hooks/use-latest-value";
import { ClipContext } from "@/contexts/clip-context";
import { useShallowSelector } from "react-shallow-store";
import { Playback } from "./video-controls";
import { Volume } from "./volume";
import { getPlayingState } from "@/hooks/app/use-video-controls-core";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { msToSeconds } from "@/utils/video";
import { useDualVideoSync } from "@/hooks/app/use-dual-video-sync";
import { DualClockContext } from "@/contexts/dual-clock-context";

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
    const videoPlayerId = React.useId();
    const controlsId = React.useId();

    const repeatRef = React.useRef(false);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);

    const composedRefs = useComposedRefs(videoRef, forwardedRef, setVideoRef);

    const {
      primaryTrim,
      secondaryTrim,
      dualVideoSettings: settings,
    } = useShallowSelector(ClipContext, (state) => ({
      primaryTrim: state.primaryTrim,
      secondaryTrim: state.secondaryTrim,
      dualVideoSettings: state.dualVideoSettings,
    }));

    const { primaryVideoRef, secondaryVideoRef } = useShallowSelector(
      DualClockContext,
      (state) => ({
        primaryVideoRef: state.primaryVideoRef,
        secondaryVideoRef: state.secondaryVideoRef,
      })
    );

    const {
      controls: dualVideoControls,
      primaryBuffered,
      secondaryBuffered,
      isBuffering: isBufferingDualVideo,
      hasError: hasErrorDualVideo,
      status: dualStatus,
      playbackRate: dualPlaybackRate,
      repeat: dualRepeat,
    } = useDualVideoSync({
      primaryVideoRef,
      secondaryVideoRef,
      primaryTrim,
      secondaryTrim,
      enabled: settings.layout === "pip",
    });

    const { controls, status, buffered, isBuffering, hasError } =
      useConstrainedVideo({
        videoRef,
        trimStartRef: useLatestValue(
          mediaType === "primary"
            ? msToSeconds(primaryTrim.trimStart) ?? 0
            : msToSeconds(secondaryTrim.trimStart) ?? 0
        ),
        trimEndRef: useLatestValue(
          mediaType === "primary"
            ? msToSeconds(primaryTrim.trimEnd) ?? 0
            : msToSeconds(secondaryTrim.trimEnd) ?? 0
        ),
        repeatRef,
      });

    const playState = getPlayingState(status);

    return (
      <>
        <video
          id={videoPlayerId}
          aria-label="Video player"
          aria-describedby={controlsId}
          src={mediaUrl}
          ref={composedRefs}
          controls={false}
          playsInline
          muted={false}
          className="w-full h-full object-contain bg-surface-secondary"
          poster="/thumbnails/video-thumb-2.webp"
        />

        {settings.layout === "pip" ? (
          <Playback.Root
            defaultPlaying={dualStatus === "playing"}
            onPlayingChangeAlways={(shouldPlay) => {
              if (shouldPlay) {
                dualVideoControls.play();
              } else {
                dualVideoControls.pause();
              }
            }}
            playingStatus={dualStatus}
            isBuffering={isBufferingDualVideo}
            hasError={hasErrorDualVideo}
            isDual
          >
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
                  primaryVideoRef={primaryVideoRef}
                  secondaryVideoRef={secondaryVideoRef}
                  primaryTrim={primaryTrim}
                  secondaryTrim={secondaryTrim}
                  primaryBuffered={primaryBuffered}
                  secondaryBuffered={secondaryBuffered}
                  isPlaying={dualStatus === "playing"}
                  onSeek={dualVideoControls.seek}
                />
              </div>
              <div className="flex items-center gap-3">
                <Playback.LoopToggle
                  defaultLoop={dualRepeat}
                  onLoopChangeAlways={dualVideoControls.toggleRepeat}
                />
                <Playback.RateControl
                  defaultRate={dualPlaybackRate}
                  onRateChangeAlways={dualVideoControls.setPlayback}
                />
              </div>
            </Playback.Controls>
          </Playback.Root>
        ) : (
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
            isBuffering={isBuffering}
            hasError={hasError}
          >
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
                      <Volume.Slider className="w-16">
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
                  onSeek={(timelineMs: number) => {
                    const trim =
                      mediaType === "primary" ? primaryTrim : secondaryTrim;
                    const sourceTimeSec = msToSeconds(
                      trim.trimStart + timelineMs
                    );
                    controls.seek(sourceTimeSec);
                  }}
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
        )}
      </>
    );
  }
);

MainMedia.displayName = "MainMedia";

export default MainMedia;
