// 이 파일은 OpenAI Responses API 기반 추천 provider 구현을 제공합니다.
import OpenAI from "openai";

import type {
  KeywordSuggestion,
  RecommendationContext
} from "../contracts/index.js";
import type {
  OpenAiRecommendationProviderOptions,
  OpenAiResponsesClient,
  RecommendationProvider
} from "./types.js";

const defaultOpenAiModel = "gpt-4.1-mini";
const defaultOpenAiMaxSuggestions = 9;
const maxAllowedSuggestions = 25;

// OpenAI 구조화 출력 스키마를 추천 개수에 맞게 생성합니다.
function buildKeywordSuggestionJsonSchema(maxSuggestions: number) {
  return {
    additionalProperties: false,
    properties: {
      suggestions: {
        items: {
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            reason: { type: "string" }
          },
          required: ["label", "reason"],
          type: "object"
        },
        maxItems: maxSuggestions,
        minItems: 1,
        type: "array"
      }
    },
    required: ["suggestions"],
    type: "object"
  } as const;
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
  return value?.trim() || defaultOpenAiModel;
}

// 최대 추천 개수를 안전한 범위로 정규화합니다.
function resolveMaxSuggestions(value: number | undefined) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return defaultOpenAiMaxSuggestions;
  }

  return Math.min(value, maxAllowedSuggestions);
}

// 요청에 포함할 제약/앵커 정보를 OpenAI 입력 텍스트로 구성합니다.
function buildPrompt(context: RecommendationContext, maxSuggestions: number) {
  const anchors = context.anchors.filter(Boolean).slice(0, 20);
  const constraints = context.constraints.filter(Boolean);
  const selectedKeywords = context.selectedKeywords.filter(Boolean).slice(0, 12);
  const objectAnchors = context.objectAnchors.filter(Boolean).slice(0, 12);

  return [
    "You are helping a webtoon creator build episode structure keywords.",
    "Return concise keyword suggestions for the selected node.",
    "Respect creator ownership and avoid finalizing the full story.",
    "",
    `Node level: ${context.nodeLevel}`,
    `Focus: ${context.focus || "(empty)"}`,
    `Node text: ${context.nodeText || "(empty)"}`,
    selectedKeywords.length > 0
      ? `Selected keywords: ${selectedKeywords.join(", ")}`
      : "Selected keywords: (none)",
    objectAnchors.length > 0
      ? `Object anchors: ${objectAnchors.join(" | ")}`
      : "Object anchors: (none)",
    constraints.length > 0
      ? `Constraints: ${constraints.join(" | ")}`
      : "Constraints: (none)",
    anchors.length > 0 ? `Context anchors: ${anchors.join(" | ")}` : "Context anchors: (none)",
    "",
    "Output requirements:",
    `- Provide up to ${maxSuggestions} suggestions.`,
    "- label: short keyword phrase in English.",
    "- reason: one concise sentence in English.",
    "- Keep output strictly in the given JSON schema."
  ].join("\n");
}

// Responses API 요청 페이로드를 구성합니다.
function buildResponsesRequest(
  context: RecommendationContext,
  model: string,
  maxSuggestions: number
) {
  return {
    input: [
      {
        content: buildPrompt(context, maxSuggestions),
        role: "user"
      }
    ],
    model,
    text: {
      format: {
        name: "keyword_suggestions",
        schema: buildKeywordSuggestionJsonSchema(maxSuggestions),
        strict: true,
        type: "json_schema"
      }
    }
  };
}

// 응답 payload에서 output_parsed 값을 추출합니다.
function readOutputParsed(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  return "output_parsed" in payload ? payload.output_parsed : null;
}

// 응답 payload에서 output_text 또는 output.content 텍스트를 추출합니다.
function readOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const directText = normalizeString(payload.output_text);

  if (directText) {
    return directText;
  }

  if (!Array.isArray(payload.output)) {
    return null;
  }

  const chunks: string[] = [];

  for (const outputItem of payload.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (!isRecord(contentItem)) {
        continue;
      }

      const directChunk = normalizeString(contentItem.text);

      if (directChunk) {
        chunks.push(directChunk);
        continue;
      }

      if (isRecord(contentItem.text) && typeof contentItem.text.value === "string") {
        const nestedChunk = normalizeString(contentItem.text.value);

        if (nestedChunk) {
          chunks.push(nestedChunk);
        }
      }
    }
  }

  if (chunks.length === 0) {
    return null;
  }

  return chunks.join("\n");
}

// output_text JSON을 파싱하고 실패 시 표준 에러를 던집니다.
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

// 다양한 응답 형태에서 키워드 구조를 추출합니다.
function extractKeywordSuggestions(
  payload: unknown,
  maxSuggestions: number
): KeywordSuggestion[] {
  const parsedOutput = readOutputParsed(payload);

  if (parsedOutput !== null) {
    return parseKeywordSuggestions(parsedOutput, maxSuggestions);
  }

  const outputText = readOutputText(payload);

  if (!outputText) {
    throw new Error("structured_output_invalid");
  }

  return parseKeywordSuggestions(parseOutputJson(outputText), maxSuggestions);
}

// provider 내부 에러를 표준 코드 메시지로 정규화합니다.
function normalizeProviderError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message === "missing_api_key") {
      return error;
    }

    if (error.message === "structured_output_invalid") {
      return error;
    }
  }

  return new Error("recommendation_failed");
}

// OpenAI 클라이언트를 옵션 기준으로 생성/재사용합니다.
function resolveClient(options: OpenAiRecommendationProviderOptions): OpenAiResponsesClient {
  if (options.client) {
    return options.client;
  }

  const apiKey = normalizeString(options.apiKey);

  if (!apiKey) {
    throw new Error("missing_api_key");
  }

  return new OpenAI({ apiKey }) as unknown as OpenAiResponsesClient;
}

// OpenAI 기반 키워드 추천 provider를 생성합니다.
export function createOpenAiRecommendationProvider(
  options: OpenAiRecommendationProviderOptions
): RecommendationProvider {
  const model = normalizeModel(options.model);
  const maxSuggestions = resolveMaxSuggestions(options.maxSuggestions);
  const fallbackProvider = options.fallbackProvider;

  return {
    async requestKeywords(context) {
      if (!context.focus.trim()) {
        return [];
      }

      try {
        const client = resolveClient(options);
        const payload = await client.responses.create(
          buildResponsesRequest(context, model, maxSuggestions)
        );
        return extractKeywordSuggestions(payload, maxSuggestions);
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
