import { useEffect, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { TraceFrame, TraceRun } from "./types";

const BASE_PLAYBACK_DELAY_MS = 700;

type TraceError = {
  readonly kind?: string;
  readonly line?: number | null;
  readonly message?: string;
};

type TraceRunState = {
  readonly traceRun: TraceRun | null;
  readonly error: string | null;
  readonly errorLine: number | null;
  readonly running: boolean;
};

type TraceRunAction =
  | { readonly type: "start" }
  | { readonly type: "traceRun"; readonly traceRun: TraceRun }
  | { readonly type: "error"; readonly error: string; readonly line: number | null }
  | { readonly type: "stop" }
  | { readonly type: "reset" };

type RunIdRef = {
  current: number;
};

type StartTraceRunOptions = {
  readonly code: string;
  readonly activeRunId: RunIdRef;
  readonly dispatch: (action: TraceRunAction) => void;
  readonly playback: PlaybackState;
};

type TraceSessionOptions = {
  readonly initialCode: string;
};

type PlaybackState = ReturnType<typeof usePlayback>;

const INITIAL_RUN_STATE: TraceRunState = {
  traceRun: null,
  error: null,
  errorLine: null,
  running: true,
};

export function useTraceSession({ initialCode }: TraceSessionOptions) {
  const [runState, dispatch] = useReducer(traceRunReducer, INITIAL_RUN_STATE);
  const playback = usePlayback({ totalSteps: runState.traceRun?.frames.length ?? 0 });
  const activeRunId = useRef(0);
  const initialRunStarted = useRef(false);

  useEffect(() => {
    if (initialRunStarted.current) {
      return;
    }

    initialRunStarted.current = true;
    startTraceRun({ code: initialCode, activeRunId, dispatch, playback });
  }, [initialCode]);

  return {
    ...runState,
    ...playback,
    currentFrame: currentFrame(runState.traceRun, playback.currentStep),
    previousFrame: currentFrame(runState.traceRun, playback.currentStep - 1),
    reset: () => resetTraceSession({ activeRunId, dispatch, playback }),
    runTrace: (code: string) => startTraceRun({ code, activeRunId, dispatch, playback }),
  };
}

export type TraceSession = ReturnType<typeof useTraceSession>;

function usePlayback({ totalSteps }: { readonly totalSteps: number }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    if (currentStep >= totalSteps - 1) {
      setIsPlaying(false);
      return;
    }

    const timeout = window.setTimeout(advancePlayback, playbackDelay(playbackSpeed));
    return () => window.clearTimeout(timeout);
  }, [currentStep, isPlaying, playbackSpeed, totalSteps]);

  return {
    currentStep,
    isPlaying,
    playbackSpeed,
    setCurrentStep,
    setIsPlaying,
    setPlaybackSpeed,
    stop: () => setIsPlaying(false),
    resetStep: () => setCurrentStep(0),
  };

  function advancePlayback() {
    setCurrentStep((step) => {
      const lastStep = Math.max(totalSteps - 1, 0);

      if (step >= lastStep) {
        setIsPlaying(false);
        return step;
      }

      return step + 1;
    });
  }
}

function traceRunReducer(state: TraceRunState, action: TraceRunAction): TraceRunState {
  switch (action.type) {
    case "start":
      return { traceRun: null, error: null, errorLine: null, running: true };
    case "traceRun":
      return { ...state, traceRun: action.traceRun, error: null, errorLine: null };
    case "error":
      return { ...state, error: action.error, errorLine: action.line };
    case "stop":
      return { ...state, running: false };
    case "reset":
      return { traceRun: null, error: null, errorLine: null, running: false };
  }
}

function startTraceRun(options: StartTraceRunOptions) {
  const runId = options.activeRunId.current + 1;
  options.activeRunId.current = runId;
  options.playback.stop();
  options.playback.resetStep();
  options.dispatch({ type: "start" });

  loadTrace(options.code)
    .then((traceRun) => receiveTraceRun({ ...options, runId, traceRun }))
    .catch((reason) => captureError({ ...options, runId, reason }))
    .finally(() => stopRunning({ ...options, runId }));
}

function resetTraceSession(options: Omit<StartTraceRunOptions, "code">) {
  options.activeRunId.current += 1;
  options.playback.stop();
  options.playback.resetStep();
  options.dispatch({ type: "reset" });
}

function receiveTraceRun(options: StartTraceRunOptions & {
  readonly runId: number;
  readonly traceRun: TraceRun;
}) {
  if (options.runId === options.activeRunId.current) {
    options.dispatch({ type: "traceRun", traceRun: options.traceRun });
  }
}

function captureError(options: StartTraceRunOptions & {
  readonly runId: number;
  readonly reason: unknown;
}) {
  if (options.runId === options.activeRunId.current) {
    options.dispatch({
      type: "error",
      error: formatTraceError(options.reason),
      line: traceErrorLine(options.reason),
    });
  }
}

function stopRunning(options: Omit<StartTraceRunOptions, "code"> & { readonly runId: number }) {
  if (options.runId === options.activeRunId.current) {
    options.dispatch({ type: "stop" });
  }
}

function playbackDelay(speed: number): number {
  return Math.round(BASE_PLAYBACK_DELAY_MS / speed);
}

function formatTraceError(reason: unknown): string {
  if (isTraceError(reason)) {
    const location = typeof reason.line === "number" ? `Line ${reason.line}: ` : "";
    const kind = reason.kind ? `${reason.kind}: ` : "";
    return `${location}${kind}${reason.message ?? "Python execution failed"}`;
  }

  if (reason instanceof Error) {
    return reason.message;
  }

  return String(reason);
}

function isTraceError(reason: unknown): reason is TraceError {
  return typeof reason === "object" && reason !== null && "message" in reason;
}

function traceErrorLine(reason: unknown): number | null {
  if (!isTraceError(reason) || typeof reason.line !== "number") {
    return null;
  }

  return reason.line;
}

async function loadTrace(pythonCode: string): Promise<TraceRun> {
  const traceRun = await invoke<TraceRun>("trace_python_code", {
    pythonCode,
  });

  if (!Array.isArray(traceRun.frames) || traceRun.frames.length === 0) {
    throw new Error("trace_python_code returned an empty trace");
  }

  return traceRun;
}

function currentFrame(traceRun: TraceRun | null, step: number): TraceFrame | undefined {
  return traceRun?.frames[step];
}
