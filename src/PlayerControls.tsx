import type { ChangeEvent, ReactNode } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { ui } from "./i18n";
import type { Locale } from "./types";

type PlayerControlsProps = {
  readonly currentStep: number;
  readonly isPlaying: boolean;
  readonly locale: Locale;
  readonly playbackSpeed: number;
  readonly totalSteps: number;
  readonly onPlaybackSpeedChange: (speed: number) => void;
  readonly onPlayingChange: (isPlaying: boolean) => void;
  readonly onStepChange: (step: number) => void;
};

type TransportProps = Pick<
  PlayerControlsProps,
  "currentStep" | "isPlaying" | "locale" | "onPlayingChange" | "onStepChange" | "totalSteps"
>;

const PLAYBACK_SPEEDS = [0.5, 1, 2] as const;

export function PlayerControls(props: PlayerControlsProps) {
  return (
    <div className="player-controls">
      <TransportButtons {...props} />
      <ProgressSlider {...props} />
      <SpeedControl
        locale={props.locale}
        playbackSpeed={props.playbackSpeed}
        onPlaybackSpeedChange={props.onPlaybackSpeedChange}
      />
      <StepCounter currentStep={props.currentStep} locale={props.locale} totalSteps={props.totalSteps} />
    </div>
  );
}

function TransportButtons(props: TransportProps) {
  const state = transportState(props);

  return (
    <div className="transport-buttons">
      <IconButton label={ui("previous", props.locale)} disabled={!state.canGoBack} onClick={goBack}>
        <SkipBack size={17} />
      </IconButton>
      <IconButton
        label={props.isPlaying ? ui("pause", props.locale) : ui("play", props.locale)}
        disabled={!state.canPlay && !props.isPlaying}
        onClick={() => props.onPlayingChange(!props.isPlaying)}
      >
        {props.isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </IconButton>
      <IconButton label={ui("next", props.locale)} disabled={!state.canGoForward} onClick={goForward}>
        <SkipForward size={17} />
      </IconButton>
    </div>
  );

  function goBack() {
    props.onPlayingChange(false);
    props.onStepChange(Math.max(props.currentStep - 1, 0));
  }

  function goForward() {
    props.onPlayingChange(false);
    props.onStepChange(Math.min(props.currentStep + 1, state.lastStep));
  }
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  readonly children: ReactNode;
  readonly disabled: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function ProgressSlider(props: TransportProps) {
  const lastStep = Math.max(props.totalSteps - 1, 0);

  return (
    <label className="progress-control">
      <span>{ui("timeline", props.locale)}</span>
      <input
        aria-label={ui("timeline", props.locale)}
        type="range"
        min="0"
        max={lastStep}
        value={props.currentStep}
        onChange={handleChange}
        disabled={props.totalSteps === 0}
      />
    </label>
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    props.onPlayingChange(false);
    props.onStepChange(Number(event.target.value));
  }
}

function SpeedControl({
  locale,
  playbackSpeed,
  onPlaybackSpeedChange,
}: Pick<PlayerControlsProps, "locale" | "playbackSpeed" | "onPlaybackSpeedChange">) {
  return (
    <label className="speed-control">
      <span>{ui("speed", locale)} {playbackSpeed.toFixed(1)}x</span>
      <input
        aria-label={ui("speed", locale)}
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

function StepCounter({
  currentStep,
  locale,
  totalSteps,
}: Pick<PlayerControlsProps, "currentStep" | "locale" | "totalSteps">) {
  const value = totalSteps === 0 ? "0 / 0" : `${currentStep + 1} / ${totalSteps}`;
  return <span className="step-counter">{ui("step", locale)} {value}</span>;
}

function speedIndex(speed: number): number {
  return Math.max(PLAYBACK_SPEEDS.findIndex((value) => value === speed), 0);
}

function transportState(props: TransportProps) {
  const lastStep = Math.max(props.totalSteps - 1, 0);

  return {
    lastStep,
    canGoBack: props.currentStep > 0,
    canGoForward: props.currentStep < lastStep,
    canPlay: props.totalSteps > 1 && props.currentStep < lastStep,
  };
}
