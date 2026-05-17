import type { FlowEdge, FlowNode, JsonObject, JsonValue } from "./types";

const ARRAY_NODE_SPACING = 74;
const ROW_HEIGHT = 112;
const LEFT_OFFSET = 48;
const TOP_OFFSET = 42;
const POINTER_VARIABLES = new Set([
  "i",
  "j",
  "k",
  "left",
  "right",
  "low",
  "high",
  "pivot",
  "index",
  "candidate",
  "min_index",
]);

type FlowModel = {
  readonly nodes: FlowNode[];
  readonly edges: FlowEdge[];
};

type ArrayEntry = {
  readonly variable: string;
  readonly values: readonly JsonValue[];
  readonly row: number;
};

export function createFlowModel(
  current: JsonObject,
  previous: JsonObject | undefined,
  revision: number,
): FlowModel {
  const entries = orderEntries(Object.entries(current));
  const arrays = collectArrays(entries);
  const nodes = entries.flatMap(([variable, value], row) =>
    Array.isArray(value)
      ? createArrayNodes(variable, value, previous, row, revision)
      : createLabelNode(variable, value, row),
  );

  return {
    nodes,
    edges: createPointerEdges(current, arrays),
  };
}

function orderEntries(entries: readonly [string, JsonValue][]): [string, JsonValue][] {
  return [
    ...entries.filter(([, value]) => Array.isArray(value)),
    ...entries.filter(([, value]) => !Array.isArray(value)),
  ];
}

function collectArrays(entries: readonly [string, JsonValue][]): ArrayEntry[] {
  return entries.flatMap(([variable, value], row) =>
    Array.isArray(value) ? [{ variable, values: value, row }] : [],
  );
}

function createArrayNodes(
  variable: string,
  values: readonly JsonValue[],
  previous: JsonObject | undefined,
  row: number,
  revision: number,
): FlowNode[] {
  return values.map((value, index) => ({
    id: arrayNodeId(variable, index),
    type: "arrayValue" as const,
    position: {
      x: LEFT_OFFSET + index * ARRAY_NODE_SPACING,
      y: TOP_OFFSET + row * ROW_HEIGHT,
    },
    data: {
      variable,
      index,
      value,
      revision,
      changed: didArrayValueChange(previous?.[variable], value, index),
    },
  }));
}

function createLabelNode(variable: string, value: JsonValue, row: number): FlowNode[] {
  return [
    {
      id: variable,
      type: "labelValue" as const,
      position: { x: LEFT_OFFSET, y: TOP_OFFSET + row * ROW_HEIGHT },
      data: { variable, value },
    },
  ];
}

function createPointerEdges(current: JsonObject, arrays: readonly ArrayEntry[]): FlowEdge[] {
  const targetArray = selectTargetArray(arrays);

  if (!targetArray) {
    return [];
  }

  return Object.entries(current)
    .filter(([variable, value]) => isPointer(variable, value, targetArray.values))
    .map(([variable, value]) => pointerEdge(variable, value as number, targetArray.variable));
}

function selectTargetArray(arrays: readonly ArrayEntry[]): ArrayEntry | undefined {
  return arrays.find((array) => array.variable === "items") ?? arrays[0];
}

function isPointer(
  variable: string,
  value: JsonValue,
  targetValues: readonly JsonValue[],
): boolean {
  if (!POINTER_VARIABLES.has(variable) || typeof value !== "number") {
    return false;
  }

  if (!Number.isInteger(value)) {
    return false;
  }

  return value >= 0 && value < targetValues.length;
}

function pointerEdge(variable: string, index: number, arrayVariable: string): FlowEdge {
  return {
    id: `pointer-${variable}`,
    source: variable,
    target: arrayNodeId(arrayVariable, index),
    animated: true,
    type: "smoothstep",
    label: variable,
    className: "pointer-edge",
  };
}

function didArrayValueChange(
  previousValue: JsonValue | undefined,
  currentValue: JsonValue,
  index: number,
): boolean {
  return Array.isArray(previousValue) && previousValue[index] !== currentValue;
}

function arrayNodeId(variable: string, index: number): string {
  return `${variable}-${index}`;
}
