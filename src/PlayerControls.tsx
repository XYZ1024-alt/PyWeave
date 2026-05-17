import type { ChangeEvent } from "react";

type PlayerControlsProps = {
  readonly currentStep: number;
  readonly isPlaying: boolean;
  readonly playbackSpeed: number;
  readonly totalSteps: number;
  readonly onPlaybackSpeedChange: (speed: number) => void;
  readonly onPlayingChange: (isPlaying: boolean) => void;
  readonly onStepChange: (step: number) => void;
};

type TransportProps = Pick<
  PlayerControlsProps,
  "currentStep" | "isPlaying" | "onPlayingChange" | "onStepChange" | "totalSteps"
>;

const PLAYBACK_SPEEDS = [0.5, 1, 2] as const;

export function PlayerControls(props: PlayerControlsProps) {
  return (
    <div className="player-controls">
      <TransportButtons {...props} />
      <ProgressSlider {...props} />
      <SpeedControl
        playbackSpeed={props.playbackSpeed}
        onPlaybackSpeedChange={props.onPlaybackSpeedChange}
      />
      <StepCounter currentStep={props.currentStep} totalSteps={props.totalSteps} />
    </div>
  );
}

function TransportButtons({
  currentStep,
  isPlaying,
  onPlayingChange,
  onStepChange,
  totalSteps,
}: TransportProps) {
  const lastStep = Math.max(totalSteps - 1, 0);
  const canGoBack = currentStep > 0;
  const canGoForward = currentStep < lastStep;
  const canPlay = totalSteps > 1 && canGoForward;

  return (
    <>
      <button type="button" onClick={() => onPlayingChange(!isPlaying)} disabled={!canPlay && !isPlaying}>
        {isPlaying ? "Pause" : "Play"}
      </button>
      <button type="button" onClick={goBack} disabled={!canGoBack}>
        Previous
      </button>
      <button type="button" onClick={goForward} disabled={!canGoForward}>
        Next
      </button>
    </>
  );

  function goBack() {
    onPlayingChange(false);
    onStepChange(Math.max(currentStep - 1, 0));
  }

  function goForward() {
    onPlayingChange(false);
    onStepChange(Math.min(currentStep + 1, lastStep));
  }
}

function ProgressSlider({ currentStep, onPlayingChange, onStepChange, totalSteps }: TransportProps) {
  const lastStep = Math.max(totalSteps - 1, 0);

  return (
    <input
      aria-label="Trace progress"
      type="range"
      min="0"
      max={lastStep}
      value={currentStep}
      onChange={handleChange}
      disabled={totalSteps === 0}
    />
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onPlayingChange(false);
    onStepChange(Number(event.target.value));
  }
}

function SpeedControl({
  playbackSpeed,
  onPlaybackSpeedChange,
}: Pick<PlayerControlsProps, "playbackSpeed" | "onPlaybackSpeedChange">) {
  return (
    <label className="speed-control">
      <span>{playbackSpeed.toFixed(1)}x</span>
      <input
        aria-label="Playback speed"
        type="range"
        min="0"
        max={PLAYBACK_SPEEDS.length - 1}
        step="1"
        value={speedIndex(playbackSpeed)}
        onChange={(event) => onPlaybackSpeedChange(PLAYBACK_SPEEDS[Number(event.target.value)])}
      />
    </label>
  );
}

function StepCounter({ currentStep, totalSteps }: Pick<PlayerControlsProps, "currentStep" | "totalSteps">) {
  return (
    <span className="step-counter">
      {totalSteps === 0 ? "0 / 0" : `${currentStep + 1} / ${totalSteps}`}
    </span>
  );
}

function speedIndex(speed: number): number {
  return Math.max(PLAYBACK_SPEEDS.findIndex((value) => value === speed), 0);
}
