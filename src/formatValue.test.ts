import { describe, expect, it } from "vitest";

import { formatValue } from "./formatValue";

describe("formatValue", () => {
  it("marks long values as truncated previews", () => {
    const value = Array.from({ length: 200 }, (_, index) => index);

    expect(formatValue(value)).toContain("(truncated)");
  });

  it("formats sequence preview metadata explicitly", () => {
    const value = {
      __pyweavePreview: "sequence",
      typeName: "list",
      length: 100,
      head: [0, 1],
      tailStart: 99,
      tail: [99],
      truncated: true,
    } as const;

    expect(formatValue(value)).toBe("list(len=100, preview=[0, 1, ..., 99])");
  });
});
