import { describe, expect, it } from "vitest";

import { UI_TEXT } from "./i18n";
import { ALGORITHM_TEMPLATES, CUSTOM_TEMPLATE } from "./templates";
import { teachingNoteForStep } from "./teaching";

describe("teachingNoteForStep", () => {
  it("uses localized template stages for matching lines", () => {
    const note = teachingNoteForStep({
      template: CUSTOM_TEMPLATE,
      frame: { step: 3, line: 8, scopeName: "<module>", callDepth: 0, locals: {} },
      changes: [],
      locale: "zh",
    });

    expect(note.title).toBe("遍历并累计");
    expect(note.focusVariables).toEqual(["items", "i", "total"]);
  });

  it("falls back to variable changes for unmatched custom lines", () => {
    const note = teachingNoteForStep({
      template: CUSTOM_TEMPLATE,
      frame: { step: 0, line: 99, scopeName: "<module>", callDepth: 0, locals: {} },
      changes: [{ name: "answer", before: undefined, after: 3, status: "added" }],
      locale: "en",
    });

    expect(note.summary).toBe("This frame updates answer.");
  });
});

describe("localized content", () => {
  it("keeps UI strings available in both supported locales", () => {
    for (const value of Object.values(UI_TEXT)) {
      expect(value.zh.length).toBeGreaterThan(0);
      expect(value.en.length).toBeGreaterThan(0);
    }
  });

  it("keeps template names and descriptions bilingual", () => {
    for (const template of ALGORITHM_TEMPLATES) {
      expect(template.name.zh).toBeTruthy();
      expect(template.name.en).toBeTruthy();
      expect(template.description.zh).toBeTruthy();
      expect(template.description.en).toBeTruthy();
    }
  });
});
