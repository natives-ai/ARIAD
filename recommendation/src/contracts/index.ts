export type StoryNodeLevel = "major" | "minor" | "detail";
export type RecommendationLanguage = "en" | "ko" | "ja";

export interface StorySnapshot {
  episodeEndpoint: string;
  episodeObjective: string;
  existingKeywords: string[];
  language?: RecommendationLanguage;
  lockedFacts: string[];
  nodeLevel: StoryNodeLevel;
  nodeText: string;
  objectAnchors: string[];
  parentSummary: string | null;
  projectSummary: string;
  projectTitle: string;
}

export interface RecommendationContext {
  anchors: string[];
  constraints: string[];
  focus: string;
  language: RecommendationLanguage;
  nodeLevel: StoryNodeLevel;
  nodeText: string;
  objectAnchors: string[];
  selectedKeywords: string[];
}

export interface KeywordSuggestion {
  label: string;
  reason: string;
}

export interface SentenceSuggestion {
  reason: string;
  text: string;
}

export interface KeywordRecommendationRequest {
  story: StorySnapshot;
}

export interface KeywordRecommendationResponse {
  suggestions: KeywordSuggestion[];
}

export interface SentenceRecommendationRequest {
  selectedKeywords: string[];
  story: StorySnapshot;
}

export interface SentenceRecommendationResponse {
  suggestions: SentenceSuggestion[];
}

export type RecommendationRequest = KeywordRecommendationRequest;
export type RecommendationResponse = KeywordRecommendationResponse;
