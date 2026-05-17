import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Background, Controls, MiniMap, ReactFlow, useReactFlow } from "@xyflow/react";

import { nodeTypes } from "./FlowNodes";
import { PlayerControls } from "./PlayerControls";
import { PythonEditor } from "./PythonEditor";
import { TemplatePicker } from "./TemplatePicker";
import { createFlowModel } from "./flowModel";
import { ALGORITHM_TEMPLATES, CUSTOM_TEMPLATE, DEFAULT_TEMPLATE, type AlgorithmTemplate } from "./templates";
import type { TraceEvent } from "./types";

const BASE_PLAYBACK_DELAY_MS = 700;

type TraceError = {
  readonly kind?: string;
  readonly line?: number | null;
  readonly message?: string;
};

export default function App() {
  const [timeline, setTimeline] = useState<TraceEvent[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [pythonCode, setPythonCode] = useState(DEFAULT_TEMPLATE.source);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [running, setRunning] = useState(true);
  const initialRunStarted = useRef(false);
  const activeRunId = useRef(0);

  useEffect(() => {
    if (initialRunStarted.current) {
      return;
    }

    initialRunStarted.current = true;
    runTrace();
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    if (currentStep >= timeline.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timeout = window.setTimeout(advancePlayback, playbackDelay(playbackSpeed));
    return () => window.clearTimeout(timeout);
  }, [currentStep, isPlaying, playbackSpeed, timeline.length]);

  const frame = timeline[currentStep];
  const previousFrame = timeline[currentStep - 1];
  const model = useMemo(
    () => createFlowModel(frame?.locals ?? {}, previousFrame?.locals, currentStep),
    [currentStep, frame, previousFrame],
  );

  return (
    <main className="app-shell">
      <section className="source-pane" aria-label="Python source">
        <div className="pane-header">
          <span>Python Editor</span>
          <span>{pythonCode.length} chars</span>
        </div>
        <TemplatePicker
          selectedTemplateId={selectedTemplateId}
          templates={ALGORITHM_TEMPLATES}
          onSelectTemplate={selectTemplate}
        />
        <PythonEditor
          code={pythonCode}
          isRunning={running}
          onCodeChange={handleCodeChange}
          onRun={runTrace}
        />
      </section>

      <section className="flow-pane" aria-label="Algorithm playback">
        <div className="pane-header">
          <span>Variables</span>
          <span>{running ? "running" : `line ${frame?.line ?? "-"}`}</span>
        </div>
        {error ? <div className="toast-error" role="alert">{error}</div> : null}
        {!error ? (
          <div className="flow-stage">
            <ReactFlow
              nodes={model.nodes}
              edges={model.edges}
              nodeTypes={nodeTypes}
              fitView
              nodesDraggable={false}
            >
              <ViewportSync revision={currentStep} />
              <Background />
              <MiniMap pannable zoomable />
              <Controls />
            </ReactFlow>
          </div>
        ) : null}
        <PlayerControls
          currentStep={currentStep}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          totalSteps={timeline.length}
          onPlaybackSpeedChange={setPlaybackSpeed}
          onPlayingChange={setIsPlaying}
          onStepChange={setCurrentStep}
        />
      </section>
    </main>
  );

  function runTrace() {
    setRunning(true);
    setError(null);
    setIsPlaying(false);
    const runId = activeRunId.current + 1;
    activeRunId.current = runId;
    setTimeline([]);
    setCurrentStep(0);

    loadTrace(pythonCode)
      .then((nextTimeline) => receiveTimeline(runId, nextTimeline))
      .catch((reason) => captureError(runId, reason))
      .finally(() => stopRunning(runId));
  }

  function selectTemplate(template: AlgorithmTemplate) {
    activeRunId.current += 1;
    setSelectedTemplateId(template.id);
    setPythonCode(template.source);
    setTimeline([]);
    setCurrentStep(0);
    setError(null);
    setIsPlaying(false);
    setRunning(false);
  }

  function handleCodeChange(nextCode: string) {
    setPythonCode(nextCode);

    if (selectedTemplateId !== CUSTOM_TEMPLATE.id) {
      setSelectedTemplateId(CUSTOM_TEMPLATE.id);
    }
  }

  function advancePlayback() {
    setCurrentStep((step) => {
      const lastStep = Math.max(timeline.length - 1, 0);

      if (step >= lastStep) {
        setIsPlaying(false);
        return step;
      }

      return step + 1;
    });
  }

  function receiveTimeline(runId: number, nextTimeline: TraceEvent[]) {
    if (runId !== activeRunId.current) {
      return;
    }

    setTimeline(nextTimeline);
    setCurrentStep(0);
  }

  function captureError(runId: number, reason: unknown) {
    if (runId !== activeRunId.current) {
      return;
    }

    setError(formatTraceError(reason));
    setIsPlaying(false);
  }

  function stopRunning(runId: number) {
    if (runId !== activeRunId.current) {
      return;
    }

    setRunning(false);
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

async function loadTrace(_pythonCode: string): Promise<TraceEvent[]> {
  const timeline = await invoke<TraceEvent[]>("trace_sort_algorithm", {
    pythonCode: _pythonCode,
  });

  if (!Array.isArray(timeline) || timeline.length === 0) {
    throw new Error("trace_sort_algorithm returned an empty timeline");
  }

  return timeline;
}

function ViewportSync({ revision }: { readonly revision: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    window.requestAnimationFrame(() => fitView({ padding: 0.24, duration: 180 }));
  }, [fitView, revision]);

  return null;
}
