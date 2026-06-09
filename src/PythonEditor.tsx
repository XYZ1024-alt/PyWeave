import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";

import { ui } from "./i18n";
import type { Locale } from "./types";

type MonacoEditor = Parameters<OnMount>[0];
type MonacoApi = Parameters<OnMount>[1];

type PythonEditorProps = {
  readonly code: string;
  readonly currentLine: number | undefined;
  readonly isRunning: boolean;
  readonly locale: Locale;
  readonly onCodeChange: (code: string) => void;
  readonly onRun: () => void;
};

export function PythonEditor(props: PythonEditorProps) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const decorationsRef = useRef<ReturnType<MonacoEditor["createDecorationsCollection"]> | null>(null);

  useEffect(() => {
    syncCurrentLineDecoration({
      currentLine: props.currentLine,
      decorations: decorationsRef.current,
      monaco: monacoRef.current,
    });
  }, [props.currentLine]);

  return (
    <div className="editor-shell">
      <EditorView code={props.code} onChange={handleChange} onMount={handleMount} />
      <EditorActions isRunning={props.isRunning} locale={props.locale} onRun={props.onRun} />
    </div>
  );

  function handleChange(value: string | undefined) {
    props.onCodeChange(value ?? "");
  }

  function handleMount(editor: MonacoEditor, monaco: MonacoApi) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    decorationsRef.current = editor.createDecorationsCollection();
  }
}

function EditorView({
  code,
  onChange,
  onMount,
}: {
  readonly code: string;
  readonly onChange: (value: string | undefined) => void;
  readonly onMount: OnMount;
}) {
  return (
    <Editor
      height="100%"
      language="python"
      theme="vs-dark"
      value={code}
      onChange={onChange}
      onMount={onMount}
      options={editorOptions}
    />
  );
}

function EditorActions({
  isRunning,
  locale,
  onRun,
}: Pick<PythonEditorProps, "isRunning" | "locale" | "onRun">) {
  return (
    <div className="editor-actions">
      <button type="button" onClick={onRun} disabled={isRunning}>
        {ui("run", locale)}
      </button>
    </div>
  );
}

const editorOptions = {
  autoIndent: "full",
  automaticLayout: true,
  detectIndentation: false,
  fontFamily: "Cascadia Code, JetBrains Mono, Consolas, monospace",
  fontSize: 14,
  glyphMargin: true,
  insertSpaces: true,
  lineNumbers: "on",
  minimap: { enabled: false },
  padding: { top: 14, bottom: 14 },
  scrollBeyondLastLine: false,
  tabSize: 4,
  wordWrap: "off",
} as const;

function syncCurrentLineDecoration(options: {
  readonly currentLine: number | undefined;
  readonly decorations: ReturnType<MonacoEditor["createDecorationsCollection"]> | null;
  readonly monaco: MonacoApi | null;
}) {
  if (!options.decorations || !options.monaco || !options.currentLine) {
    options.decorations?.set([]);
    return;
  }

  options.decorations.set([
    {
      range: new options.monaco.Range(options.currentLine, 1, options.currentLine, 1),
      options: {
        className: "current-execution-line",
        glyphMarginClassName: "current-execution-glyph",
        isWholeLine: true,
      },
    },
  ]);
}
