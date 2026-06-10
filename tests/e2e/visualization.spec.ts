import { expect, test } from "@playwright/test";

const SOURCE_LINES = [
  "# Write your own Python code here.",
  "# The visualizer works best when you use names like items, i, j, left or right.",
  "items = [3, 1, 4, 1, 5]",
  "i = 0",
  "total = 0",
  "",
  "while i < len(items):",
  "    total = total + items[i]",
  "    i = i + 1",
] as const;

const TRACE_RUN = {
  sourceLines: SOURCE_LINES.map((text, index) => ({ number: index + 1, text })),
  frames: [
    frame(0, 3, { items: [3, 1, 4, 1, 5] }),
    frame(1, 4, { items: [3, 1, 4, 1, 5], i: 0 }),
    frame(2, 5, { items: [3, 1, 4, 1, 5], i: 0, total: 0 }),
    frame(3, 8, { items: [3, 1, 4, 1, 5], i: 0, total: 3 }),
    frame(4, 9, { items: [3, 1, 4, 1, 5], i: 1, total: 3 }),
    {
      step: 5,
      event: "return",
      line: 9,
      lineText: SOURCE_LINES[8],
      scopeName: "<module>",
      callDepth: 0,
      locals: { items: [3, 1, 4, 1, 5], i: 1, total: 3 },
      returnValue: null,
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((traceRun) => {
    const tauriWindow = window as Window & {
      __TAURI_INTERNALS__: {
        invoke: (command: string) => Promise<unknown>;
      };
    };
    tauriWindow.__TAURI_INTERNALS__ = {
      invoke: async (command: string) => {
        if (command !== "trace_python_code") {
          throw new Error(`Unexpected command: ${command}`);
        }

        return traceRun;
      },
    };
  }, TRACE_RUN);
});

test("renders the teaching visualization and English locale", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "建立初始状态" })).toBeVisible();
  await expect(page.locator(".array-node")).toHaveCount(5);
  await expect(page.locator(".array-node").first()).toContainText("3");
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await expect(page.locator('.editor-shell[data-current-line="3"]')).toBeVisible();

  await nextStep(page);
  await nextStep(page);
  await nextStep(page);

  await expect(page.getByRole("heading", { name: "遍历并累加" })).toBeVisible();
  await expect(page.locator(".pointer-pill", { hasText: "i" })).toBeVisible();
  await expect(page.locator(".change-row", { hasText: "total" })).toContainText("3");
  await expect(page.locator(".trace-summary")).toContainText("执行第 8 行，更新 total");
  await expect(page.locator('.editor-shell[data-current-line="8"]')).toBeVisible();
  await expect(page.locator(".current-line-preview")).toContainText("total = total + items[i]");

  await page.getByRole("button", { name: "EN" }).click();

  await expect(page.getByRole("heading", { name: "Traverse and accumulate" })).toBeVisible();
  await expect(page.getByText("Variable Inspector")).toBeVisible();
  await expect(page.getByLabel("Next")).toBeVisible();
});

function frame(step: number, line: number, locals: Record<string, unknown>) {
  return {
    step,
    event: "line",
    line,
    lineText: SOURCE_LINES[line - 1],
    scopeName: "<module>",
    callDepth: 0,
    locals,
    returnValue: null,
  };
}

async function nextStep(page: import("@playwright/test").Page) {
  await page.locator(".transport-buttons button").nth(2).click();
}
