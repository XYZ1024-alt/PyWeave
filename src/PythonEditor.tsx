import Editor from "@monaco-editor/react";

type PythonEditorProps = {
  readonly code: string;
  readonly isRunning: boolean;
  readonly onCodeChange: (code: string) => void;
  readonly onRun: () => void;
};

export function PythonEditor({
  code,
  isRunning,
  onCodeChange,
  onRun,
}: PythonEditorProps) {
  return (
    <div className="editor-shell">
      <Editor
        height="100%"
        language="python"
        theme="vs-dark"
        value={code}
        onChange={handleChange}
        options={{
          autoIndent: "full",
          automaticLayout: true,
          detectIndentation: false,
          fontFamily: "Cascadia Code, JetBrains Mono, Consolas, monospace",
          fontSize: 14,
          insertSpaces: true,
          lineNumbers: "on",
          minimap: { enabled: false },
          padding: { top: 14, bottom: 14 },
          scrollBeyondLastLine: false,
          tabSize: 4,
          wordWrap: "off",
        }}
      />
      <div className="editor-actions">
        <button type="button" onClick={onRun} disabled={isRunning}>
          Run and Visualize
        </button>
      </div>
    </div>
  );

  function handleChange(value: string | undefined) {
    onCodeChange(value ?? "");
  }
}
