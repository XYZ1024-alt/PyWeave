import type { AlgorithmTemplate, TeachingStage } from "./templates";
import type { Locale, LocalizedText, TraceFrame, VariableChange } from "./types";

type TeachingContext = {
  readonly template: AlgorithmTemplate;
  readonly frame: TraceFrame | undefined;
  readonly changes: readonly VariableChange[];
  readonly locale: Locale;
};

export type TeachingNote = {
  readonly title: string;
  readonly summary: string;
  readonly focusVariables: readonly string[];
};

const GENERIC_TITLE: LocalizedText = {
  zh: "观察当前步骤",
  en: "Observe the current step",
};

const GENERIC_SUMMARY: LocalizedText = {
  zh: "这一帧来自自定义代码，重点看当前行和变量变化。",
  en: "This frame comes from custom code; focus on the current line and variable changes.",
};

export function teachingNoteForStep(context: TeachingContext): TeachingNote {
  const stage = findStage(context.template.teaching, context.frame?.line);

  if (!stage) {
    return genericTeachingNote(context);
  }

  return {
    title: stage.title[context.locale],
    summary: stage.summary[context.locale],
    focusVariables: stage.focusVariables,
  };
}

function findStage(
  stages: readonly TeachingStage[],
  line: number | undefined,
): TeachingStage | undefined {
  if (!line) {
    return undefined;
  }

  return stages.find((stage) => line >= stage.lineStart && line <= stage.lineEnd);
}

function genericTeachingNote(context: TeachingContext): TeachingNote {
  return {
    title: GENERIC_TITLE[context.locale],
    summary: changedVariablesSummary(context),
    focusVariables: context.changes.map((change) => change.name),
  };
}

function changedVariablesSummary(context: TeachingContext): string {
  if (context.changes.length === 0) {
    return GENERIC_SUMMARY[context.locale];
  }

  const names = context.changes.map((change) => change.name).join(", ");
  return context.locale === "zh" ? `这一帧更新了 ${names}。` : `This frame updates ${names}.`;
}
