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

const CUSTOM_SOURCE = `# Write your own Python code here.
# The visualizer works best when you use names like items, i, j, left or right.
items = [3, 1, 4, 1, 5]
i = 0
total = 0

while i < len(items):
    total = total + items[i]
    i = i + 1`;

const BUBBLE_SORT_SOURCE = `# Bubble sort keeps the largest unsorted value moving to the right.
# The variable names i, j and items are intentionally visualizer-friendly.
items = [5, 1, 4, 2, 8]
size = len(items)

for i in range(size):
    # Each pass shrinks the unsorted suffix by one slot.
    for j in range(0, size - i - 1):
        # j points at the left item in the adjacent pair being compared.
        if items[j] > items[j + 1]:
            items[j], items[j + 1] = items[j + 1], items[j]

sorted_items = items`;

const BINARY_SEARCH_SOURCE = `# Binary search narrows a sorted array using left, right and mid pointers.
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
        right = mid - 1`;

const TWO_POINTER_REVERSE_SOURCE = `# Reverse an array in place with two pointers moving toward the center.
# left and right are rendered as pointer labels connected to array cells.
items = [10, 20, 30, 40, 50]
left = 0
right = len(items) - 1

while left < right:
    # Swap the values currently selected by the two pointers.
    items[left], items[right] = items[right], items[left]
    left = left + 1
    right = right - 1

reversed_items = items`;

export const CUSTOM_TEMPLATE: AlgorithmTemplate = template({
  id: "custom-code",
  name: localized("自定义代码", "Custom Code"),
  description: localized(
    "使用 items、i、j、left、right 这类变量名可以获得更清晰的指针可视化。",
    "Use names like items, i, j, left and right for clearer pointer visualization.",
  ),
  source: CUSTOM_SOURCE,
  teaching: [
    stage({
      lineStart: 3,
      lineEnd: 5,
      title: localized("建立初始状态", "Set up state"),
      summary: localized(
        "数组、指针和累计值被创建，后续步骤会围绕这些局部变量变化。",
        "The array, pointer and accumulator are created for the following steps.",
      ),
      focusVariables: ["items", "i", "total"],
    }),
    stage({
      lineStart: 7,
      lineEnd: 9,
      title: localized("遍历并累加", "Traverse and accumulate"),
      summary: localized(
        "i 指向当前数组格子，total 累加当前值，然后 i 前进到下一个格子。",
        "i points at the current cell, total absorbs that value, then i advances.",
      ),
      focusVariables: ["items", "i", "total"],
    }),
  ],
});

export const ALGORITHM_TEMPLATES: readonly AlgorithmTemplate[] = [
  CUSTOM_TEMPLATE,
  template({
    id: "bubble-sort",
    name: localized("冒泡排序", "Bubble Sort"),
    description: localized(
      "相邻元素比较和交换，较大的值会逐步移动到右侧。",
      "Adjacent values are compared and swapped so larger values drift right.",
    ),
    source: BUBBLE_SORT_SOURCE,
    teaching: [
      stage({
        lineStart: 3,
        lineEnd: 4,
        title: localized("准备待排序数组", "Prepare the array"),
        summary: localized(
          "items 是要排序的数组，size 记录边界，后续循环不会改变数组长度。",
          "items is the sortable array and size fixes the loop boundary.",
        ),
        focusVariables: ["items", "size"],
      }),
      stage({
        lineStart: 6,
        lineEnd: 8,
        title: localized("定位相邻比较窗口", "Find the adjacent pair"),
        summary: localized(
          "i 表示第几轮冒泡，j 指向当前相邻比较对的左侧元素。",
          "i marks the pass, while j points to the left value in the pair.",
        ),
        focusVariables: ["i", "j", "items"],
      }),
      stage({
        lineStart: 10,
        lineEnd: 11,
        title: localized("比较并交换", "Compare and swap"),
        summary: localized(
          "如果左侧值更大，就交换两个格子，让较大的值继续向右移动。",
          "When the left value is larger, the pair swaps and the larger value moves right.",
        ),
        focusVariables: ["items", "j"],
      }),
      stage({
        lineStart: 13,
        lineEnd: 13,
        title: localized("保存结果", "Store the result"),
        summary: localized(
          "排序完成后，sorted_items 引用最终数组。",
          "After the passes finish, sorted_items points to the final array.",
        ),
        focusVariables: ["items", "sorted_items"],
      }),
    ],
  }),
  template({
    id: "binary-search",
    name: localized("二分查找", "Binary Search"),
    description: localized(
      "通过 left、right 和 mid 不断缩小有序数组的搜索范围。",
      "left, right and mid shrink the search range in a sorted array.",
    ),
    source: BINARY_SEARCH_SOURCE,
    teaching: [
      stage({
        lineStart: 3,
        lineEnd: 7,
        title: localized("建立搜索区间", "Set the search range"),
        summary: localized(
          "left 和 right 包围当前可能包含 target 的区间。",
          "left and right bound the range that may contain the target.",
        ),
        focusVariables: ["items", "target", "left", "right"],
      }),
      stage({
        lineStart: 9,
        lineEnd: 11,
        title: localized("检查中点", "Check the midpoint"),
        summary: localized(
          "mid 取当前区间中点，current 是中点位置的值。",
          "mid selects the center of the active range and current reads that value.",
        ),
        focusVariables: ["left", "right", "mid", "current"],
      }),
      stage({
        lineStart: 13,
        lineEnd: 15,
        title: localized("找到目标", "Target found"),
        summary: localized(
          "如果 current 等于 target，就记录索引并结束循环。",
          "If current equals target, the index is stored and the loop stops.",
        ),
        focusVariables: ["current", "target", "found_index"],
      }),
      stage({
        lineStart: 16,
        lineEnd: 19,
        title: localized("缩小区间", "Shrink the range"),
        summary: localized(
          "根据 current 和 target 的大小关系移动 left 或 right。",
          "left or right moves depending on how current compares with target.",
        ),
        focusVariables: ["left", "right", "current", "target"],
      }),
    ],
  }),
  template({
    id: "two-pointer-reverse",
    name: localized("双指针反转", "Two-Pointer Reverse"),
    description: localized(
      "left 和 right 从两端向中间移动，逐步交换数组元素。",
      "left and right move inward and swap array cells along the way.",
    ),
    source: TWO_POINTER_REVERSE_SOURCE,
    teaching: [
      stage({
        lineStart: 3,
        lineEnd: 5,
        title: localized("放置双指针", "Place two pointers"),
        summary: localized(
          "left 指向最左侧，right 指向最右侧，两个指针会向中间靠拢。",
          "left starts at the first cell and right starts at the last cell.",
        ),
        focusVariables: ["items", "left", "right"],
      }),
      stage({
        lineStart: 7,
        lineEnd: 9,
        title: localized("交换两端元素", "Swap the selected cells"),
        summary: localized(
          "当 left 仍在 right 左侧时，交换两个指针选中的数组格子。",
          "While left is before right, the selected cells are swapped.",
        ),
        focusVariables: ["items", "left", "right"],
      }),
      stage({
        lineStart: 10,
        lineEnd: 11,
        title: localized("指针向中心移动", "Move inward"),
        summary: localized(
          "交换后 left 右移，right 左移，准备处理下一对元素。",
          "After each swap, left moves right and right moves left.",
        ),
        focusVariables: ["left", "right"],
      }),
      stage({
        lineStart: 13,
        lineEnd: 13,
        title: localized("记录反转结果", "Store the reversed result"),
        summary: localized(
          "循环结束后，reversed_items 引用已经原地反转的数组。",
          "When the loop finishes, reversed_items points to the in-place result.",
        ),
        focusVariables: ["items", "reversed_items"],
      }),
    ],
  }),
];

export const DEFAULT_TEMPLATE = ALGORITHM_TEMPLATES[0];

function localized(zh: string, en: string): LocalizedText {
  return { zh, en };
}

function stage(value: TeachingStage): TeachingStage {
  return value;
}

function template(value: AlgorithmTemplate): AlgorithmTemplate {
  return value;
}
