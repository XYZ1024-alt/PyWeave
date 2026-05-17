import type { Edge, Node } from "@xyflow/react";

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { readonly [key: string]: JsonValue };

export type TraceEvent = {
  readonly line: number;
  readonly locals: JsonObject;
};

export type ArrayNodeData = {
  readonly variable: string;
  readonly index: number;
  readonly value: JsonValue;
  readonly changed: boolean;
  readonly revision: number;
};

export type LabelNodeData = {
  readonly variable: string;
  readonly value: JsonValue;
};

export type FlowNode = Node<ArrayNodeData, "arrayValue"> | Node<LabelNodeData, "labelValue">;
export type FlowEdge = Edge;
