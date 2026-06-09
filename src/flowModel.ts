import type { FlowEdge, FlowNode, JsonObject, JsonValue, VariableChange } from "./types";

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
  readonly changes: VariableChange[];
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
  const targetArray = selectTargetArray(arrays);
  const pointers = targetArray ? collectPointers(current, targetArray) : new Map<number, string[]>();
  const nodes = entries.flatMap(([variable, value], row) =>
    Array.isArray(value)
      ? createArrayNodes({ variable, values: value, previous, row, revision, pointers })
      : createLabelNode(variable, value, previous, row),
  );

  return {
    nodes,
    edges: [],
    changes: createVariableChanges(current, previous),
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

function createArrayNodes(options: {
  readonly variable: string;
  readonly values: readonly JsonValue[];
  readonly previous: JsonObject | undefined;
  readonly row: number;
  readonly revision: number;
  readonly pointers: ReadonlyMap<number, readonly string[]>;
}): FlowNode[] {
  return options.values.map((value, index) => ({
    id: arrayNodeId(options.variable, index),
    type: "arrayValue" as const,
    position: {
      x: LEFT_OFFSET + index * ARRAY_NODE_SPACING,
      y: TOP_OFFSET + options.row * ROW_HEIGHT,
    },
    data: {
      variable: options.variable,
      index,
      pointers: options.pointers.get(index) ?? [],
      value,
      revision: options.revision,
      changed: didArrayValueChange(options.previous?.[options.variable], value, index),
    },
  }));
}

function createLabelNode(
  variable: string,
  value: JsonValue,
  previous: JsonObject | undefined,
  row: number,
): FlowNode[] {
  return [
    {
      id: variable,
      type: "labelValue" as const,
      position: { x: LEFT_OFFSET, y: TOP_OFFSET + row * ROW_HEIGHT },
      data: {
        variable,
        value,
        changed: previous ? !jsonValuesEqual(previous[variable], value) : true,
      },
    },
  ];
}

function collectPointers(
  current: JsonObject,
  targetArray: ArrayEntry,
): ReadonlyMap<number, readonly string[]> {
  const entries = Object.entries(current)
    .filter(([variable, value]) => isPointer(variable, value, targetArray.values))
    .map(([variable, value]) => [value as number, variable] as const);
  const pointers = new Map<number, string[]>();

  for (const [index, variable] of entries) {
    pointers.set(index, [...(pointers.get(index) ?? []), variable]);
  }

  return pointers;
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

function createVariableChanges(
  current: JsonObject,
  previous: JsonObject | undefined,
): VariableChange[] {
  if (!previous) {
    return Object.entries(current).map(([name, after]) => ({
      name,
      before: undefined,
      after,
      status: "added" as const,
    }));
  }

  return allVariableNames(current, previous).flatMap((name) => variableChange(name, current, previous));
}

function allVariableNames(current: JsonObject, previous: JsonObject): string[] {
  return [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort();
}

function variableChange(
  name: string,
  current: JsonObject,
  previous: JsonObject,
): VariableChange[] {
  if (!(name in current)) {
    return [{ name, before: previous[name], after: undefined, status: "removed" }];
  }

  if (!(name in previous)) {
    return [{ name, before: undefined, after: current[name], status: "added" }];
  }

  if (jsonValuesEqual(previous[name], current[name])) {
    return [];
  }

  return [{ name, before: previous[name], after: current[name], status: "changed" }];
}

function jsonValuesEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
