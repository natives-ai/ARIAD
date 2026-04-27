import type {
  KeywordRecommendationRequest,
  RecommendationContext,
  SentenceRecommendationRequest
} from "../contracts/index.js";

function cleanList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

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
  const language = request.story.language ?? "en";

  return {
    anchors,
    constraints: [
      "Preserve creator control.",
      "Do not silently finalize story structure.",
      `Work at the ${request.story.nodeLevel} level.`,
      "Keep the output concise and useful inside an episode-structure editor."
    ],
    focus,
    language,
    nodeLevel: request.story.nodeLevel,
    nodeText: request.story.nodeText.trim(),
    objectAnchors,
    selectedKeywords
  };
}
