// 이 파일은 노드 순서 정규화와 트리 정합성 검증을 담당합니다.
import type {
  StoryEpisode,
  StoryNode,
  StoryNodeLevel,
  StoryWorkspaceSnapshot
} from "@scenaairo/shared";

const nodeLevelOrder: StoryNodeLevel[] = ["major", "minor", "detail"];

// 자식 레벨에 대응하는 기대 부모 레벨을 반환합니다.
export function getExpectedParentLevel(level: StoryNodeLevel): StoryNodeLevel | null {
  const index = nodeLevelOrder.indexOf(level);

  if (index <= 0) {
    return null;
  }

  return nodeLevelOrder[index - 1] ?? null;
}

// 정렬에 사용할 안전한 순서 인덱스 값을 계산합니다.
function getSafeOrderIndex(orderIndex: number): number {
  if (!Number.isFinite(orderIndex)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const normalized = Math.trunc(orderIndex);

  if (normalized < 1) {
    return Number.MAX_SAFE_INTEGER;
  }

  return normalized;
}

// 노드 배열을 canonical order 기준으로 정렬합니다.
export function sortNodesByCanonicalOrder(nodes: StoryNode[]): StoryNode[] {
  return [...nodes].sort(
    (left, right) =>
      getSafeOrderIndex(left.orderIndex) - getSafeOrderIndex(right.orderIndex) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
  );
}

// 에피소드 단위로 노드 순서를 1부터 연속 인덱스로 정규화합니다.
export function canonicalizeNodeOrderByEpisode(
  nodes: StoryNode[],
  episodes: StoryEpisode[]
): StoryNode[] {
  const nodesByEpisode = new Map<string, StoryNode[]>();

  for (const node of nodes) {
    nodesByEpisode.set(node.episodeId, [
      ...(nodesByEpisode.get(node.episodeId) ?? []),
      node
    ]);
  }

  const episodeOrder = episodes.map((episode) => episode.id);
  const knownEpisodeIds = new Set(episodeOrder);

  for (const node of nodes) {
    if (knownEpisodeIds.has(node.episodeId)) {
      continue;
    }

    knownEpisodeIds.add(node.episodeId);
    episodeOrder.push(node.episodeId);
  }

  const normalizedNodes: StoryNode[] = [];

  for (const episodeId of episodeOrder) {
    const episodeNodes = nodesByEpisode.get(episodeId);

    if (!episodeNodes) {
      continue;
    }

    const orderedNodes = sortNodesByCanonicalOrder(episodeNodes);
    normalizedNodes.push(
      ...orderedNodes.map((node, index) => ({
        ...node,
        orderIndex: index + 1
      }))
    );
  }

  return normalizedNodes;
}

// 두 노드 payload가 동일 상태인지 비교합니다.
function hasSameNodeState(left: StoryNode, right: StoryNode): boolean {
  if (
    left.id !== right.id ||
    left.projectId !== right.projectId ||
    left.episodeId !== right.episodeId ||
    left.parentId !== right.parentId ||
    left.level !== right.level ||
    left.contentMode !== right.contentMode ||
    left.text !== right.text ||
    left.orderIndex !== right.orderIndex ||
    left.createdAt !== right.createdAt ||
    left.updatedAt !== right.updatedAt ||
    (left.isCollapsed ?? null) !== (right.isCollapsed ?? null) ||
    (left.isImportant ?? null) !== (right.isImportant ?? null) ||
    (left.isFixed ?? null) !== (right.isFixed ?? null) ||
    (left.canvasX ?? null) !== (right.canvasX ?? null) ||
    (left.canvasY ?? null) !== (right.canvasY ?? null) ||
    (left.canvasWidth ?? null) !== (right.canvasWidth ?? null) ||
    (left.canvasHeight ?? null) !== (right.canvasHeight ?? null) ||
    left.keywords.length !== right.keywords.length ||
    left.objectIds.length !== right.objectIds.length
  ) {
    return false;
  }

  for (let index = 0; index < left.keywords.length; index += 1) {
    if (left.keywords[index] !== right.keywords[index]) {
      return false;
    }
  }

  for (let index = 0; index < left.objectIds.length; index += 1) {
    if (left.objectIds[index] !== right.objectIds[index]) {
      return false;
    }
  }

  return true;
}

// 기존 노드보다 오래된 갱신 요청인지 확인합니다.
export function assertFreshNodeRevision(
  previousNode: StoryNode | undefined,
  nextNode: StoryNode
) {
  if (!previousNode) {
    return;
  }

  if (hasSameNodeState(previousNode, nextNode)) {
    return;
  }

  if (nextNode.updatedAt.localeCompare(previousNode.updatedAt) <= 0) {
    throw new Error("stale_node_revision");
  }
}

// 노드 그래프의 순환 참조를 검증합니다.
function assertNoNodeCycle(nodes: StoryNode[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) {
      return;
    }

    if (visiting.has(nodeId)) {
      throw new Error("invalid_node_cycle");
    }

    visiting.add(nodeId);
    const parentId = nodesById.get(nodeId)?.parentId ?? null;

    if (parentId && nodesById.has(parentId)) {
      visit(parentId);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const node of nodes) {
    visit(node.id);
  }
}

// 스냅샷 노드 트리의 프로젝트/에피소드/부모 정합성을 검증합니다.
export function validateNodeGraphIntegrity(snapshot: StoryWorkspaceSnapshot) {
  const episodeIds = new Set(snapshot.episodes.map((episode) => episode.id));
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));

  if (nodesById.size !== snapshot.nodes.length) {
    throw new Error("duplicate_node_id");
  }

  for (const node of snapshot.nodes) {
    if (node.projectId !== snapshot.project.id) {
      throw new Error("node_project_mismatch");
    }

    if (!episodeIds.has(node.episodeId)) {
      throw new Error("missing_episode_dependency");
    }

    if (node.parentId === null) {
      continue;
    }

    if (node.parentId === node.id) {
      throw new Error("invalid_parent_node_dependency");
    }

    const parentNode = nodesById.get(node.parentId);

    if (!parentNode) {
      throw new Error("missing_parent_node_dependency");
    }

    if (parentNode.projectId !== node.projectId) {
      throw new Error("parent_project_mismatch");
    }

    if (parentNode.episodeId !== node.episodeId) {
      throw new Error("parent_episode_mismatch");
    }

    const expectedParentLevel = getExpectedParentLevel(node.level);

    if (!expectedParentLevel || parentNode.level !== expectedParentLevel) {
      throw new Error("invalid_parent_level");
    }
  }

  assertNoNodeCycle(snapshot.nodes);
}

