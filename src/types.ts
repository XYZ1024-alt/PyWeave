import type { Edge, Node } from "@xyflow/react";

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { readonly [key: string]: JsonValue };

export type Locale = "zh" | "en";
export type LocalizedText = Readonly<Record<Locale, string>>;

export type SourceLine = {
  readonly number: number;
  readonly text: string;
};

export type TraceFrame = {
  readonly step: number;
  readonly event: "line" | "return";
  readonly line: number;
  readonly lineText: string;
  readonly scopeName: string;
  readonly callDepth: number;
  readonly locals: JsonObject;
  readonly returnValue: JsonValue | null;
};

export type TraceRun = {
  readonly sourceLines: readonly SourceLine[];
  readonly frames: readonly TraceFrame[];
};

export type VariableChange = {
  readonly name: string;
  readonly before: JsonValue | undefined;
  readonly after: JsonValue | undefined;
  readonly status: "added" | "changed" | "removed";
};

export type TraceDisplayError = {
  readonly kind: string;
  readonly line: number | null;
  readonly message: string;
};

export type ArrayNodeData = {
  readonly variable: string;
  readonly index: number;
  readonly pointers: readonly string[];
  readonly value: JsonValue;
  readonly changed: boolean;
  readonly revision: number;
};

export type ArrayGapNodeData = {
  readonly variable: string;
  readonly hiddenCount: number;
  readonly rangeStart: number;
  readonly rangeEnd: number;
};

export type LabelNodeData = {
  readonly variable: string;
  readonly changed: boolean;
  readonly value: JsonValue;
};

export type FlowNode =
  | Node<ArrayNodeData, "arrayValue">
  | Node<ArrayGapNodeData, "arrayGap">
  | Node<LabelNodeData, "labelValue">;
export type FlowEdge = Edge;
