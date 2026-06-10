import type { JsonValue } from "./types";
import { isMappingPreview, isSequencePreview } from "./valuePreview";
import type { MappingPreview, SequencePreview } from "./valuePreview";

const MAX_FORMATTED_VALUE_CHARS = 240;
const PREVIEW_ITEM_SEPARATOR = ", ";

export function formatValue(value: JsonValue): string {
  const formatted = formatRawValue(value);

  if (formatted.length <= MAX_FORMATTED_VALUE_CHARS) {
    return formatted;
  }

  return `${formatted.slice(0, MAX_FORMATTED_VALUE_CHARS)}... (truncated)`;
}

function formatRawValue(value: JsonValue): string {
  if (value === null) {
    return "null";
  }

  if (isSequencePreview(value)) {
    return formatSequencePreview(value);
  }

  if (isMappingPreview(value)) {
    return formatMappingPreview(value);
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function formatSequencePreview(value: SequencePreview): string {
  const head = value.head.map(formatRawValue);
  const tail = value.tail.map(formatRawValue);
  const items = [...head, "...", ...tail].join(PREVIEW_ITEM_SEPARATOR);

  return `${value.typeName}(len=${value.length}, preview=[${items}])`;
}

function formatMappingPreview(value: MappingPreview): string {
  return `${value.typeName}(len=${value.length}, preview=${JSON.stringify(value.entries)})`;
}
