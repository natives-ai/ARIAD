// 이 파일은 환경/옵션 기준으로 추천 provider를 선택해 생성합니다.
import { createGeminiRecommendationProvider } from "./gemini.js";
import {
  createHeuristicRecommendationProvider,
  createStubRecommendationProvider
} from "./heuristic.js";
import { createOpenAiRecommendationProvider } from "./openai.js";
import type {
  CreateRecommendationProviderOptions,
  GeminiRecommendationProviderOptions,
  OpenAiRecommendationProviderOptions,
  RecommendationProvider,
  RecommendationProviderName
} from "./types.js";

const defaultProviderName: RecommendationProviderName = "heuristic";

// 문자열 provider 이름을 표준 provider 집합으로 정규화합니다.
function normalizeProviderName(value: string | undefined): RecommendationProviderName {
  if (!value) {
    return defaultProviderName;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "gemini" ||
    normalized === "openai" ||
    normalized === "heuristic" ||
    normalized === "stub"
  ) {
    return normalized;
  }

  throw new Error("unsupported_provider");
}

// fallback provider 규칙을 옵션에 맞게 결정합니다.
function resolveFallbackProvider(options: CreateRecommendationProviderOptions): RecommendationProvider | undefined {
  if (options.fallbackProvider) {
    return options.fallbackProvider;
  }

  if (options.fallbackToHeuristicOnError === false) {
    return undefined;
  }

  return createHeuristicRecommendationProvider();
}

// OpenAI provider 옵션 객체를 구성합니다.
function buildOpenAiOptions(options: CreateRecommendationProviderOptions) {
  const providerOptions: OpenAiRecommendationProviderOptions = {};
  const fallbackProvider = resolveFallbackProvider(options);

  if (options.apiKey !== undefined) {
    providerOptions.apiKey = options.apiKey;
  }

  if (options.model !== undefined) {
    providerOptions.model = options.model;
  }

  if (options.openAiClient !== undefined) {
    providerOptions.client = options.openAiClient;
  }

  if (fallbackProvider) {
    providerOptions.fallbackProvider = fallbackProvider;
  }

  return providerOptions;
}

// Gemini provider 옵션 객체를 구성합니다.
function buildGeminiOptions(options: CreateRecommendationProviderOptions) {
  const providerOptions: GeminiRecommendationProviderOptions = {};
  const fallbackProvider = resolveFallbackProvider(options);

  if (options.apiKey !== undefined) {
    providerOptions.apiKey = options.apiKey;
  }

  if (options.model !== undefined) {
    providerOptions.model = options.model;
  }

  if (options.geminiClient !== undefined) {
    providerOptions.client = options.geminiClient;
  }

  if (options.timeoutMs !== undefined) {
    providerOptions.timeoutMs = options.timeoutMs;
  }

  if (options.cacheTtlMs !== undefined) {
    providerOptions.cacheTtlMs = options.cacheTtlMs;
  }

  if (options.maxSuggestions !== undefined) {
    providerOptions.maxSuggestions = options.maxSuggestions;
  }

  if (fallbackProvider) {
    providerOptions.fallbackProvider = fallbackProvider;
  }

  return providerOptions;
}

// 외부 옵션 기반으로 recommendation provider를 생성합니다.
export function createRecommendationProvider(
  options: CreateRecommendationProviderOptions = {}
): RecommendationProvider {
  const providerName = normalizeProviderName(options.provider);

  if (providerName === "heuristic") {
    return createHeuristicRecommendationProvider();
  }

  if (providerName === "stub") {
    return createStubRecommendationProvider();
  }

  if (providerName === "openai") {
    return createOpenAiRecommendationProvider(buildOpenAiOptions(options));
  }

  return createGeminiRecommendationProvider(buildGeminiOptions(options));
}
