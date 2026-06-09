import type { LocalizedText } from "./types";

export type TeachingStage = {
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly focusVariables: readonly string[];
};

export type AlgorithmTemplate = {
  readonly id: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly source: string;
  readonly teaching: readonly TeachingStage[];
};

export const CUSTOM_TEMPLATE: AlgorithmTemplate = {
  id: "custom-code",
  name: { zh: "自定义代码", en: "Custom Code" },
  description: {
    zh: "用 items、i、j、left、right 这类变量名可以获得更清晰的指针可视化。",
    en: "Use names like items, i, j, left and right for clearer pointer visualization.",
  },
  source: `# Write your own Python code here.
# The visualizer works best when you use names like items, i, j, left or right.
items = [3, 1, 4, 1, 5]
i = 0
total = 0

while i < len(items):
    total = total + items[i]
    i = i + 1`,
  teaching: [
    {
      lineStart: 3,
      lineEnd: 5,
      title: { zh: "建立初始状态", en: "Set up state" },
      summary: {
        zh: "数组、指针和累计值被创建，后续步骤会围绕这些局部变量变化。",
        en: "The array, pointer and accumulator are created for the following steps.",
      },
      focusVariables: ["items", "i", "total"],
    },
    {
      lineStart: 7,
      lineEnd: 9,
      title: { zh: "遍历并累计", en: "Traverse and accumulate" },
      summary: {
        zh: "i 指向当前数组格子，total 累加当前值，然后 i 前进到下一格。",
        en: "i points at the current cell, total absorbs that value, then i advances.",
      },
      focusVariables: ["items", "i", "total"],
    },
  ],
};

export const ALGORITHM_TEMPLATES: readonly AlgorithmTemplate[] = [
  CUSTOM_TEMPLATE,
  {
    id: "bubble-sort",
    name: { zh: "冒泡排序", en: "Bubble Sort" },
    description: {
      zh: "相邻元素比较和交换，较大的值逐步移动到右侧。",
      en: "Adjacent values are compared and swapped so larger values drift right.",
    },
    source: `# Bubble sort keeps the largest unsorted value moving to the right.
# The variable names i, j and items are intentionally visualizer-friendly.
items = [5, 1, 4, 2, 8]
size = len(items)

for i in range(size):
    # Each pass shrinks the unsorted suffix by one slot.
    for j in range(0, size - i - 1):
        # j points at the left item in the adjacent pair being compared.
        if items[j] > items[j + 1]:
            items[j], items[j + 1] = items[j + 1], items[j]

sorted_items = items`,
    teaching: [
      {
        lineStart: 3,
        lineEnd: 4,
        title: { zh: "准备待排序数组", en: "Prepare the array" },
        summary: {
          zh: "items 是要排序的数组，size 记录边界，后续循环不会改变数组长度。",
          en: "items is the sortable array and size fixes the loop boundary.",
        },
        focusVariables: ["items", "size"],
      },
      {
        lineStart: 6,
        lineEnd: 8,
        title: { zh: "定位相邻比较窗口", en: "Find the adjacent pair" },
        summary: {
          zh: "i 表示第几轮冒泡，j 指向当前相邻比较对的左侧元素。",
          en: "i marks the pass, while j points to the left value in the pair.",
        },
        focusVariables: ["i", "j", "items"],
      },
      {
        lineStart: 10,
        lineEnd: 11,
        title: { zh: "比较并交换", en: "Compare and swap" },
        summary: {
          zh: "如果左侧值更大，就交换两个格子，让较大值继续向右移动。",
          en: "When the left value is larger, the pair swaps and the larger value moves right.",
        },
        focusVariables: ["items", "j"],
      },
      {
        lineStart: 13,
        lineEnd: 13,
        title: { zh: "保存结果", en: "Store the result" },
        summary: {
          zh: "排序完成后，sorted_items 引用最终数组。",
          en: "After the passes finish, sorted_items points to the final array.",
        },
        focusVariables: ["items", "sorted_items"],
      },
    ],
  },
  {
    id: "binary-search",
    name: { zh: "二分查找", en: "Binary Search" },
    description: {
      zh: "通过 left、right 和 mid 不断缩小有序数组搜索范围。",
      en: "left, right and mid shrink the search range in a sorted array.",
    },
    source: `# Binary search narrows a sorted array using left, right and mid pointers.
# Pointer names match the visualizer's edge mapping rules.
items = [1, 3, 5, 7, 9, 11]
target = 7
left = 0
right = len(items) - 1
found_index = -1

while left <= right:
    mid = (left + right) // 2
    current = items[mid]

    if current == target:
        found_index = mid
        break
    if current < target:
        left = mid + 1
    else:
        right = mid - 1`,
    teaching: [
      {
        lineStart: 3,
        lineEnd: 7,
        title: { zh: "建立搜索区间", en: "Set the search range" },
        summary: {
          zh: "left 和 right 包围当前可能包含 target 的区间。",
          en: "left and right bound the range that may contain the target.",
        },
        focusVariables: ["items", "target", "left", "right"],
      },
      {
        lineStart: 9,
        lineEnd: 11,
        title: { zh: "检查中点", en: "Check the midpoint" },
        summary: {
          zh: "mid 取当前区间中点，current 是中点位置的值。",
          en: "mid selects the center of the active range and current reads that value.",
        },
        focusVariables: ["left", "right", "mid", "current"],
      },
      {
        lineStart: 13,
        lineEnd: 15,
        title: { zh: "找到目标", en: "Target found" },
        summary: {
          zh: "如果 current 等于 target，记录索引并结束循环。",
          en: "If current equals target, the index is stored and the loop stops.",
        },
        focusVariables: ["current", "target", "found_index"],
      },
      {
        lineStart: 16,
        lineEnd: 19,
        title: { zh: "缩小区间", en: "Shrink the range" },
        summary: {
          zh: "根据 current 与 target 的大小关系移动 left 或 right。",
          en: "left or right moves depending on how current compares with target.",
        },
        focusVariables: ["left", "right", "current", "target"],
      },
    ],
  },
  {
    id: "two-pointer-reverse",
    name: { zh: "双指针反转", en: "Two-Pointer Reverse" },
    description: {
      zh: "left 和 right 从两端向中间移动，逐步交换数组元素。",
      en: "left and right move inward and swap array cells along the way.",
    },
    source: `# Reverse an array in place with two pointers moving toward the center.
# left and right are rendered as pointer labels connected to array cells.
items = [10, 20, 30, 40, 50]
left = 0
right = len(items) - 1

while left < right:
    # Swap the values currently selected by the two pointers.
    items[left], items[right] = items[right], items[left]
    left = left + 1
    right = right - 1

reversed_items = items`,
    teaching: [
      {
        lineStart: 3,
        lineEnd: 5,
        title: { zh: "放置双指针", en: "Place two pointers" },
        summary: {
          zh: "left 指向最左侧，right 指向最右侧，两个指针会向中间靠拢。",
          en: "left starts at the first cell and right starts at the last cell.",
        },
        focusVariables: ["items", "left", "right"],
      },
      {
        lineStart: 7,
        lineEnd: 9,
        title: { zh: "交换两端元素", en: "Swap the selected cells" },
        summary: {
          zh: "当 left 仍在 right 左侧时，交换两个指针选中的数组格子。",
          en: "While left is before right, the selected cells are swapped.",
        },
        focusVariables: ["items", "left", "right"],
      },
      {
        lineStart: 10,
        lineEnd: 11,
        title: { zh: "指针向中心移动", en: "Move inward" },
        summary: {
          zh: "交换后 left 右移，right 左移，准备处理下一对元素。",
          en: "After each swap, left moves right and right moves left.",
        },
        focusVariables: ["left", "right"],
      },
      {
        lineStart: 13,
        lineEnd: 13,
        title: { zh: "记录反转结果", en: "Store the reversed result" },
        summary: {
          zh: "循环结束后，reversed_items 引用已经原地反转的数组。",
          en: "When the loop finishes, reversed_items points to the in-place result.",
        },
        focusVariables: ["items", "reversed_items"],
      },
    ],
  },
];

export const DEFAULT_TEMPLATE = ALGORITHM_TEMPLATES[0];
