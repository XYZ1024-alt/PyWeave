import { useEffect } from "react";
import { Background, Controls, MiniMap, ReactFlow, useReactFlow } from "@xyflow/react";

import { nodeTypes } from "./FlowNodes";
import { PlayerControls } from "./PlayerControls";
import { PythonEditor } from "./PythonEditor";
import { TemplatePicker } from "./TemplatePicker";
import type { AlgorithmTemplate } from "./templates";
import type { FlowEdge, FlowNode, TraceEvent } from "./types";

type SourcePaneProps = {
  readonly pythonCode: string;
  readonly running: boolean;
  readonly selectedTemplateId: string;
  readonly templates: readonly AlgorithmTemplate[];
  readonly onCodeChange: (code: string) => void;
  readonly onRun: () => void;
  readonly onSelectTemplate: (template: AlgorithmTemplate) => void;
};

type FlowPaneProps = {
  readonly currentStep: number;
  readonly edges: FlowEdge[];
  readonly error: string | null;
  readonly frame: TraceEvent | undefined;
  readonly isPlaying: boolean;
  readonly nodes: FlowNode[];
  readonly playbackSpeed: number;
  readonly running: boolean;
  readonly timelineLength: number;
  readonly onPlaybackSpeedChange: (speed: number) => void;
  readonly onPlayingChange: (isPlaying: boolean) => void;
  readonly onStepChange: (step: number) => void;
};

export function SourcePane(props: SourcePaneProps) {
  return (
    <section className="source-pane" aria-label="Python source">
      <div className="pane-header">
        <span>Python Editor</span>
        <span>{props.pythonCode.length} chars</span>
      </div>
      <TemplatePicker
        selectedTemplateId={props.selectedTemplateId}
        templates={props.templates}
        onSelectTemplate={props.onSelectTemplate}
      />
      <PythonEditor
        code={props.pythonCode}
        isRunning={props.running}
        onCodeChange={props.onCodeChange}
        onRun={props.onRun}
      />
    </section>
  );
}

export function FlowPane(props: FlowPaneProps) {
  return (
    <section className="flow-pane" aria-label="Algorithm playback">
      <div className="pane-header">
        <span>Variables</span>
        <span>{props.running ? "running" : `line ${props.frame?.line ?? "-"}`}</span>
      </div>
      {props.error ? <div className="toast-error" role="alert">{props.error}</div> : null}
      {!props.error ? <FlowStage nodes={props.nodes} edges={props.edges} revision={props.currentStep} /> : null}
      <PlayerControls
        currentStep={props.currentStep}
        isPlaying={props.isPlaying}
        playbackSpeed={props.playbackSpeed}
        totalSteps={props.timelineLength}
        onPlaybackSpeedChange={props.onPlaybackSpeedChange}
        onPlayingChange={props.onPlayingChange}
        onStepChange={props.onStepChange}
      />
    </section>
  );
}

function FlowStage({
  edges,
  nodes,
  revision,
}: {
  readonly edges: FlowEdge[];
  readonly nodes: FlowNode[];
  readonly revision: number;
}) {
  return (
    <div className="flow-stage">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView nodesDraggable={false}>
        <ViewportSync revision={revision} />
        <Background />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function ViewportSync({ revision }: { readonly revision: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    window.requestAnimationFrame(() => fitView({ padding: 0.24, duration: 180 }));
  }, [fitView, revision]);

  return null;
}
