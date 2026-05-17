import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import { formatValue } from "./formatValue";
import type { ArrayNodeData, LabelNodeData } from "./types";

export function ArrayValueNode({ data }: NodeProps) {
  const valueData = data as ArrayNodeData;
  const className = valueData.changed ? "array-node is-mutated" : "array-node";
  const style = valueData.changed ? flashStyle(valueData.revision) : undefined;

  return (
    <div className={className} title={valueData.variable} style={style}>
      <Handle type="target" position={Position.Top} className="node-handle" />
      <span className="array-index">{valueData.index}</span>
      <span className="array-value">{formatValue(valueData.value)}</span>
    </div>
  );
}

export function LabelValueNode({ data }: NodeProps) {
  const valueData = data as LabelNodeData;

  return (
    <div className="label-node">
      <span className="label-name">{valueData.variable}</span>
      <span className="label-value">{formatValue(valueData.value)}</span>
      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
}

export const nodeTypes = {
  arrayValue: ArrayValueNode,
  labelValue: LabelValueNode,
};

function flashStyle(revision: number): CSSProperties {
  return {
    animationName: revision % 2 === 0 ? "value-flash-even" : "value-flash-odd",
  };
}
