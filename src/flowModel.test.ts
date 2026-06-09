import { describe, expect, it } from "vitest";

import { createFlowModel } from "./flowModel";
import type { ArrayNodeData } from "./types";

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
});
