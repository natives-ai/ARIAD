// 이 파일은 요청 본문을 provider 입력용 추천 컨텍스트로 변환합니다.
import type {
  KeywordRecommendationRequest,
  RecommendationContext,
  SentenceRecommendationRequest
} from "../contracts/index.js";

// 문자열 목록을 trim/중복 제거해 정규화합니다.
function cleanList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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
  const objectAnchors = cleanList(request.story.objectAnchors);
  const anchors = cleanList([
    request.story.projectTitle,
    request.story.projectSummary,
    request.story.episodeObjective,
    request.story.episodeEndpoint,
    request.story.parentSummary ?? "",
    request.story.nodeText,
    ...objectAnchors,
    ...lockedFacts
  ]);
  const focus =
    request.story.nodeText.trim() ||
    request.story.parentSummary?.trim() ||
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
    nodeLevel: request.story.nodeLevel,
    nodeText: request.story.nodeText.trim(),
    objectAnchors,
    parentSummary: request.story.parentSummary?.trim() || null,
    selectedKeywords
  };
}
