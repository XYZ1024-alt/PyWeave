import type { JsonValue } from "./types";

export function formatValue(value: JsonValue): string {
  if (value === null) {
    return "null";
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
