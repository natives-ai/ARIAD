// 이 파일은 요청 본문을 provider 입력용 추천 컨텍스트로 변환합니다.
import type {
  KeywordRecommendationRequest,
  RankedRecommendationContextItem,
  RecommendationContext,
  StructuredRecommendationContext,
  SentenceRecommendationRequest
} from "../contracts/index.js";

// 문자열 목록을 trim/중복 제거해 정규화합니다.
function cleanList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

// 추천 개수 요청값을 안전한 범위로 정규화합니다.
function normalizeMaxSuggestions(value: number | undefined) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(value, 25));
}

// 컨텍스트 텍스트를 provider 입력용으로 짧게 정리합니다.
function trimContextText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

// ranked context를 우선순위와 거리 기준으로 정렬합니다.
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

// ranked context를 provider 입력 전에 압축하고 정렬합니다.
function normalizeRankedContextItems(items: RankedRecommendationContextItem[]) {
  const normalizedItems = items
    .map((item) => ({
      ...item,
      keywords: cleanList(item.keywords).slice(0, 8),
      priorityScore: Math.max(0, Math.min(1, item.priorityScore)),
      text:
        item.role === "current"
          ? item.text.trim()
          : trimContextText(item.text, 260)
    }))
    .filter((item) => item.id.trim() && item.text.trim())
    .sort(sortRankedContextItems);
  const compressedItems: RankedRecommendationContextItem[] = [];
  let usedTextBudget = 0;

  for (const item of normalizedItems) {
    const textCost = item.text.length + item.keywords.join(" ").length;
    const isRequired = item.role === "current";

    if (!isRequired && (compressedItems.length >= 32 || usedTextBudget + textCost > 3600)) {
      continue;
    }

    compressedItems.push(item);
    usedTextBudget += textCost;
  }

  return compressedItems;
}

// structured context 내부 ranked item을 provider용으로 정규화합니다.
function normalizeStructuredContext(context: StructuredRecommendationContext) {
  return {
    ...context,
    rankedItems: normalizeRankedContextItems(context.rankedItems)
  } satisfies StructuredRecommendationContext;
}

// legacy story 요청을 structured context로 변환합니다.
function buildLegacyStructuredContext(
  request: KeywordRecommendationRequest | SentenceRecommendationRequest,
  selectedKeywords: string[],
  maxSuggestions: number
): StructuredRecommendationContext {
  return {
    currentNode: {
      id: "current",
      keywords: request.story.existingKeywords,
      level: request.story.nodeLevel,
      role: "current",
      text: request.story.nodeText.trim()
    },
    directConnections: request.story.parentSummary
      ? [
          {
            id: "parent",
            keywords: [],
            level: request.story.nodeLevel === "detail" ? "minor" : "major",
            role: "parent",
            text: request.story.parentSummary.trim()
          }
        ]
      : [],
    episodeContext: {
      endpoint: request.story.episodeEndpoint,
      objective: request.story.episodeObjective,
      title: request.story.projectTitle
    },
    language: "en",
    majorLaneFlow: [],
    maxSuggestions,
    nodeLevel: request.story.nodeLevel,
    objectContext: request.story.objectAnchors.map((anchor, index) => ({
      category: "thing",
      id: `object-${index + 1}`,
      name: anchor.split(":")[0]?.trim() || anchor,
      summary: anchor
    })),
    rankedItems: normalizeRankedContextItems([
      {
        id: "current",
        keywords: request.story.existingKeywords,
        level: request.story.nodeLevel,
        priorityScore: 1,
        role: "current",
        source: "node",
        text: request.story.nodeText.trim()
      } satisfies RankedRecommendationContextItem,
      ...(request.story.parentSummary
        ? [
            {
              id: "parent",
              keywords: [],
              level: request.story.nodeLevel === "detail" ? "minor" : "major",
              priorityScore: 0.88,
              role: "parent" as const,
              source: "node" as const,
              text: request.story.parentSummary.trim()
            } satisfies RankedRecommendationContextItem
          ]
        : []),
      ...request.story.objectAnchors.map((anchor, index) => ({
        id: `attached-object:${index + 1}`,
        keywords: [],
        priorityScore: 0.9,
        role: "attached-object" as const,
        source: "object" as const,
        text: anchor
      }) satisfies RankedRecommendationContextItem),
      {
        id: "episode-endpoint",
        keywords: [],
        priorityScore: 0.62,
        role: "episode-endpoint",
        source: "episode",
        text: request.story.episodeEndpoint
      } satisfies RankedRecommendationContextItem,
      {
        id: "episode-objective",
        keywords: [],
        priorityScore: 0.58,
        role: "episode-objective",
        source: "episode",
        text: request.story.episodeObjective
      } satisfies RankedRecommendationContextItem
    ]),
    selectedKeywords
  };
}

// 추천 요청에서 provider 공통 컨텍스트를 조립합니다.
export function buildRecommendationContext(
  request: KeywordRecommendationRequest | SentenceRecommendationRequest
): RecommendationContext {
  const lockedFacts = request.story.lockedFacts.map((fact) => fact.trim()).filter(Boolean);
  const selectedKeywords = cleanList(
    "selectedKeywords" in request
      ? request.selectedKeywords
      : request.story.existingKeywords
  );
  const requestMaxSuggestions = normalizeMaxSuggestions(request.maxSuggestions);
  const structuredMaxSuggestions = normalizeMaxSuggestions(
    request.structuredContext?.maxSuggestions
  );
  const maxSuggestions = requestMaxSuggestions ?? structuredMaxSuggestions ?? 9;
  const structuredContext =
    request.structuredContext
      ? normalizeStructuredContext(request.structuredContext)
      : buildLegacyStructuredContext(request, selectedKeywords, maxSuggestions);
  const objectAnchors = cleanList(request.story.objectAnchors);
  const anchors = cleanList([
    request.story.projectTitle,
    request.story.projectSummary,
    request.story.episodeObjective,
    request.story.episodeEndpoint,
    request.story.parentSummary ?? "",
    request.story.nodeText,
    structuredContext.currentNode.text,
    ...structuredContext.currentNode.keywords,
    ...structuredContext.directConnections.flatMap((node) => [
      node.text,
      ...node.keywords
    ]),
    ...structuredContext.majorLaneFlow.flatMap((item) => [
      item.text,
      ...item.keywords
    ]),
    structuredContext.episodeContext.objective,
    structuredContext.episodeContext.endpoint,
    ...structuredContext.objectContext.flatMap((object) => [
      object.name,
      object.summary
    ]),
    ...structuredContext.rankedItems.flatMap((item) => [
      item.text,
      ...item.keywords
    ]),
    ...objectAnchors,
    ...lockedFacts
  ]);
  const focus =
    structuredContext.currentNode.text.trim() ||
    request.story.nodeText.trim() ||
    structuredContext.directConnections.find((node) => node.text.trim())?.text.trim() ||
    request.story.parentSummary?.trim() ||
    structuredContext.episodeContext.objective ||
    request.story.episodeObjective;

  return {
    anchors,
    constraints: [
      "Preserve creator control.",
      "Do not silently finalize story structure.",
      `Work at the ${request.story.nodeLevel} level.`,
      "Keep the output concise and useful inside an episode-structure editor."
    ],
    focus,
    lockedFacts: lockedFacts.slice(0, 4),
    maxSuggestions,
    nodeLevel: request.story.nodeLevel,
    nodeText: request.story.nodeText.trim(),
    objectAnchors,
    parentSummary: request.story.parentSummary?.trim() || null,
    selectedKeywords,
    structuredContext
  };
}
