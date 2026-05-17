export type AlgorithmTemplate = {
  readonly id: string;
  readonly name: string;
  readonly source: string;
};

export const CUSTOM_TEMPLATE: AlgorithmTemplate = {
  id: "custom-code",
  name: "Custom Code",
  source: `# Write your own Python code here.
# The visualizer works best when you use names like items, i, j, left or right.
items = [3, 1, 4, 1, 5]
i = 0
total = 0

while i < len(items):
    total = total + items[i]
    i = i + 1`,
};

export const ALGORITHM_TEMPLATES: readonly AlgorithmTemplate[] = [
  CUSTOM_TEMPLATE,
  {
    id: "bubble-sort",
    name: "Bubble Sort",
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
  },
  {
    id: "binary-search",
    name: "Binary Search",
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
  },
  {
    id: "two-pointer-reverse",
    name: "Two-Pointer Reverse",
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
  },
];

export const DEFAULT_TEMPLATE = ALGORITHM_TEMPLATES[0];
