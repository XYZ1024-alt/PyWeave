import { useMemo, useState } from "react";

import { FlowPane, SourcePane } from "./TracePanes";
import { createFlowModel } from "./flowModel";
import { DEFAULT_LOCALE } from "./i18n";
import { teachingNoteForStep } from "./teaching";
import {
  ALGORITHM_TEMPLATES,
  CUSTOM_TEMPLATE,
  DEFAULT_TEMPLATE,
  type AlgorithmTemplate,
} from "./templates";
import type { Locale } from "./types";
import { useTraceSession, type TraceSession } from "./useTraceSession";

export default function App() {
  const view = useAppViewModel();

  return (
    <main className="app-shell">
      <SourcePane {...view.sourcePane} />
      <FlowPane {...view.flowPane} />
    </main>
  );
}

function useAppViewModel() {
  const trace = useTraceSession({ initialCode: DEFAULT_TEMPLATE.source });
  const templateCode = useTemplateCode(trace);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const model = useMemo(
    () => createFlowModel(trace.currentFrame?.locals ?? {}, trace.previousFrame?.locals, trace.currentStep),
    [trace.currentStep, trace.currentFrame, trace.previousFrame],
  );
  const teachingNote = teachingNoteForStep({
    template: templateCode.selectedTemplate,
    frame: trace.currentFrame,
    changes: model.changes,
    locale,
  });

  const sourceLines = trace.traceRun?.sourceLines ?? sourceLinesFromCode(templateCode.pythonCode);
  const totalSteps = trace.traceRun?.frames.length ?? 0;

  return {
    sourcePane: {
      currentLine: trace.currentFrame?.line ?? trace.errorLine ?? undefined,
      locale,
      pythonCode: templateCode.pythonCode,
      running: trace.running,
      selectedTemplate: templateCode.selectedTemplate,
      templates: ALGORITHM_TEMPLATES,
      onCodeChange: templateCode.handleCodeChange,
      onLocaleChange: setLocale,
      onRun: templateCode.runCurrentCode,
      onSelectTemplate: templateCode.selectTemplate,
    },
    flowPane: {
      changes: model.changes,
      currentStep: trace.currentStep,
      edges: model.edges,
      error: trace.error,
      frame: trace.currentFrame,
      isPlaying: trace.isPlaying,
      locale,
      nodes: model.nodes,
      playbackSpeed: trace.playbackSpeed,
      running: trace.running,
      sourceLines,
      teachingNote,
      totalSteps,
      onPlaybackSpeedChange: trace.setPlaybackSpeed,
      onPlayingChange: trace.setIsPlaying,
      onStepChange: trace.setCurrentStep,
    },
  };
}

function sourceLinesFromCode(code: string) {
  return code.split(/\r?\n/).map((text, index) => ({ number: index + 1, text }));
}

function useTemplateCode(trace: TraceSession) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [pythonCode, setPythonCode] = useState(DEFAULT_TEMPLATE.source);
  const selectedTemplate =
    ALGORITHM_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? CUSTOM_TEMPLATE;

  return {
    selectedTemplateId,
    selectedTemplate,
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
