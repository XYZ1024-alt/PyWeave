import type { JsonValue } from "./types";

const MAX_FORMATTED_VALUE_CHARS = 240;

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

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
