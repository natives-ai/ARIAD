import type { StoryNode, StoryNodeLevel } from "@scenaairo/shared";

const nodeLevelOrder: StoryNodeLevel[] = ["major", "minor", "detail"];

export function getParentLevel(level: StoryNodeLevel): StoryNodeLevel | null {
  const index = nodeLevelOrder.indexOf(level);

  if (index <= 0) {
    return null;
  }

  return nodeLevelOrder[index - 1] ?? null;
}

export function sortNodesByOrder(nodes: StoryNode[]) {
  return [...nodes].sort(
    (left, right) =>
      left.orderIndex - right.orderIndex ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
  );
}

export function normalizeNodeOrder(nodes: StoryNode[]) {
  return nodes.map((node, index) => ({
    ...node,
    orderIndex: index + 1
  }));
}

export function collectDescendantIds(nodes: StoryNode[], rootId: string) {
  const childrenByParent = new Map<string, string[]>();

  for (const node of nodes) {
    if (node.parentId === null) {
      continue;
    }

    childrenByParent.set(node.parentId, [
      ...(childrenByParent.get(node.parentId) ?? []),
      node.id
    ]);
  }

  const visited = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    for (const childId of childrenByParent.get(currentId) ?? []) {
      queue.push(childId);
    }
  }

  return visited;
}

export function collectSubtreeNodes(nodes: StoryNode[], rootId: string) {
  const descendantIds = collectDescendantIds(nodes, rootId);

  return sortNodesByOrder(nodes).filter((node) => descendantIds.has(node.id));
}

export function inferParentId(
  nodes: StoryNode[],
  level: StoryNodeLevel,
  insertIndex: number,
  excludedIds: Set<string> = new Set()
) {
  const parentLevel = getParentLevel(level);

  if (!parentLevel) {
    return null;
  }

  const ordered = sortNodesByOrder(nodes);

  for (let offset = 0; offset <= ordered.length; offset += 1) {
    const leftIndex = insertIndex - 1 - offset;

    if (leftIndex >= 0) {
      const candidate = ordered[leftIndex];

      if (candidate && candidate.level === parentLevel && !excludedIds.has(candidate.id)) {
        return candidate.id;
      }
    }

    const rightIndex = insertIndex + offset;

    if (rightIndex < ordered.length) {
      const candidate = ordered[rightIndex];

      if (candidate && candidate.level === parentLevel && !excludedIds.has(candidate.id)) {
        return candidate.id;
      }
    }
  }

  return null;
}

export function isDescendant(
  nodes: StoryNode[],
  ancestorId: string,
  possibleDescendantId: string
) {
  return collectDescendantIds(nodes, ancestorId).has(possibleDescendantId);
}

export function clampInsertIndex(value: number, max: number) {
  return Math.min(Math.max(value, 0), max);
}
