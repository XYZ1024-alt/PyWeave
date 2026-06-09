import type { FlowEdge, FlowNode, JsonObject, JsonValue, VariableChange } from "./types";

const ARRAY_NODE_SPACING = 80;
const ROW_HEIGHT = 112;
const LEFT_OFFSET = 48;
const TOP_OFFSET = 42;
const MAX_VISIBLE_ARRAY_CELLS = 48;
const ARRAY_HEAD_CELLS = 24;
const ARRAY_TAIL_CELLS = 16;
const POINTER_VARIABLES = new Set([
  "i",
  "j",
  "k",
  "left",
  "right",
  "mid",
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

type VisibleArrayCell = {
  readonly kind: "cell";
  readonly index: number;
  readonly value: JsonValue;
};

type VisibleArrayGap = {
  readonly kind: "gap";
  readonly hiddenCount: number;
  readonly rangeEnd: number;
  readonly rangeStart: number;
};

type VisibleArrayItem = VisibleArrayCell | VisibleArrayGap;

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
  return visibleArrayItems(options.values, options.pointers).map((item, slot) =>
    item.kind === "cell"
      ? createArrayValueNode(options, item, slot)
      : createArrayGapNode({ variable: options.variable, item, row: options.row, slot }),
  );
}

function createArrayValueNode(
  options: {
    readonly variable: string;
    readonly values: readonly JsonValue[];
    readonly previous: JsonObject | undefined;
    readonly row: number;
    readonly revision: number;
    readonly pointers: ReadonlyMap<number, readonly string[]>;
  },
  item: VisibleArrayCell,
  slot: number,
): FlowNode {
  return {
    id: arrayNodeId(options.variable, item.index),
    type: "arrayValue" as const,
    position: arrayPosition(options.row, slot),
    data: {
      variable: options.variable,
      index: item.index,
      pointers: options.pointers.get(item.index) ?? [],
      value: item.value,
      revision: options.revision,
      changed: didArrayValueChange(options.previous?.[options.variable], item.value, item.index),
    },
  };
}

function createArrayGapNode(options: {
  readonly variable: string;
  readonly item: VisibleArrayGap;
  readonly row: number;
  readonly slot: number;
}): FlowNode {
  return {
    id: `${options.variable}-gap-${options.item.rangeStart}-${options.item.rangeEnd}`,
    type: "arrayGap" as const,
    position: arrayPosition(options.row, options.slot),
    data: {
      variable: options.variable,
      hiddenCount: options.item.hiddenCount,
      rangeStart: options.item.rangeStart,
      rangeEnd: options.item.rangeEnd,
    },
  };
}

function arrayPosition(row: number, slot: number) {
  return {
    x: LEFT_OFFSET + slot * ARRAY_NODE_SPACING,
    y: TOP_OFFSET + row * ROW_HEIGHT,
  };
}

function visibleArrayItems(
  values: readonly JsonValue[],
  pointers: ReadonlyMap<number, readonly string[]>,
): VisibleArrayItem[] {
  if (values.length <= MAX_VISIBLE_ARRAY_CELLS) {
    return values.map((value, index) => ({ kind: "cell", index, value }));
  }

  return insertArrayGaps(visibleArrayIndexes(values.length, pointers), values);
}

function visibleArrayIndexes(
  length: number,
  pointers: ReadonlyMap<number, readonly string[]>,
): number[] {
  const indexes = new Set<number>();
  const tailStart = Math.max(length - ARRAY_TAIL_CELLS, ARRAY_HEAD_CELLS);

  addIndexRange(indexes, 0, Math.min(ARRAY_HEAD_CELLS, length));
  addIndexRange(indexes, tailStart, length);
  for (const index of pointers.keys()) {
    indexes.add(index);
  }

  return [...indexes].filter((index) => index >= 0 && index < length).sort((left, right) => left - right);
}

function addIndexRange(indexes: Set<number>, start: number, end: number) {
  for (let index = start; index < end; index += 1) {
    indexes.add(index);
  }
}

function insertArrayGaps(
  indexes: readonly number[],
  values: readonly JsonValue[],
): VisibleArrayItem[] {
  let previousIndex = -1;
  const items: VisibleArrayItem[] = [];

  for (const index of indexes) {
    items.push(...arrayGap(previousIndex + 1, index - 1));
    items.push({ kind: "cell", index, value: values[index] });
    previousIndex = index;
  }

  return items;
}

function arrayGap(rangeStart: number, rangeEnd: number): VisibleArrayGap[] {
  if (rangeStart > rangeEnd) {
    return [];
  }

  return [{
    kind: "gap",
    hiddenCount: rangeEnd - rangeStart + 1,
    rangeStart,
    rangeEnd,
  }];
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
