import type {
  KeywordRecommendationRequest,
  RecommendationLanguage,
  SentenceRecommendationRequest
} from "@ariad/recommendation";
import type { StoryNode, StoryWorkspaceSnapshot } from "@ariad/shared";

import { getNodeHeadline } from "../persistence/drawerPayload";

function cleanList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stripInlineFormattingMarkers(value: string) {
  return value
    .replace(/\u2063([^\u2064\n]+?)\u2064/g, "$1")
    .replace(/\u2065([^\u2066\n]+?)\u2066/g, "$1")
    .replace(/@([^@\n]+?)@/g, "$1");
}

function getObjectAnchors(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode
) {
  return snapshot.objects
    .filter((object) => node.objectIds.includes(object.id))
    .map((object) => `${object.name}: ${object.summary}`);
}

function createStorySnapshot(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode,
  parentNode: StoryNode | null,
  language: RecommendationLanguage
) {
  const activeEpisode =
    snapshot.episodes.find((episode) => episode.id === node.episodeId) ??
    snapshot.episodes[0];

  return {
    episodeEndpoint: activeEpisode?.endpoint ?? "",
    episodeObjective: activeEpisode?.objective ?? "",
    existingKeywords: node.keywords,
    language,
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

export function createKeywordRecommendationRequest(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode,
  parentNode: StoryNode | null,
  language: RecommendationLanguage = "en"
): KeywordRecommendationRequest {
  return {
    story: createStorySnapshot(snapshot, node, parentNode, language)
  };
}

export function createSentenceRecommendationRequest(
  snapshot: StoryWorkspaceSnapshot,
  node: StoryNode,
  parentNode: StoryNode | null,
  selectedKeywords: string[],
  language: RecommendationLanguage = "en"
): SentenceRecommendationRequest {
  return {
    selectedKeywords: cleanList(selectedKeywords),
    story: createStorySnapshot(snapshot, node, parentNode, language)
  };
}
