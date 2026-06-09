import { useMemo, useState } from "react";

import { FlowPane, SourcePane } from "./TracePanes";
import { createFlowModel } from "./flowModel";
import {
  ALGORITHM_TEMPLATES,
  CUSTOM_TEMPLATE,
  DEFAULT_TEMPLATE,
  type AlgorithmTemplate,
} from "./templates";
import { useTraceSession, type TraceSession } from "./useTraceSession";

export default function App() {
  const trace = useTraceSession({ initialCode: DEFAULT_TEMPLATE.source });
  const templateCode = useTemplateCode(trace);
  const frame = trace.timeline[trace.currentStep];
  const previous = previousFrame(trace);
  const model = useMemo(
    () => createFlowModel(frame?.locals ?? {}, previous?.locals, trace.currentStep),
    [trace.currentStep, frame, previous],
  );

  return (
    <main className="app-shell">
      <SourcePane
        pythonCode={templateCode.pythonCode}
        running={trace.running}
        selectedTemplateId={templateCode.selectedTemplateId}
        templates={ALGORITHM_TEMPLATES}
        onCodeChange={templateCode.handleCodeChange}
        onRun={templateCode.runCurrentCode}
        onSelectTemplate={templateCode.selectTemplate}
      />
      <FlowPane
        currentStep={trace.currentStep}
        edges={model.edges}
        error={trace.error}
        frame={frame}
        isPlaying={trace.isPlaying}
        nodes={model.nodes}
        playbackSpeed={trace.playbackSpeed}
        running={trace.running}
        timelineLength={trace.timeline.length}
        onPlaybackSpeedChange={trace.setPlaybackSpeed}
        onPlayingChange={trace.setIsPlaying}
        onStepChange={trace.setCurrentStep}
      />
    </main>
  );
}

function useTemplateCode(trace: TraceSession) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [pythonCode, setPythonCode] = useState(DEFAULT_TEMPLATE.source);

  return {
    selectedTemplateId,
    pythonCode,
    handleCodeChange,
    runCurrentCode,
    selectTemplate,
  };

  function selectTemplate(template: AlgorithmTemplate) {
    setSelectedTemplateId(template.id);
    setPythonCode(template.source);
    trace.reset();
  }

  function handleCodeChange(nextCode: string) {
    setPythonCode(nextCode);

    if (selectedTemplateId !== CUSTOM_TEMPLATE.id) {
      setSelectedTemplateId(CUSTOM_TEMPLATE.id);
    }
  }

  function runCurrentCode() {
    trace.runTrace(pythonCode);
  }
}

function previousFrame(trace: TraceSession) {
  return trace.timeline[trace.currentStep - 1];
}
