import { useEffect } from "react";
import { Background, Controls, MiniMap, ReactFlow, useReactFlow } from "@xyflow/react";

import { nodeTypes } from "./FlowNodes";
import { formatValue } from "./formatValue";
import { ui } from "./i18n";
import { PlayerControls } from "./PlayerControls";
import { PythonEditor } from "./PythonEditor";
import { TemplatePicker } from "./TemplatePicker";
import type { TeachingNote } from "./teaching";
import type { AlgorithmTemplate } from "./templates";
import type {
  FlowEdge,
  FlowNode,
  JsonValue,
  Locale,
  SourceLine,
  TraceDisplayError,
  TraceFrame,
  VariableChange,
} from "./types";

type SourcePaneProps = {
  readonly currentLine: number | undefined;
  readonly locale: Locale;
  readonly pythonCode: string;
  readonly running: boolean;
  readonly selectedTemplate: AlgorithmTemplate;
  readonly templates: readonly AlgorithmTemplate[];
  readonly onCodeChange: (code: string) => void;
  readonly onLocaleChange: (locale: Locale) => void;
  readonly onRun: () => void;
  readonly onSelectTemplate: (template: AlgorithmTemplate) => void;
};

type FlowPaneProps = {
  readonly changes: readonly VariableChange[];
  readonly currentStep: number;
  readonly edges: FlowEdge[];
  readonly error: TraceDisplayError | null;
  readonly frame: TraceFrame | undefined;
  readonly isPlaying: boolean;
  readonly locale: Locale;
  readonly nodes: FlowNode[];
  readonly playbackSpeed: number;
  readonly running: boolean;
  readonly sourceLines: readonly SourceLine[];
  readonly teachingNote: TeachingNote;
  readonly totalSteps: number;
  readonly onPlaybackSpeedChange: (speed: number) => void;
  readonly onPlayingChange: (isPlaying: boolean) => void;
  readonly onStepChange: (step: number) => void;
};

export function SourcePane(props: SourcePaneProps) {
  return (
    <section className="source-pane" aria-label="Python source">
      <div className="pane-header">
        <span>{ui("editorTitle", props.locale)}</span>
        <HeaderActions {...props} />
      </div>
      <TemplatePicker
        locale={props.locale}
        selectedTemplateId={props.selectedTemplate.id}
        templates={props.templates}
        onSelectTemplate={props.onSelectTemplate}
      />
      <PythonEditor
        code={props.pythonCode}
        currentLine={props.currentLine}
        isRunning={props.running}
        locale={props.locale}
        onCodeChange={props.onCodeChange}
        onRun={props.onRun}
      />
    </section>
  );
}

export function FlowPane(props: FlowPaneProps) {
  return (
    <section className="flow-pane" aria-label="Algorithm playback">
      <FlowHeader {...props} />
      <div className="visualization-shell">
        {props.error ? (
          <ErrorPanel error={props.error} locale={props.locale} sourceLines={props.sourceLines} />
        ) : (
          <FlowStage nodes={props.nodes} edges={props.edges} revision={props.currentStep} />
        )}
        <TeachingSidebar {...props} />
      </div>
      <PlayerControls
        currentStep={props.currentStep}
        isPlaying={props.isPlaying}
        locale={props.locale}
        playbackSpeed={props.playbackSpeed}
        totalSteps={props.totalSteps}
        onPlaybackSpeedChange={props.onPlaybackSpeedChange}
        onPlayingChange={props.onPlayingChange}
        onStepChange={props.onStepChange}
      />
    </section>
  );
}

function HeaderActions(props: SourcePaneProps) {
  return (
    <div className="header-actions">
      <span>{props.pythonCode.length} {ui("chars", props.locale)}</span>
      <LocaleToggle locale={props.locale} onLocaleChange={props.onLocaleChange} />
    </div>
  );
}

function LocaleToggle({
  locale,
  onLocaleChange,
}: {
  readonly locale: Locale;
  readonly onLocaleChange: (locale: Locale) => void;
}) {
  return (
    <div className="locale-toggle" role="group" aria-label="Language">
      <button type="button" className={locale === "zh" ? "is-selected" : ""} onClick={() => onLocaleChange("zh")}>
        中
      </button>
      <button type="button" className={locale === "en" ? "is-selected" : ""} onClick={() => onLocaleChange("en")}>
        EN
      </button>
    </div>
  );
}

function FlowHeader(props: FlowPaneProps) {
  const line = props.error?.line ?? props.frame?.line ?? "-";

  return (
    <div className="pane-header">
      <span>{ui("visualizationTitle", props.locale)}</span>
      <span>{props.running ? ui("running", props.locale) : `${ui("line", props.locale)} ${line}`}</span>
    </div>
  );
}

function TeachingSidebar(props: FlowPaneProps) {
  return (
    <aside className="teaching-sidebar" aria-label={ui("teachingTitle", props.locale)}>
      <StepGuide {...props} />
      <VariableInspector changes={props.changes} frame={props.frame} locale={props.locale} />
    </aside>
  );
}

function StepGuide(props: FlowPaneProps) {
  const sourceLine = sourceLineForFrame(props.sourceLines, props.frame);

  return (
    <section className="sidebar-section">
      <h2>{ui("teachingTitle", props.locale)}</h2>
      <div className="step-meta">
        <span>{ui("step", props.locale)} {stepLabel(props.currentStep, props.totalSteps)}</span>
        <span>{ui("event", props.locale)} {traceEventLabel(props.frame, props.locale)}</span>
        <span>{ui("currentScope", props.locale)} {props.frame?.scopeName ?? "-"}</span>
        <span>{ui("callDepth", props.locale)} {props.frame?.callDepth ?? "-"}</span>
      </div>
      <h3>{props.teachingNote.title}</h3>
      <p>{props.teachingNote.summary}</p>
      {sourceLine ? <code className="current-line-preview">{sourceLine.text}</code> : null}
    </section>
  );
}

function ErrorPanel({
  error,
  locale,
  sourceLines,
}: {
  readonly error: TraceDisplayError;
  readonly locale: Locale;
  readonly sourceLines: readonly SourceLine[];
}) {
  const sourceLine = sourceLineForNumber(sourceLines, error.line);

  return (
    <section className="error-panel" role="alert">
      <h2>{ui("errorTitle", locale)}</h2>
      <dl>
        <ErrorDetail label={ui("errorKind", locale)} value={error.kind} />
        <ErrorDetail label={ui("errorLine", locale)} value={error.line ?? "-"} />
        <ErrorDetail label={ui("errorMessage", locale)} value={error.message} />
      </dl>
      {sourceLine ? <code className="current-line-preview">{sourceLine.text}</code> : null}
    </section>
  );
}

function ErrorDetail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function VariableInspector({
  changes,
  frame,
  locale,
}: {
  readonly changes: readonly VariableChange[];
  readonly frame: TraceFrame | undefined;
  readonly locale: Locale;
}) {
  return (
    <section className="sidebar-section variable-inspector">
      <h2>{ui("variablesTitle", locale)}</h2>
      <ChangeList changes={changes} locale={locale} />
      <LocalList locals={frame?.locals ?? {}} />
    </section>
  );
}

function ChangeList({
  changes,
  locale,
}: {
  readonly changes: readonly VariableChange[];
  readonly locale: Locale;
}) {
  if (changes.length === 0) {
    return <p className="empty-state">{ui("emptyChanges", locale)}</p>;
  }

  return (
    <div className="change-list">
      {changes.map((change) => (
        <div className={`change-row change-${change.status}`} key={change.name}>
          <span>{change.name}</span>
          <span>{formatOptionalValue(change.after)}</span>
        </div>
      ))}
    </div>
  );
}

function LocalList({ locals }: { readonly locals: Readonly<Record<string, JsonValue>> }) {
  return (
    <div className="local-list">
      {Object.entries(locals).map(([name, value]) => (
        <div className="local-row" key={name}>
          <span>{name}</span>
          <span>{formatValue(value)}</span>
        </div>
      ))}
    </div>
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
        <Background gap={32} size={1.4} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function ViewportSync({ revision }: { readonly revision: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    window.requestAnimationFrame(() => fitView({ padding: 0.18, duration: 180 }));
  }, [fitView, revision]);

  return null;
}

function stepLabel(currentStep: number, totalSteps: number): string {
  return totalSteps === 0 ? "0 / 0" : `${currentStep + 1} / ${totalSteps}`;
}

function sourceLineForFrame(
  sourceLines: readonly SourceLine[],
  frame: TraceFrame | undefined,
): SourceLine | undefined {
  if (frame?.lineText) {
    return { number: frame.line, text: frame.lineText };
  }

  return sourceLineForNumber(sourceLines, frame?.line ?? null);
}

function sourceLineForNumber(
  sourceLines: readonly SourceLine[],
  lineNumber: number | null,
): SourceLine | undefined {
  return sourceLines.find((line) => line.number === lineNumber);
}

function traceEventLabel(frame: TraceFrame | undefined, locale: Locale): string {
  if (frame?.event === "return") {
    return ui("eventReturn", locale);
  }

  return ui("eventLine", locale);
}

function formatOptionalValue(value: JsonValue | undefined): string {
  return value === undefined ? "n/a" : formatValue(value);
}
