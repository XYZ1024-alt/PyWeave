import type { Locale, LocalizedText } from "./types";

type UiKey =
  | "appStatus"
  | "changedVariables"
  | "chars"
  | "callDepth"
  | "currentLine"
  | "currentScope"
  | "editorTitle"
  | "emptyChanges"
  | "errorKind"
  | "errorLine"
  | "errorMessage"
  | "errorTitle"
  | "event"
  | "eventLine"
  | "eventReturn"
  | "line"
  | "next"
  | "play"
  | "pause"
  | "previous"
  | "run"
  | "running"
  | "speed"
  | "step"
  | "teachingTitle"
  | "timeline"
  | "variablesTitle"
  | "visualizationTitle";

export const DEFAULT_LOCALE: Locale = "zh";

export const UI_TEXT: Readonly<Record<UiKey, LocalizedText>> = {
  appStatus: { zh: "状态", en: "Status" },
  changedVariables: { zh: "变量变化", en: "Variable Changes" },
  chars: { zh: "字符", en: "chars" },
  callDepth: { zh: "调用深度", en: "Call Depth" },
  currentLine: { zh: "当前行", en: "Current Line" },
  currentScope: { zh: "作用域", en: "Scope" },
  editorTitle: { zh: "Python 编辑器", en: "Python Editor" },
  emptyChanges: { zh: "本步没有变量变化", en: "No variable changes in this step" },
  errorKind: { zh: "类型", en: "Kind" },
  errorLine: { zh: "行号", en: "Line" },
  errorMessage: { zh: "消息", en: "Message" },
  errorTitle: { zh: "运行失败", en: "Run Failed" },
  event: { zh: "事件", en: "Event" },
  eventLine: { zh: "执行行", en: "line" },
  eventReturn: { zh: "返回", en: "return" },
  line: { zh: "行", en: "line" },
  next: { zh: "下一步", en: "Next" },
  pause: { zh: "暂停", en: "Pause" },
  play: { zh: "播放", en: "Play" },
  previous: { zh: "上一步", en: "Previous" },
  run: { zh: "运行并可视化", en: "Run and Visualize" },
  running: { zh: "运行中", en: "running" },
  speed: { zh: "速度", en: "Speed" },
  step: { zh: "步骤", en: "Step" },
  teachingTitle: { zh: "步骤讲解", en: "Step Guide" },
  timeline: { zh: "时间轴", en: "Timeline" },
  variablesTitle: { zh: "变量检查器", en: "Variable Inspector" },
  visualizationTitle: { zh: "变量可视化", en: "Variables" },
};

export function text(value: LocalizedText, locale: Locale): string {
  return value[locale];
}

export function ui(key: UiKey, locale: Locale): string {
  return UI_TEXT[key][locale];
}
