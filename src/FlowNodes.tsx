import type { CSSProperties } from "react";
import { type NodeProps } from "@xyflow/react";

import { formatValue } from "./formatValue";
import type { ArrayGapNodeData, ArrayNodeData, LabelNodeData } from "./types";

export function ArrayValueNode({ data }: NodeProps) {
  const valueData = data as ArrayNodeData;
  const className = valueData.changed ? "array-node is-mutated" : "array-node";
  const style = valueData.changed ? flashStyle(valueData.revision) : undefined;

  return (
    <div className={className} title={valueData.variable} style={style}>
      <span className="array-index">{valueData.index}</span>
      <span className="array-value">{formatValue(valueData.value)}</span>
      <PointerLabels pointers={valueData.pointers} />
    </div>
  );
}

export function LabelValueNode({ data }: NodeProps) {
  const valueData = data as LabelNodeData;
  const className = valueData.changed ? "label-node is-mutated" : "label-node";

  return (
    <div className={className}>
      <span className="label-name">{valueData.variable}</span>
      <span className="label-value">{formatValue(valueData.value)}</span>
    </div>
  );
}

export function ArrayGapNode({ data }: NodeProps) {
  const valueData = data as ArrayGapNodeData;

  return (
    <div
      className="array-gap-node"
      title={`${valueData.variable}[${valueData.rangeStart}..${valueData.rangeEnd}]`}
    >
      <span>...</span>
      <span>{valueData.hiddenCount}</span>
    </div>
  );
}

export const nodeTypes = {
  arrayValue: ArrayValueNode,
  arrayGap: ArrayGapNode,
  labelValue: LabelValueNode,
};

function flashStyle(revision: number): CSSProperties {
  return {
    animationName: revision % 2 === 0 ? "value-flash-even" : "value-flash-odd",
  };
}

function PointerLabels({ pointers }: { readonly pointers: readonly string[] }) {
  if (pointers.length === 0) {
    return null;
  }

  return (
    <span className="pointer-labels">
      {pointers.map((pointer) => (
        <span className="pointer-pill" key={pointer}>
          {pointer}
        </span>
      ))}
    </span>
  );
}
