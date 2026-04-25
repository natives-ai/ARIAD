// 이 파일은 recommendation 모듈의 환경 변수 규칙을 정규화합니다.
import type { RecommendationProviderName } from "../provider/index.js";

export interface RecommendationEnv {
  apiKey: string | null;
  apiKeyName: "GEMINI_API_KEY" | "OPENAI_API_KEY" | "RECOMMENDATION_API_KEY" | null;
  appEnv: "local" | "dev" | "staging-like";
  cacheTtlMs: number;
  fallbackToHeuristicOnError: boolean;
  maxSuggestions: number;
  model: string;
  provider: RecommendationProviderName;
  timeoutMs: number;
}

// APP_ENV 값을 허용된 값으로 파싱합니다.
function parseAppEnv(value: string | undefined): RecommendationEnv["appEnv"] {
  if (value === "dev" || value === "staging-like") {
    return value;
  }

  return "local";
}

// provider 이름을 지원되는 집합으로 파싱합니다.
function parseProvider(value: string | undefined): RecommendationProviderName {
  if (!value) {
    return "heuristic";
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "gemini" ||
    normalized === "heuristic" ||
    normalized === "openai" ||
    normalized === "stub"
  ) {
    return normalized;
  }

  return "heuristic";
}

// API 키 값을 trim하고 비어 있으면 null을 반환합니다.
function cleanApiKey(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// 문자열 불리언 값을 파싱하고 기본값을 적용합니다.
function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return fallback;
}

// 문자열 정수를 양수로 파싱하고 기본값을 적용합니다.
function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

// 문자열 정수를 0 이상으로 파싱하고 기본값을 적용합니다.
function parseNonNegativeInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

// provider에 맞는 기본 모델명을 결정합니다.
function resolveDefaultModel(provider: RecommendationProviderName) {
  if (provider === "gemini") {
    return "gemini-2.5-flash";
  }

  return "gpt-4.1-mini";
}

// provider 기준으로 API 키 우선순위를 결정합니다.
function resolveApiKey(
  provider: RecommendationProviderName
): Pick<RecommendationEnv, "apiKey" | "apiKeyName"> {
  if (provider === "gemini") {
    const geminiApiKey = cleanApiKey(process.env.GEMINI_API_KEY);

    if (geminiApiKey) {
      return {
        apiKey: geminiApiKey,
        apiKeyName: "GEMINI_API_KEY"
      };
    }
  }

  if (provider === "openai") {
    const openAiApiKey = cleanApiKey(process.env.OPENAI_API_KEY);

    if (openAiApiKey) {
      return {
        apiKey: openAiApiKey,
        apiKeyName: "OPENAI_API_KEY"
      };
    }
  }

  const recommendationApiKey = cleanApiKey(process.env.RECOMMENDATION_API_KEY);

  if (recommendationApiKey) {
    return {
      apiKey: recommendationApiKey,
      apiKeyName: "RECOMMENDATION_API_KEY"
    };
  }

  return {
    apiKey: null,
    apiKeyName: null
  };
}

// recommendation 전용 환경 설정을 반환합니다.
export function loadRecommendationEnv(): RecommendationEnv {
  const provider = parseProvider(process.env.RECOMMENDATION_PROVIDER);

  return {
    ...resolveApiKey(provider),
    appEnv: parseAppEnv(process.env.APP_ENV),
    cacheTtlMs: parseNonNegativeInteger(process.env.RECOMMENDATION_CACHE_TTL_MS, 30000),
    fallbackToHeuristicOnError: parseBoolean(
      process.env.RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR,
      false
    ),
    maxSuggestions: Math.min(
      parsePositiveInteger(process.env.RECOMMENDATION_MAX_SUGGESTIONS, 10),
      25
    ),
    model: process.env.RECOMMENDATION_MODEL ?? resolveDefaultModel(provider),
    provider,
    timeoutMs: parseNonNegativeInteger(process.env.RECOMMENDATION_TIMEOUT_MS, 4000)
  };
}
