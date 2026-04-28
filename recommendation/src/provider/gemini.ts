// 이 파일은 Gemini API 기반 추천 provider 구현을 제공합니다.
import { GoogleGenAI } from "@google/genai";

import type {
  KeywordSuggestion,
  RecommendationContext
} from "../contracts/index.js";
import type {
  GeminiGenerateContentClient,
  GeminiRecommendationProviderOptions,
  RecommendationProvider
} from "./types.js";

const defaultGeminiModel = "gemini-2.5-flash-lite";
const defaultGeminiTimeoutMs = 4000;
const defaultGeminiCacheTtlMs = 30000;
const defaultGeminiMaxSuggestions = 9;
const maxAllowedSuggestions = 25;
const maxCacheEntries = 200;

interface KeywordCacheEntry {
  expiresAt: number;
  suggestions: KeywordSuggestion[];
}

// 객체 레코드 여부를 판별합니다.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// 문자열을 trim 후 비어 있지 않으면 반환합니다.
function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// provider에 사용할 모델명을 기본값 포함으로 정규화합니다.
function normalizeModel(value: string | undefined) {
  return value?.trim() || defaultGeminiModel;
}

// 숫자 옵션을 양의 정수로 정규화하고 실패 시 기본값을 사용합니다.
function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}

// timeout 값을 정규화하고 0 이하면 timeout 비활성화로 처리합니다.
function resolveTimeoutMs(value: number | undefined) {
  if (value === 0) {
    return null;
  }

  return normalizePositiveInteger(value, defaultGeminiTimeoutMs);
}

// cache TTL 값을 정규화하고 0 이하면 캐시를 끕니다.
function resolveCacheTtlMs(value: number | undefined) {
  if (value === 0) {
    return 0;
  }

  return normalizePositiveInteger(value, defaultGeminiCacheTtlMs);
}

// 최대 추천 개수를 정규화하고 안전한 상한을 적용합니다.
function resolveMaxSuggestions(value: number | undefined) {
  return Math.min(normalizePositiveInteger(value, defaultGeminiMaxSuggestions), maxAllowedSuggestions);
}

// 요청 컨텍스트를 Gemini 프롬프트 문자열로 구성합니다.
function buildPrompt(context: RecommendationContext, maxSuggestions: number) {
  const constraints = context.constraints.filter(Boolean).slice(0, 3);
  const lockedFacts = (context.lockedFacts ?? []).filter(Boolean).slice(0, 4);
  const selectedKeywords = context.selectedKeywords.filter(Boolean).slice(0, 8);
  const objectAnchors = context.objectAnchors.filter(Boolean).slice(0, 4);
  const trimmedNodeText = context.nodeText.trim();
  const trimmedParentSummary = context.parentSummary?.trim();
  const focusSource = trimmedNodeText || trimmedParentSummary || "(empty)";

  return [
    "You are helping a webtoon creator build episode structure keywords.",
    "Return concise keyword suggestions for the selected node.",
    "Respect creator ownership and avoid finalizing the full story.",
    "",
    `Node level: ${context.nodeLevel}`,
    `Focus: ${context.focus || "(empty)"}`,
    `Core context: ${focusSource}`,
    selectedKeywords.length > 0
      ? `Selected keywords: ${selectedKeywords.join(", ")}`
      : "Selected keywords: (none)",
    objectAnchors.length > 0
      ? `Object anchors: ${objectAnchors.join(" | ")}`
      : "Object anchors: (none)",
    lockedFacts.length > 0 ? `Locked facts: ${lockedFacts.join(" | ")}` : "Locked facts: (none)",
    constraints.length > 0
      ? `Constraints: ${constraints.join(" | ")}`
      : "Constraints: (none)",
    "",
    "Output requirements:",
    "- Return JSON only.",
    "- JSON shape: {\"suggestions\":[{\"label\":\"...\",\"reason\":\"...\"}]}",
    `- Provide up to ${maxSuggestions} suggestions.`,
    "- label: short keyword phrase in English.",
    "- reason: one concise sentence in English."
  ].join("\n");
}

// Gemini generateContent 요청 페이로드를 구성합니다.
function buildGenerateContentRequest(
  context: RecommendationContext,
  model: string,
  maxSuggestions: number
) {
  return {
    config: {
      responseMimeType: "application/json"
    },
    contents: buildPrompt(context, maxSuggestions),
    model
  };
}

// Gemini 응답에서 텍스트를 추출합니다.
function readOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const directText = normalizeString(payload.text);

  if (directText) {
    return directText;
  }

  if (typeof payload.text === "function") {
    const dynamicText = normalizeString(payload.text());

    if (dynamicText) {
      return dynamicText;
    }
  }

  if (!Array.isArray(payload.candidates)) {
    return null;
  }

  const chunks: string[] = [];

  for (const candidate of payload.candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
      continue;
    }

    for (const part of candidate.content.parts) {
      if (!isRecord(part)) {
        continue;
      }

      const partText = normalizeString(part.text);

      if (partText) {
        chunks.push(partText);
      }
    }
  }

  if (chunks.length === 0) {
    return null;
  }

  return chunks.join("\n");
}

// output text JSON을 파싱하고 실패 시 표준 에러를 던집니다.
function parseOutputJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("structured_output_invalid");
  }
}

// 파싱된 구조화 결과를 KeywordSuggestion 배열로 검증/정규화합니다.
function parseKeywordSuggestions(value: unknown, maxSuggestions: number): KeywordSuggestion[] {
  if (!isRecord(value) || !Array.isArray(value.suggestions)) {
    throw new Error("structured_output_invalid");
  }

  const normalized: KeywordSuggestion[] = [];
  const seenLabels = new Set<string>();

  for (const suggestion of value.suggestions) {
    if (!isRecord(suggestion)) {
      continue;
    }

    const label = normalizeString(suggestion.label);
    const reason = normalizeString(suggestion.reason);

    if (!label || !reason) {
      continue;
    }

    const normalizedKey = label.toLowerCase();

    if (seenLabels.has(normalizedKey)) {
      continue;
    }

    seenLabels.add(normalizedKey);
    normalized.push({ label, reason });
  }

  if (normalized.length === 0) {
    throw new Error("structured_output_invalid");
  }

  return normalized.slice(0, maxSuggestions);
}

// Gemini 응답 payload에서 키워드 구조를 추출합니다.
function extractKeywordSuggestions(payload: unknown, maxSuggestions: number): KeywordSuggestion[] {
  const outputText = readOutputText(payload);

  if (!outputText) {
    throw new Error("structured_output_invalid");
  }

  return parseKeywordSuggestions(parseOutputJson(outputText), maxSuggestions);
}

// provider 내부 에러를 표준 코드 메시지로 정규화합니다.
function normalizeProviderError(error: unknown): Error {
  if (error instanceof Error) {
    if (
      error.message === "missing_api_key" ||
      error.message === "structured_output_invalid"
    ) {
      return error;
    }

    if (error.message === "provider_timeout") {
      return new Error("upstream_connection_error");
    }

    const normalizedMessage = error.message.toLowerCase();

    if (
      normalizedMessage.includes("api key") ||
      normalizedMessage.includes("unauthenticated") ||
      normalizedMessage.includes("permission denied")
    ) {
      return new Error("invalid_api_key");
    }

    if (
      normalizedMessage.includes("econn") ||
      normalizedMessage.includes("enotfound") ||
      normalizedMessage.includes("etimedout") ||
      normalizedMessage.includes("network") ||
      normalizedMessage.includes("fetch failed") ||
      normalizedMessage.includes("socket")
    ) {
      return new Error("upstream_connection_error");
    }
  }

  return new Error("recommendation_failed");
}

// Promise에 optional timeout을 적용하고 만료 시 표준 timeout 에러를 던집니다.
function withOptionalTimeout<T>(promise: Promise<T>, timeoutMs: number | null) {
  if (timeoutMs === null) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("provider_timeout"));
    }, timeoutMs);

    void promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// 캐시 키용 문자열 배열을 trim/필터링 후 제한 개수만 유지합니다.
function normalizeKeyList(values: string[], limit: number) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit);
}

// context/model 기반 캐시 키를 생성합니다.
function buildCacheKey(context: RecommendationContext, model: string, maxSuggestions: number) {
  return JSON.stringify({
    coreContext: context.nodeText.trim() || context.parentSummary?.trim() || "",
    focus: context.focus.trim(),
    level: context.nodeLevel,
    lockedFacts: normalizeKeyList(context.lockedFacts ?? [], 4),
    maxSuggestions,
    model,
    objectAnchors: normalizeKeyList(context.objectAnchors, 4),
    selectedKeywords: normalizeKeyList(context.selectedKeywords, 8)
  });
}

// 키워드 추천 배열을 외부 변경으로부터 보호하기 위해 복제합니다.
function cloneSuggestions(suggestions: KeywordSuggestion[]) {
  return suggestions.map((suggestion) => ({
    label: suggestion.label,
    reason: suggestion.reason
  }));
}

// cache hit 시 만료 여부를 확인하고 유효한 추천 결과를 반환합니다.
function readCacheEntry(cache: Map<string, KeywordCacheEntry>, key: string, now: number) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }

  return cloneSuggestions(entry.suggestions);
}

// 캐시에 추천 결과를 저장하고 오래된 항목을 정리합니다.
function writeCacheEntry(
  cache: Map<string, KeywordCacheEntry>,
  key: string,
  suggestions: KeywordSuggestion[],
  now: number,
  ttlMs: number
) {
  if (ttlMs <= 0) {
    return;
  }

  cache.set(key, {
    expiresAt: now + ttlMs,
    suggestions: cloneSuggestions(suggestions)
  });

  if (cache.size <= maxCacheEntries) {
    return;
  }

  for (const [entryKey, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(entryKey);
    }
  }

  if (cache.size > maxCacheEntries) {
    const oldestKey = cache.keys().next().value as string | undefined;

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

// Gemini 클라이언트를 옵션 기준으로 생성/재사용합니다.
function resolveClient(options: GeminiRecommendationProviderOptions): GeminiGenerateContentClient {
  if (options.client) {
    return options.client;
  }

  const apiKey = normalizeString(options.apiKey);

  if (!apiKey) {
    throw new Error("missing_api_key");
  }

  return new GoogleGenAI({ apiKey }) as unknown as GeminiGenerateContentClient;
}

// Gemini 기반 키워드 추천 provider를 생성합니다.
export function createGeminiRecommendationProvider(
  options: GeminiRecommendationProviderOptions
): RecommendationProvider {
  const cache = new Map<string, KeywordCacheEntry>();
  const cacheTtlMs = resolveCacheTtlMs(options.cacheTtlMs);
  const maxSuggestions = resolveMaxSuggestions(options.maxSuggestions);
  const model = normalizeModel(options.model);
  const fallbackProvider = options.fallbackProvider;
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);

  return {
    async requestKeywords(context) {
      if (!context.focus.trim()) {
        return [];
      }

      const cacheKey = buildCacheKey(context, model, maxSuggestions);
      const cachedSuggestions = readCacheEntry(cache, cacheKey, Date.now());

      if (cachedSuggestions) {
        return cachedSuggestions;
      }

      try {
        const client = resolveClient(options);
        const payload = await withOptionalTimeout(
          client.models.generateContent(
            buildGenerateContentRequest(context, model, maxSuggestions)
          ),
          timeoutMs
        );
        const suggestions = extractKeywordSuggestions(payload, maxSuggestions);

        writeCacheEntry(cache, cacheKey, suggestions, Date.now(), cacheTtlMs);
        return suggestions;
      } catch (error) {
        if (fallbackProvider) {
          return fallbackProvider.requestKeywords(context);
        }

        throw normalizeProviderError(error);
      }
    },
    async requestSentences(context) {
      if (context.selectedKeywords.length === 0) {
        return [];
      }

      if (fallbackProvider) {
        return fallbackProvider.requestSentences(context);
      }

      return [];
    }
  };
}
