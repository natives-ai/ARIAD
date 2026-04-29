// 이 파일은 워크스페이스 스냅샷을 추천 API 요청으로 변환합니다.
import type {
  KeywordRecommendationRequest,
  RecommendationLanguage,
  RecommendationNodeContext,
  RankedRecommendationContextItem,
  RankedRecommendationContextRole,
  SentenceRecommendationRequest
} from "@scenaairo/recommendation";
import type { StoryNode, StoryWorkspaceSnapshot } from "@scenaairo/shared";

import { getNodeHeadline } from "../persistence/drawerPayload";

// 문자열 배열을 trim/중복 제거하여 정리합니다.
function cleanList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

// 인라인 객체/포맷팅 마커를 추천용 일반 텍스트로 정리합니다.
function stripInlineFormattingMarkers(value: string) {
  return value
    .replace(/\u2063([^\u2064\n]+?)\u2064/g, "$1")
    .replace(/\u2065([^\u2066\n]+?)\u2066/g, "$1")
    .replace(/@([^@\n]+?)@/g, "$1");
}

// 노드에 연결된 객체 요약을 legacy story anchor로 변환합니다.
function getObjectAnchors(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode
) {
  return snapshot.objects
    .filter((object) => node.objectIds.includes(object.id))
    .map((object) => `${object.name}: ${object.summary}`);
}

// 노드의 시각적 Y 위치를 반환하고 없으면 순서를 사용합니다.
function getNodeCanvasY(node: StoryNode) {
  return typeof node.canvasY === "number" ? node.canvasY : node.orderIndex;
}

// 추천 컨텍스트 우선순위 점수를 0~1 범위로 제한합니다.
function clampPriorityScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

// 컨텍스트 텍스트를 공백 정리 후 최대 길이로 줄입니다.
function trimContextText(value: string, maxLength: number) {
  const text = stripInlineFormattingMarkers(value).replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

// 현재 노드 텍스트에서 추천 출력 언어를 간단히 감지합니다.
function detectRecommendationLanguage(value: string): RecommendationLanguage {
  if (/[\u3040-\u30ff]/.test(value)) {
    return "ja";
  }

  if (/[\uac00-\ud7af]/.test(value)) {
    return "ko";
  }

  return "en";
}

// StoryNode를 structured context의 노드 항목으로 변환합니다.
function createNodeContext(
  node: StoryNode,
  role: RecommendationNodeContext["role"]
): RecommendationNodeContext {
  const context: RecommendationNodeContext = {
    id: node.id,
    keywords: node.keywords,
    level: node.level,
    orderIndex: node.orderIndex,
    role,
    text: stripInlineFormattingMarkers(node.text)
  };

  if (typeof node.canvasY === "number") {
    context.canvasY = node.canvasY;
  }

  return context;
}

// 노드를 priority 기반 ranked context 항목으로 변환합니다.
function createRankedNodeItem(
  node: StoryNode,
  role: RankedRecommendationContextRole,
  priorityScore: number,
  referenceCanvasY: number,
  textLimit: number
): RankedRecommendationContextItem {
  const canvasY = getNodeCanvasY(node);

  return {
    canvasY,
    distance: Math.abs(canvasY - referenceCanvasY),
    id: `${role}:${node.id}`,
    keywords: cleanList(node.keywords).slice(0, 8),
    level: node.level,
    objectIds: node.objectIds,
    orderIndex: node.orderIndex,
    priorityScore: clampPriorityScore(priorityScore),
    role,
    source: role === "major-flow" ? "flow" : "node",
    text:
      role === "current"
        ? stripInlineFormattingMarkers(node.text)
        : trimContextText(node.text, textLimit)
  };
}

// ranked context 항목을 우선순위와 거리 기준으로 정렬합니다.
function sortRankedContextItems(
  left: RankedRecommendationContextItem,
  right: RankedRecommendationContextItem
) {
  return (
    right.priorityScore - left.priorityScore ||
    (left.distance ?? Number.MAX_SAFE_INTEGER) - (right.distance ?? Number.MAX_SAFE_INTEGER) ||
    (left.canvasY ?? Number.MAX_SAFE_INTEGER) - (right.canvasY ?? Number.MAX_SAFE_INTEGER) ||
    (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.orderIndex ?? Number.MAX_SAFE_INTEGER) ||
    left.id.localeCompare(right.id)
  );
}

// 중요도와 텍스트 예산 기준으로 추천 컨텍스트를 압축합니다.
function compressRankedContextItems(items: RankedRecommendationContextItem[]) {
  const compressedItems: RankedRecommendationContextItem[] = [];
  const maxTextBudget = 2800;
  const maxItemCount = 28;
  let usedTextBudget = 0;

  for (const item of [...items].sort(sortRankedContextItems)) {
    const textCost = item.text.length + item.keywords.join(" ").length;
    const isRequired = item.role === "current";

    if (
      !isRequired &&
      (compressedItems.length >= maxItemCount || usedTextBudget + textCost > maxTextBudget)
    ) {
      continue;
    }

    compressedItems.push(item);
    usedTextBudget += textCost;
  }

  return compressedItems;
}

// 노드를 캔버스 Y 위치 기준으로 정렬합니다.
function sortNodesByCanvasY(left: StoryNode, right: StoryNode) {
  return (
    getNodeCanvasY(left) - getNodeCanvasY(right) ||
    left.orderIndex - right.orderIndex ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

// 현재 노드 주변의 priority 기반 추천 컨텍스트 항목을 생성합니다.
function buildRankedRecommendationContextItems(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode,
  parentNode: StoryNode | null,
  episodeNodes: StoryNode[],
  majorNodes: StoryNode[],
  activeEpisode: StoryWorkspaceSnapshot["episodes"][number] | undefined
) {
  const currentCanvasY = getNodeCanvasY(node);
  const currentText = stripInlineFormattingMarkers(node.text).trim();
  const emptyCurrentBoost = currentText ? 0 : 0.08;
  const rankedItems: RankedRecommendationContextItem[] = [
    createRankedNodeItem(node, "current", 1, currentCanvasY, Number.MAX_SAFE_INTEGER)
  ];

  for (const object of snapshot.objects.filter((entry) => node.objectIds.includes(entry.id))) {
    rankedItems.push({
      id: `attached-object:${object.id}`,
      keywords: cleanList([object.name]),
      objectIds: [object.id],
      priorityScore: 0.9,
      role: "attached-object",
      source: "object",
      text: trimContextText(`${object.name}: ${object.summary}`, 220)
    });
  }

  if (parentNode) {
    rankedItems.push(
      createRankedNodeItem(
        parentNode,
        "parent",
        0.88 + emptyCurrentBoost,
        currentCanvasY,
        180
      )
    );
  }

  rankedItems.push(
    ...episodeNodes
      .filter((entry) => entry.parentId === node.id)
      .sort(sortNodesByCanvasY)
      .slice(0, 8)
      .map((childNode) =>
        createRankedNodeItem(
          childNode,
          "child",
          0.78 + emptyCurrentBoost / 2,
          currentCanvasY,
          160
        )
      )
  );

  const sameLaneNodes = episodeNodes
    .filter((entry) => entry.id !== node.id && entry.level === node.level)
    .sort(sortNodesByCanvasY);
  const sameLaneBefore = sameLaneNodes
    .filter((entry) => getNodeCanvasY(entry) <= currentCanvasY)
    .at(-1);
  const sameLaneAfter = sameLaneNodes.find((entry) => getNodeCanvasY(entry) > currentCanvasY);

  if (sameLaneBefore) {
    rankedItems.push(
      createRankedNodeItem(sameLaneBefore, "same-lane-before", 0.72, currentCanvasY, 150)
    );
  }

  if (sameLaneAfter) {
    rankedItems.push(
      createRankedNodeItem(sameLaneAfter, "same-lane-after", 0.72, currentCanvasY, 150)
    );
  }

  const nearestMajorIds = new Set(
    majorNodes
      .map((majorNode, index) => ({
        canvasDistance: Math.abs(getNodeCanvasY(majorNode) - currentCanvasY),
        id: majorNode.id,
        index
      }))
      .sort(
        (left, right) =>
          left.canvasDistance - right.canvasDistance || left.index - right.index
      )
      .slice(0, 4)
      .map((entry) => entry.id)
  );

  rankedItems.push(
    ...majorNodes
      .filter((entry) => entry.id !== node.id)
      .map((majorNode) =>
        createRankedNodeItem(
          majorNode,
          "major-flow",
          nearestMajorIds.has(majorNode.id) ? 0.68 : 0.45,
          currentCanvasY,
          130
        )
      )
  );

  if (activeEpisode?.endpoint) {
    rankedItems.push({
      id: `episode-endpoint:${activeEpisode.id}`,
      keywords: [],
      priorityScore: clampPriorityScore(0.62 + emptyCurrentBoost),
      role: "episode-endpoint",
      source: "episode",
      text: trimContextText(activeEpisode.endpoint, 240)
    });
  }

  if (activeEpisode?.objective) {
    rankedItems.push({
      id: `episode-objective:${activeEpisode.id}`,
      keywords: [],
      priorityScore: clampPriorityScore(0.58 + emptyCurrentBoost),
      role: "episode-objective",
      source: "episode",
      text: trimContextText(activeEpisode.objective, 240)
    });
  }

  return compressRankedContextItems(rankedItems);
}

// 추천 요청에 넣을 structured context 전체를 조립합니다.
function createStructuredRecommendationContext(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode,
  parentNode: StoryNode | null,
  selectedKeywords: string[],
  maxSuggestions: number
) {
  const activeEpisode =
    snapshot.episodes.find((episode) => episode.id === node.episodeId) ??
    snapshot.episodes[0];
  const episodeNodes = snapshot.nodes.filter((entry) => entry.episodeId === node.episodeId);
  const majorNodes = episodeNodes
    .filter((entry) => entry.level === "major")
    .sort(sortNodesByCanvasY);
  const directConnections: RecommendationNodeContext[] = [];

  if (parentNode) {
    directConnections.push(createNodeContext(parentNode, "parent"));
  }

  directConnections.push(
    ...episodeNodes
      .filter((entry) => entry.parentId === node.id)
      .sort(sortNodesByCanvasY)
      .slice(0, 8)
      .map((entry) => createNodeContext(entry, "child"))
  );

  if (node.level === "major") {
    const currentMajorIndex = majorNodes.findIndex((entry) => entry.id === node.id);
    const neighborNodes = [
      currentMajorIndex > 0 ? majorNodes[currentMajorIndex - 1] : null,
      currentMajorIndex >= 0 ? majorNodes[currentMajorIndex + 1] : null
    ].filter((entry): entry is StoryNode => entry !== null && entry !== undefined);

    for (const neighborNode of neighborNodes) {
      if (!directConnections.some((entry) => entry.id === neighborNode.id)) {
        directConnections.push(createNodeContext(neighborNode, "major-lane-neighbor"));
      }
    }
  }

  return {
    currentNode: createNodeContext(node, "current"),
    directConnections,
    episodeContext: {
      endpoint: activeEpisode?.endpoint ?? "",
      objective: activeEpisode?.objective ?? "",
      title: activeEpisode?.title ?? snapshot.project.title
    },
    language: detectRecommendationLanguage(stripInlineFormattingMarkers(node.text)),
    majorLaneFlow: majorNodes.slice(0, 24).map((entry) => ({
      canvasY: getNodeCanvasY(entry),
      id: entry.id,
      keywords: entry.keywords,
      text: stripInlineFormattingMarkers(entry.text)
    })),
    maxSuggestions,
    nodeLevel: node.level,
    objectContext: snapshot.objects
      .filter((object) => node.objectIds.includes(object.id))
      .slice(0, 8)
      .map((object) => ({
        category: object.category,
        id: object.id,
        name: object.name,
        summary: object.summary
      })),
    rankedItems: buildRankedRecommendationContextItems(
      snapshot,
      node,
      parentNode,
      episodeNodes,
      majorNodes,
      activeEpisode
    ),
    selectedKeywords: cleanList(selectedKeywords)
  };
}

// 기존 API 호환용 flat story snapshot을 생성합니다.
function createStorySnapshot(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode,
  parentNode: StoryNode | null
) {
  const activeEpisode =
    snapshot.episodes.find((episode) => episode.id === node.episodeId) ??
    snapshot.episodes[0];

  return {
    episodeEndpoint: activeEpisode?.endpoint ?? "",
    episodeObjective: activeEpisode?.objective ?? "",
    existingKeywords: node.keywords,
    lockedFacts: cleanList([
      snapshot.project.summary,
      activeEpisode?.endpoint ?? "",
      parentNode ? getNodeHeadline(parentNode) : "",
      ...getObjectAnchors(snapshot, node)
    ]),
    nodeLevel: node.level,
    nodeText: stripInlineFormattingMarkers(node.text),
    objectAnchors: getObjectAnchors(snapshot, node),
    parentSummary: parentNode ? getNodeHeadline(parentNode) : null,
    projectSummary: snapshot.project.summary,
    projectTitle: snapshot.project.title
  };
}

// 키워드 추천 요청 payload를 생성합니다.
export function createKeywordRecommendationRequest(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode,
  parentNode: StoryNode | null,
  options: {
    cacheBypass?: boolean;
    maxSuggestions?: number;
    selectedKeywords?: string[];
  } = {}
): KeywordRecommendationRequest {
  const selectedKeywords = cleanList(options.selectedKeywords ?? node.keywords);
  const maxSuggestions = Math.max(0, options.maxSuggestions ?? 9);

  return {
    ...(options.cacheBypass === true ? { cacheBypass: true } : {}),
    maxSuggestions,
    selectedKeywords,
    story: createStorySnapshot(snapshot, node, parentNode),
    structuredContext: createStructuredRecommendationContext(
      snapshot,
      node,
      parentNode,
      selectedKeywords,
      maxSuggestions
    )
  };
}

// 문장 추천 요청 payload를 생성합니다.
export function createSentenceRecommendationRequest(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode,
  parentNode: StoryNode | null,
  selectedKeywords: string[]
): SentenceRecommendationRequest {
  const cleanSelectedKeywords = cleanList(selectedKeywords);

  return {
    selectedKeywords: cleanSelectedKeywords,
    story: createStorySnapshot(snapshot, node, parentNode),
    structuredContext: createStructuredRecommendationContext(
      snapshot,
      node,
      parentNode,
      cleanSelectedKeywords,
      3
    )
  };
}
