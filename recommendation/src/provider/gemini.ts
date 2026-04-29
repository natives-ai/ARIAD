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

// context와 provider 설정을 합쳐 실제 생성 개수를 계산합니다.
function resolveEffectiveMaxSuggestions(context: RecommendationContext, providerMaxSuggestions: number) {
  if (
    typeof context.maxSuggestions === "number" &&
    Number.isInteger(context.maxSuggestions)
  ) {
    return Math.max(0, Math.min(context.maxSuggestions, providerMaxSuggestions));
  }

  return providerMaxSuggestions;
}

// 프롬프트에 넣을 짧은 노드 설명 줄을 구성합니다.
function formatNodeContextLine(node: {
  canvasY?: number;
  keywords: string[];
  level: string;
  role?: string;
  text: string;
}) {
  const keywords = node.keywords.filter(Boolean).slice(0, 6).join(", ");
  const metadata = [
    node.role ? `role=${node.role}` : "",
    `level=${node.level}`,
    typeof node.canvasY === "number" ? `canvasY=${node.canvasY}` : ""
  ].filter(Boolean).join(", ");
  const text = node.text.trim() || "(empty)";

  return `- ${metadata}: ${text}${keywords ? ` [keywords: ${keywords}]` : ""}`;
}

// ranked context 항목을 priority/source metadata가 보이는 줄로 구성합니다.
function formatRankedContextLine(item: {
  canvasY?: number;
  distance?: number;
  keywords: string[];
  level?: string;
  priorityScore: number;
  role: string;
  source: string;
  text: string;
}) {
  const keywords = item.keywords.filter(Boolean).slice(0, 6).join(", ");
  const metadata = [
    `priority=${item.priorityScore.toFixed(2)}`,
    `source=${item.source}`,
    `role=${item.role}`,
    item.level ? `level=${item.level}` : "",
    typeof item.distance === "number" ? `distance=${Math.round(item.distance)}` : "",
    typeof item.canvasY === "number" ? `canvasY=${item.canvasY}` : ""
  ].filter(Boolean).join(", ");
  const text = item.text.trim() || "(empty)";

  return `- ${metadata}: ${text}${keywords ? ` [keywords: ${keywords}]` : ""}`;
}

// structured context를 Gemini가 읽기 쉬운 source-priority 섹션으로 직렬화합니다.
function buildStructuredPromptSections(context: RecommendationContext) {
  const structured = context.structuredContext;

  if (!structured) {
    return [
      `Current node: ${context.nodeText || "(empty)"}`,
      context.parentSummary ? `Parent summary: ${context.parentSummary}` : "Parent summary: (none)",
      context.anchors.length > 0
        ? `Context anchors: ${context.anchors.slice(0, 12).join(" | ")}`
        : "Context anchors: (none)"
    ];
  }

  if (structured.rankedItems.length > 0) {
    const currentItem =
      structured.rankedItems.find((item) => item.role === "current") ?? null;
    const highPriorityItems = structured.rankedItems.filter(
      (item) => item.role !== "current" && item.priorityScore >= 0.8
    );
    const mediumPriorityItems = structured.rankedItems.filter(
      (item) =>
        item.role !== "current" &&
        item.priorityScore >= 0.58 &&
        item.priorityScore < 0.8 &&
        item.role !== "major-flow"
    );
    const majorFlowItems = structured.rankedItems
      .filter((item) => item.role === "major-flow")
      .sort(
        (left, right) =>
          (left.canvasY ?? Number.MAX_SAFE_INTEGER) -
            (right.canvasY ?? Number.MAX_SAFE_INTEGER) ||
          right.priorityScore - left.priorityScore
      );
    const episodeItems = structured.rankedItems.filter((item) => item.source === "episode");

    return [
      "Current node - strongest signal:",
      currentItem ? formatRankedContextLine(currentItem) : formatNodeContextLine(structured.currentNode),
      "",
      "High priority context - use before lower priority:",
      highPriorityItems.length > 0
        ? highPriorityItems.slice(0, 10).map(formatRankedContextLine).join("\n")
        : "- (none)",
      "",
      "Medium priority context - useful background:",
      mediumPriorityItems.length > 0
        ? mediumPriorityItems.slice(0, 10).map(formatRankedContextLine).join("\n")
        : "- (none)",
      "",
      "Major lane flow - keep canvasY order:",
      majorFlowItems.length > 0
        ? majorFlowItems.slice(0, 18).map(formatRankedContextLine).join("\n")
        : "- (none)",
      "",
      "Episode background:",
      episodeItems.length > 0
        ? episodeItems.slice(0, 4).map(formatRankedContextLine).join("\n")
        : [
            `- title: ${structured.episodeContext.title || "(untitled)"}`,
            `- objective: ${structured.episodeContext.objective || "(empty)"}`,
            `- endpoint: ${structured.episodeContext.endpoint || "(empty)"}`
          ].join("\n"),
      "",
      "Selected keywords / object context:",
      structured.selectedKeywords.length > 0
        ? `- priority=0.98, role=selected-keywords: ${structured.selectedKeywords.slice(0, 12).join(", ")}`
        : "- priority=0.98, role=selected-keywords: (none)",
      structured.objectContext.length > 0
        ? structured.objectContext
            .slice(0, 8)
            .map((object) =>
              `- object=${object.name} (${object.category}): ${object.summary || "(empty)"}`
            )
            .join("\n")
        : "- objects: (none)"
    ];
  }

  return [
    "Priority 1 - current node:",
    formatNodeContextLine(structured.currentNode),
    "",
    "Priority 2 - direct structural context:",
    structured.directConnections.length > 0
      ? structured.directConnections.slice(0, 10).map(formatNodeContextLine).join("\n")
      : "- (none)",
    "",
    "Priority 3 - major lane flow sorted by canvasY:",
    structured.majorLaneFlow.length > 0
      ? structured.majorLaneFlow
          .slice(0, 18)
          .map((item, index) =>
            `- ${index + 1}. canvasY=${item.canvasY}: ${item.text.trim() || "(empty)"}${
              item.keywords.length > 0 ? ` [keywords: ${item.keywords.slice(0, 6).join(", ")}]` : ""
            }`
          )
          .join("\n")
      : "- (none)",
    "",
    "Priority 4 - episode context:",
    `- title: ${structured.episodeContext.title || "(untitled)"}`,
    `- objective: ${structured.episodeContext.objective || "(empty)"}`,
    `- endpoint: ${structured.episodeContext.endpoint || "(empty)"}`,
    "",
    "Object context:",
    structured.objectContext.length > 0
      ? structured.objectContext
          .slice(0, 8)
          .map((object) =>
            `- ${object.name} (${object.category}): ${object.summary || "(empty)"}`
          )
          .join("\n")
      : "- (none)"
  ];
}

// 요청 컨텍스트를 Gemini 프롬프트 문자열로 구성합니다.
function buildPrompt(context: RecommendationContext, maxSuggestions: number) {
  const constraints = context.constraints.filter(Boolean).slice(0, 3);
  const lockedFacts = (context.lockedFacts ?? []).filter(Boolean).slice(0, 4);
  const selectedKeywords = context.selectedKeywords.filter(Boolean).slice(0, 12);
  const language = context.structuredContext?.language ?? "en";

  return [
    "You are ARIAD, helping a webtoon creator build current-episode structure.",
    "Return keyword-cloud suggestions only. Do not write final story prose.",
    "Suggestions are optional possibilities under creator control, not canon.",
    "",
    `Node level: ${context.nodeLevel}`,
    `Output language: ${language}`,
    `Focus: ${context.focus || "(empty)"}`,
    selectedKeywords.length > 0
      ? `Selected keywords already chosen; do not duplicate: ${selectedKeywords.join(", ")}`
      : "Selected keywords: (none)",
    lockedFacts.length > 0 ? `Locked facts: ${lockedFacts.join(" | ")}` : "Locked facts: (none)",
    constraints.length > 0
      ? `Constraints: ${constraints.join(" | ")}`
      : "Constraints: (none)",
    "",
    ...buildStructuredPromptSections(context),
    "",
    "Output requirements:",
    "- Return JSON only.",
    "- JSON shape: {\"suggestions\":[{\"label\":\"...\",\"reason\":\"...\"}]}",
    `- Provide up to ${maxSuggestions} suggestions.`,
    "- label: short keyword phrase, not a complete sentence.",
    "- reason: one concise sentence in the same language as label.",
    "- Prioritize scene construction, event progression, or next-beat handoff clues.",
    "- Avoid pure emotion labels such as tension, anxiety, anger, conflict, emotion, or scene.",
    "- Convert emotion into visible or actionable scene clues.",
    "- Current node text is the strongest signal.",
    "- Prefer high-priority ranked context before medium or background items.",
    "- Use low-priority items only as background, never as the main suggestion source."
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

// 라벨 중복/근접 중복 판정을 위한 key를 생성합니다.
function normalizeSuggestionKey(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// 키워드 클라우드에 맞지 않는 문장형 라벨인지 확인합니다.
function isSentenceLikeLabel(label: string) {
  const words = label.split(/\s+/).filter(Boolean);

  return (
    label.length > 48 ||
    words.length > 6 ||
    /[.!?。！？]$/.test(label.trim())
  );
}

const pureEmotionLabels = new Set([
  "anger",
  "anxiety",
  "conflict",
  "emotion",
  "fear",
  "scene",
  "sadness",
  "tension",
  "불안",
  "분노",
  "감정",
  "갈등",
  "긴장",
  "긴장감",
  "슬픔",
  "不安",
  "怒り",
  "感情",
  "葛藤",
  "緊張"
]);

// 순수 감정/범주 라벨을 필터링합니다.
function isPureEmotionLabel(label: string) {
  return pureEmotionLabels.has(normalizeSuggestionKey(label));
}

// 파싱된 구조화 결과를 KeywordSuggestion 배열로 검증/정규화합니다.
function parseKeywordSuggestions(
  value: unknown,
  maxSuggestions: number,
  selectedKeywords: string[]
): KeywordSuggestion[] {
  if (!isRecord(value) || !Array.isArray(value.suggestions)) {
    throw new Error("structured_output_invalid");
  }

  const normalized: KeywordSuggestion[] = [];
  const seenLabels = new Set<string>();
  const selectedLabelKeys = new Set(
    selectedKeywords.map(normalizeSuggestionKey).filter(Boolean)
  );

  for (const suggestion of value.suggestions) {
    if (!isRecord(suggestion)) {
      continue;
    }

    const label = normalizeString(suggestion.label);
    const reason = normalizeString(suggestion.reason);

    if (!label || !reason) {
      continue;
    }

    if (isSentenceLikeLabel(label) || isPureEmotionLabel(label)) {
      continue;
    }

    const normalizedKey = normalizeSuggestionKey(label);

    if (!normalizedKey || seenLabels.has(normalizedKey) || selectedLabelKeys.has(normalizedKey)) {
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
function extractKeywordSuggestions(
  payload: unknown,
  maxSuggestions: number,
  selectedKeywords: string[]
): KeywordSuggestion[] {
  const outputText = readOutputText(payload);

  if (!outputText) {
    throw new Error("structured_output_invalid");
  }

  return parseKeywordSuggestions(
    parseOutputJson(outputText),
    maxSuggestions,
    selectedKeywords
  );
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
  const structured = context.structuredContext;

  return JSON.stringify({
    coreContext: context.nodeText.trim() || context.parentSummary?.trim() || "",
    focus: context.focus.trim(),
    level: context.nodeLevel,
    lockedFacts: normalizeKeyList(context.lockedFacts ?? [], 4),
    maxSuggestions,
    model,
    objectAnchors: normalizeKeyList(context.objectAnchors, 4),
    selectedKeywords: normalizeKeyList(context.selectedKeywords, 12),
    structuredContext: structured
      ? {
          currentNode: structured.currentNode,
          directConnections: structured.directConnections,
          episodeContext: structured.episodeContext,
          language: structured.language,
          majorLaneFlow: structured.majorLaneFlow,
          maxSuggestions: structured.maxSuggestions,
          nodeLevel: structured.nodeLevel,
          objectContext: structured.objectContext,
          rankedItems: structured.rankedItems.map((item) => ({
            canvasY: item.canvasY,
            distance: item.distance,
            id: item.id,
            keywords: normalizeKeyList(item.keywords, 8),
            level: item.level,
            orderIndex: item.orderIndex,
            priorityScore: item.priorityScore,
            role: item.role,
            source: item.source,
            text: item.text
          })),
          selectedKeywords: structured.selectedKeywords
        }
      : null
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
      const effectiveMaxSuggestions = resolveEffectiveMaxSuggestions(context, maxSuggestions);

      if (!context.focus.trim() || effectiveMaxSuggestions <= 0) {
        return [];
      }

      const cacheKey = buildCacheKey(context, model, effectiveMaxSuggestions);
      const shouldBypassCache = context.cacheBypass === true;
      const cachedSuggestions = shouldBypassCache
        ? null
        : readCacheEntry(cache, cacheKey, Date.now());

      if (cachedSuggestions) {
        return cachedSuggestions;
      }

      try {
        const client = resolveClient(options);
        const payload = await withOptionalTimeout(
          client.models.generateContent(
            buildGenerateContentRequest(context, model, effectiveMaxSuggestions)
          ),
          timeoutMs
        );
        const suggestions = extractKeywordSuggestions(
          payload,
          effectiveMaxSuggestions,
          context.selectedKeywords
        );

        if (!shouldBypassCache) {
          writeCacheEntry(cache, cacheKey, suggestions, Date.now(), cacheTtlMs);
        }
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
