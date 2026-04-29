// 이 파일은 recommendation 모듈의 요청/응답 및 컨텍스트 타입을 정의합니다.
export type StoryNodeLevel = "major" | "minor" | "detail";
export type RecommendationLanguage = "en" | "ko" | "ja";
export type RankedRecommendationContextSource = "node" | "object" | "episode" | "flow";
export type RankedRecommendationContextRole =
  | "attached-object"
  | "child"
  | "current"
  | "episode-endpoint"
  | "episode-objective"
  | "major-flow"
  | "parent"
  | "same-lane-after"
  | "same-lane-before";
export type RecommendationNodeRole =
  | "current"
  | "parent"
  | "child"
  | "major-lane-neighbor"
  | "related";

export interface StorySnapshot {
  episodeEndpoint: string;
  episodeObjective: string;
  existingKeywords: string[];
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
  cacheBypass?: boolean;
  constraints: string[];
  focus: string;
  lockedFacts?: string[];
  maxSuggestions?: number;
  nodeLevel: StoryNodeLevel;
  nodeText: string;
  objectAnchors: string[];
  parentSummary?: string | null;
  selectedKeywords: string[];
  structuredContext?: StructuredRecommendationContext;
}

export interface KeywordSuggestion {
  label: string;
  reason: string;
}

export interface SentenceSuggestion {
  reason: string;
  text: string;
}

export interface RecommendationNodeContext {
  canvasY?: number;
  id: string;
  keywords: string[];
  level: StoryNodeLevel;
  orderIndex?: number;
  role: RecommendationNodeRole;
  text: string;
}

export interface RecommendationFlowItem {
  canvasY: number;
  id: string;
  keywords: string[];
  text: string;
}

export interface RecommendationEpisodeContext {
  endpoint: string;
  objective: string;
  title: string;
}

export interface RecommendationObjectContext {
  category: string;
  id: string;
  name: string;
  summary: string;
}

export interface RankedRecommendationContextItem {
  canvasY?: number;
  distance?: number;
  id: string;
  keywords: string[];
  level?: StoryNodeLevel;
  objectIds?: string[];
  orderIndex?: number;
  priorityScore: number;
  role: RankedRecommendationContextRole;
  source: RankedRecommendationContextSource;
  text: string;
}

export interface StructuredRecommendationContext {
  currentNode: RecommendationNodeContext;
  directConnections: RecommendationNodeContext[];
  episodeContext: RecommendationEpisodeContext;
  language: RecommendationLanguage;
  majorLaneFlow: RecommendationFlowItem[];
  maxSuggestions: number;
  nodeLevel: StoryNodeLevel;
  objectContext: RecommendationObjectContext[];
  rankedItems: RankedRecommendationContextItem[];
  selectedKeywords: string[];
}

export interface KeywordRecommendationRequest {
  cacheBypass?: boolean;
  excludedSuggestionLabels?: string[];
  maxSuggestions?: number;
  refreshNonce?: string;
  selectedKeywords?: string[];
  story: StorySnapshot;
  structuredContext?: StructuredRecommendationContext;
}

export interface KeywordRecommendationResponse {
  suggestions: KeywordSuggestion[];
}

export interface SentenceRecommendationRequest {
  maxSuggestions?: number;
  selectedKeywords: string[];
  story: StorySnapshot;
  structuredContext?: StructuredRecommendationContext;
}

export interface SentenceRecommendationResponse {
  suggestions: SentenceSuggestion[];
}

export type RecommendationRequest = KeywordRecommendationRequest;
export type RecommendationResponse = KeywordRecommendationResponse;
