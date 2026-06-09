import { describe, expect, it } from "vitest";

import { formatValue } from "./formatValue";

describe("formatValue", () => {
  it("marks long values as truncated previews", () => {
    const value = Array.from({ length: 200 }, (_, index) => index);

    expect(formatValue(value)).toContain("(truncated)");
  });
});
