import { formatValue } from "./formatValue";
import type { Locale, TraceFrame, VariableChange } from "./types";

type TraceSemanticsContext = {
  readonly changes: readonly VariableChange[];
  readonly frame: TraceFrame | undefined;
  readonly locale: Locale;
};

export type TraceStepSemantics = {
  readonly summary: string;
  readonly updatedVariables: string;
  readonly returnValue: string | null;
};

export function traceStepSemantics(context: TraceSemanticsContext): TraceStepSemantics {
  const updatedVariables = changedVariableNames(context.changes);

  return {
    summary: traceSummary(context, updatedVariables),
    updatedVariables: updatedVariables || emptyChangeLabel(context.locale),
    returnValue: returnValueLabel(context.frame),
  };
}

function traceSummary(context: TraceSemanticsContext, names: string): string {
  if (!context.frame) {
    return context.locale === "zh" ? "还没有可展示的执行帧。" : "No trace frame is available yet.";
  }

  if (context.frame.event === "return") {
    return returnSummary(context.frame, context.locale);
  }

  if (!names) {
    return context.locale === "zh"
      ? `执行第 ${context.frame.line} 行，变量未变化。`
      : `Executed line ${context.frame.line}; no variables changed.`;
  }

  return context.locale === "zh"
    ? `执行第 ${context.frame.line} 行，更新 ${names}。`
    : `Executed line ${context.frame.line}; updated ${names}.`;
}

function returnSummary(frame: TraceFrame, locale: Locale): string {
  const value = returnValueLabel(frame) ?? "null";

  return locale === "zh"
    ? `${frame.scopeName} 返回 ${value}。`
    : `${frame.scopeName} returned ${value}.`;
}

function changedVariableNames(changes: readonly VariableChange[]): string {
  return changes.map((change) => change.name).join(", ");
}

function emptyChangeLabel(locale: Locale): string {
  return locale === "zh" ? "无" : "none";
}

function returnValueLabel(frame: TraceFrame | undefined): string | null {
  if (frame?.event !== "return") {
    return null;
  }

  return formatValue(frame.returnValue);
}
