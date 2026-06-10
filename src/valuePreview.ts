import type { JsonObject, JsonValue } from "./types";

export type SequencePreview = JsonObject & {
  readonly __pyweavePreview: "sequence";
  readonly typeName: string;
  readonly length: number;
  readonly head: readonly JsonValue[];
  readonly tailStart: number;
  readonly tail: readonly JsonValue[];
  readonly truncated: true;
};

export type MappingPreview = JsonObject & {
  readonly __pyweavePreview: "mapping";
  readonly typeName: string;
  readonly length: number;
  readonly entries: JsonObject;
  readonly truncated: true;
};

export type PreviewCell = {
  readonly known: boolean;
  readonly value: JsonValue;
};

const PREVIEW_MARKER = "__pyweavePreview";
const SEQUENCE_PREVIEW = "sequence";
const MAPPING_PREVIEW = "mapping";
const UNKNOWN_PREVIEW_VALUE = "<not captured in preview>";

export function isSequencePreview(value: JsonValue): value is SequencePreview {
  const object = jsonObject(value);

  return Boolean(
    object &&
      object[PREVIEW_MARKER] === SEQUENCE_PREVIEW &&
      typeof object.typeName === "string" &&
      typeof object.length === "number" &&
      Array.isArray(object.head) &&
      typeof object.tailStart === "number" &&
      Array.isArray(object.tail),
  );
}

export function isMappingPreview(value: JsonValue): value is MappingPreview {
  const object = jsonObject(value);

  return Boolean(
    object &&
      object[PREVIEW_MARKER] === MAPPING_PREVIEW &&
      typeof object.typeName === "string" &&
      typeof object.length === "number" &&
      jsonObject(object.entries),
  );
}

export function sequencePreviewCell(preview: SequencePreview, index: number): PreviewCell {
  if (index < preview.head.length) {
    return { known: true, value: preview.head[index] };
  }

  const tailIndex = index - preview.tailStart;

  if (tailIndex >= 0 && tailIndex < preview.tail.length) {
    return { known: true, value: preview.tail[tailIndex] };
  }

  return { known: false, value: UNKNOWN_PREVIEW_VALUE };
}

function jsonObject(value: JsonValue): JsonObject | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return Array.isArray(value) ? undefined : value as JsonObject;
}
