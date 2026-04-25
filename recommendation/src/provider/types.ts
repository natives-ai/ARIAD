// 이 파일은 추천 provider의 공용 인터페이스와 옵션 타입을 정의합니다.
import type {
  KeywordSuggestion,
  RecommendationContext,
  SentenceSuggestion
} from "../contracts/index.js";

// 추천 기능 provider의 공통 인터페이스를 정의합니다.
export interface RecommendationProvider {
  requestKeywords(context: RecommendationContext): Promise<KeywordSuggestion[]>;
  requestSentences(context: RecommendationContext): Promise<SentenceSuggestion[]>;
}

// 추천 provider 선택에 사용하는 이름 집합을 정의합니다.
export type RecommendationProviderName = "gemini" | "heuristic" | "openai" | "stub";

// OpenAI Responses API 호출에 필요한 최소 클라이언트 타입을 정의합니다.
export interface OpenAiResponsesClient {
  responses: {
    create(request: unknown): Promise<unknown>;
  };
}

// Gemini generateContent 호출에 필요한 최소 클라이언트 타입을 정의합니다.
export interface GeminiGenerateContentClient {
  models: {
    generateContent(request: unknown): Promise<unknown>;
  };
}

// OpenAI provider 생성 옵션을 정의합니다.
export interface OpenAiRecommendationProviderOptions {
  apiKey?: string | null;
  client?: OpenAiResponsesClient;
  fallbackProvider?: RecommendationProvider;
  model?: string;
}

// Gemini provider 생성 옵션을 정의합니다.
export interface GeminiRecommendationProviderOptions {
  apiKey?: string | null;
  cacheTtlMs?: number;
  client?: GeminiGenerateContentClient;
  fallbackProvider?: RecommendationProvider;
  maxSuggestions?: number;
  model?: string;
  timeoutMs?: number;
}

// provider factory 생성 옵션을 정의합니다.
export interface CreateRecommendationProviderOptions {
  apiKey?: string | null;
  cacheTtlMs?: number;
  fallbackProvider?: RecommendationProvider;
  fallbackToHeuristicOnError?: boolean;
  geminiClient?: GeminiGenerateContentClient;
  maxSuggestions?: number;
  model?: string;
  openAiClient?: OpenAiResponsesClient;
  provider?: string;
  timeoutMs?: number;
}
