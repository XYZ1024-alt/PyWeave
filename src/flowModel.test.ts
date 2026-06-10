import { describe, expect, it } from "vitest";

import { createFlowModel } from "./flowModel";
import type { ArrayGapNodeData, ArrayNodeData } from "./types";

describe("createFlowModel", () => {
  it("places pointer labels directly on array cells", () => {
    const model = createFlowModel(
      { items: [3, 1, 4], i: 2, total: 4 },
      { items: [3, 1, 4], i: 1, total: 3 },
      4,
    );

    const node = model.nodes.find((candidate) => candidate.id === "items-2");
    const data = node?.data as ArrayNodeData | undefined;

    expect(data?.pointers).toEqual(["i"]);
    expect(model.edges).toEqual([]);
  });

  it("reports only variables that changed between frames", () => {
    const model = createFlowModel(
      { items: [3, 1, 4], i: 2, total: 4 },
      { items: [3, 1, 4], i: 1, total: 3 },
      4,
    );

    expect(model.changes.map((change) => change.name)).toEqual(["i", "total"]);
    expect(model.changes[0]).toMatchObject({ name: "i", before: 1, after: 2 });
  });

  it("summarizes large arrays while keeping pointer cells visible", () => {
    const items = Array.from({ length: 100 }, (_, index) => index);
    const model = createFlowModel({ items, mid: 50 }, undefined, 1);
    const gap = model.nodes.find((node) => node.type === "arrayGap");
    const pointerNode = model.nodes.find((node) => node.id === "items-50");

    expect((gap?.data as ArrayGapNodeData | undefined)?.hiddenCount).toBeGreaterThan(0);
    expect((pointerNode?.data as ArrayNodeData | undefined)?.pointers).toEqual(["mid"]);
    expect(model.nodes.length).toBeLessThan(items.length);
  });

  it("visualizes backend sequence previews without expanding the full array", () => {
    const previewLength = 1_000;
    const pointerIndex = 500;
    const items = {
      __pyweavePreview: "sequence",
      typeName: "list",
      length: previewLength,
      head: [0, 1],
      tailStart: 999,
      tail: [999],
      truncated: true,
    } as const;
    const model = createFlowModel({ items, mid: pointerIndex }, undefined, 1);
    const pointerNode = model.nodes.find((node) => node.id === `items-${pointerIndex}`);
    const pointerData = pointerNode?.data as ArrayNodeData | undefined;

    expect(model.nodes.length).toBeLessThan(items.length);
    expect(pointerData?.pointers).toEqual(["mid"]);
    expect(pointerData?.value).toBe("<not captured in preview>");
  });
});
