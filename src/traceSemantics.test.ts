import { describe, expect, it } from "vitest";

import { traceStepSemantics } from "./traceSemantics";
import type { TraceFrame } from "./types";

const BASE_FRAME: TraceFrame = {
  step: 0,
  event: "line",
  line: 8,
  lineText: "total = total + items[i]",
  scopeName: "<module>",
  callDepth: 0,
  locals: {},
  returnValue: null,
};

describe("traceStepSemantics", () => {
  it("summarizes changed variables for line frames", () => {
    const semantics = traceStepSemantics({
      frame: BASE_FRAME,
      changes: [{ name: "total", before: 0, after: 3, status: "changed" }],
      locale: "zh",
    });

    expect(semantics.summary).toBe("执行第 8 行，更新 total。");
    expect(semantics.updatedVariables).toBe("total");
  });

  it("summarizes return values for return frames", () => {
    const semantics = traceStepSemantics({
      frame: { ...BASE_FRAME, event: "return", scopeName: "solve", returnValue: 42 },
      changes: [],
      locale: "en",
    });

    expect(semantics.summary).toBe("solve returned 42.");
    expect(semantics.returnValue).toBe("42");
  });
});
