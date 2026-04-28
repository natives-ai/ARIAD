// 이 파일은 추천 API 라우트에서 provider 선택과 오류 응답 매핑을 처리합니다.

import type { FastifyInstance } from "fastify";
import type {
  KeywordRecommendationRequest,
  KeywordRecommendationResponse,
  SentenceRecommendationRequest
} from "@scenaairo/recommendation";
import {
  createHeuristicRecommendationProvider,
  createRecommendationProvider,
  createRecommendationService
} from "@scenaairo/recommendation";

import type { BackendLogger, BackendLogLevel } from "../logging/console.js";
import { createBackendLogger } from "../logging/console.js";

interface RecommendationRuntimeConfig {
  cacheTtlMs: number;
  fallbackToHeuristicOnError: boolean;
  logLevel: BackendLogLevel;
  maxSuggestions: number;
  model: string;
  provider: string;
  timeoutMs: number;
}

interface RegisterRecommendationRoutesOptions {
  recommendationApiKey: string | null;
  recommendationConfig: RecommendationRuntimeConfig;
}

interface RecommendationRouteMetrics {
  cacheHit: number;
  cacheMiss: number;
  fallback: number;
  timeout: number;
}

interface KeywordCacheEntry {
  expiresAt: number;
  response: KeywordRecommendationResponse;
}

const keywordCache = new Map<string, KeywordCacheEntry>();
const recommendationRouteMetrics: RecommendationRouteMetrics = {
  cacheHit: 0,
  cacheMiss: 0,
  fallback: 0,
  timeout: 0
};

// 선택 숫자 필드가 비어 있거나 유한한 숫자인지 확인합니다.
function isOptionalFiniteNumber(value: unknown) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

// 추천 오류 메시지에 따라 HTTP 상태 코드를 결정합니다.
function resolveRecommendationErrorStatus(message: string) {
  if (message === "missing_api_key" || message === "unsupported_provider") {
    return 500;
  }

  if (message === "recommendation_timeout") {
    return 504;
  }

  if (
    message === "invalid_api_key" ||
    message === "recommendation_failed" ||
    message === "structured_output_invalid" ||
    message === "upstream_connection_error"
  ) {
    return 502;
  }

  return 400;
}

// 예외 객체를 추천 오류 코드 문자열로 정규화합니다.
function toRecommendationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "recommendation_failed";
}

// 키워드 추천 개수를 유효 범위(1~25)로 정규화합니다.
function resolveMaxSuggestions(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    return 9;
  }

  return Math.min(value, 25);
}

// request 값과 서버 상한을 함께 적용해 실제 키워드 개수를 계산합니다.
function resolveRequestMaxSuggestions(
  requestValue: number | undefined,
  serverValue: number
) {
  const serverMaxSuggestions = resolveMaxSuggestions(serverValue);

  if (requestValue === undefined) {
    return serverMaxSuggestions;
  }

  if (!Number.isInteger(requestValue) || requestValue < 0) {
    return serverMaxSuggestions;
  }

  return Math.min(requestValue, serverMaxSuggestions);
}

// 키워드 응답을 최대 개수 제한에 맞춰 잘라 반환합니다.
function trimKeywordSuggestions(
  response: KeywordRecommendationResponse,
  maxSuggestions: number
): KeywordRecommendationResponse {
  return {
    suggestions: response.suggestions.slice(0, maxSuggestions)
  };
}

// structured recommendation context의 최소 shape를 검증합니다.
function hasValidStructuredContext(body: KeywordRecommendationRequest | SentenceRecommendationRequest) {
  if (body.structuredContext === undefined) {
    return true;
  }

  const context = body.structuredContext;

  if (typeof context !== "object" || context === null) {
    return false;
  }

  const validNodeLevels = new Set(["major", "minor", "detail"]);
  const validLanguages = new Set(["en", "ko", "ja"]);
  const validRankedSources = new Set(["node", "object", "episode", "flow"]);
  const validRankedRoles = new Set([
    "attached-object",
    "child",
    "current",
    "episode-endpoint",
    "episode-objective",
    "major-flow",
    "parent",
    "same-lane-after",
    "same-lane-before"
  ]);
  const hasValidRankedItems =
    Array.isArray(context.rankedItems) &&
    context.rankedItems.length <= 40 &&
    context.rankedItems.every((item) => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        item.id.trim().length > 0 &&
        validRankedSources.has(item.source) &&
        validRankedRoles.has(item.role) &&
        typeof item.priorityScore === "number" &&
        Number.isFinite(item.priorityScore) &&
        item.priorityScore >= 0 &&
        item.priorityScore <= 1 &&
        typeof item.text === "string" &&
        item.text.length <= 1200 &&
        Array.isArray(item.keywords) &&
        item.keywords.every((keyword) => typeof keyword === "string") &&
        (item.objectIds === undefined ||
          (Array.isArray(item.objectIds) &&
            item.objectIds.every((objectId) => typeof objectId === "string"))) &&
        (item.level === undefined || validNodeLevels.has(item.level)) &&
        isOptionalFiniteNumber(item.distance) &&
        isOptionalFiniteNumber(item.canvasY) &&
        isOptionalFiniteNumber(item.orderIndex)
      );
    });

  return (
    typeof context.currentNode?.id === "string" &&
    validNodeLevels.has(context.currentNode.level) &&
    context.currentNode.role === "current" &&
    Array.isArray(context.directConnections) &&
    Array.isArray(context.majorLaneFlow) &&
    typeof context.episodeContext?.title === "string" &&
    Array.isArray(context.objectContext) &&
    hasValidRankedItems &&
    Array.isArray(context.selectedKeywords) &&
    validLanguages.has(context.language) &&
    validNodeLevels.has(context.nodeLevel) &&
    Number.isInteger(context.maxSuggestions) &&
    context.maxSuggestions >= 0
  );
}

// 요청/모델 기준으로 키워드 캐시 키를 생성합니다.
function buildKeywordCacheKey(
  body: KeywordRecommendationRequest,
  options: RegisterRecommendationRoutesOptions,
  maxSuggestions: number
) {
  return JSON.stringify({
    maxSuggestions,
    model: options.recommendationConfig.model,
    provider: options.recommendationConfig.provider,
    selectedKeywords: body.selectedKeywords ?? [],
    story: body.story,
    structuredContext: body.structuredContext ?? null
  });
}

// 현재 시각 기준으로 만료되지 않은 캐시를 조회합니다.
function readKeywordCache(cacheKey: string) {
  const entry = keywordCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    keywordCache.delete(cacheKey);
    return null;
  }

  return entry.response;
}

// TTL 정책에 따라 키워드 응답을 메모리 캐시에 저장합니다.
function writeKeywordCache(cacheKey: string, response: KeywordRecommendationResponse, ttlMs: number) {
  if (ttlMs <= 0) {
    return;
  }

  keywordCache.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    response
  });
}

// timeout 설정값에 맞춰 비동기 추천 호출을 제한합니다.
async function runWithTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return operation;
  }

  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("recommendation_timeout"));
    }, timeoutMs);

    operation
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// 추천 경로에서 관측성 로그를 일관된 형식으로 남깁니다.
function logRecommendationEvent(
  logger: BackendLogger,
  event: string,
  metadata: Record<string, unknown>
) {
  logger.info(event, {
    ...metadata,
    metrics: recommendationRouteMetrics
  });
}

// recommendation 설정을 바탕으로 provider를 생성합니다.
function createRecommendationServiceAccessor(options: RegisterRecommendationRoutesOptions) {
  let service: ReturnType<typeof createRecommendationService> | null = null;
  let initErrorMessage: string | null = null;

  return () => {
    if (service) {
      return service;
    }

    if (initErrorMessage) {
      throw new Error(initErrorMessage);
    }

    try {
      const provider = createRecommendationProvider({
        apiKey: options.recommendationApiKey,
        cacheTtlMs: options.recommendationConfig.cacheTtlMs,
        fallbackToHeuristicOnError: options.recommendationConfig.fallbackToHeuristicOnError,
        maxSuggestions: options.recommendationConfig.maxSuggestions,
        model: options.recommendationConfig.model,
        provider: options.recommendationConfig.provider,
        timeoutMs: options.recommendationConfig.timeoutMs
      });

      service = createRecommendationService(provider);
      return service;
    } catch (error) {
      initErrorMessage = toRecommendationErrorMessage(error);
      throw new Error(initErrorMessage);
    }
  };
}

// timeout fallback에 사용할 휴리스틱 서비스 접근자를 제공합니다.
function createHeuristicRecommendationServiceAccessor(maxSuggestions: number) {
  let service: ReturnType<typeof createRecommendationService> | null = null;

  return () => {
    if (service) {
      return service;
    }

    service = createRecommendationService(
      createHeuristicRecommendationProvider({
        maxSuggestions
      })
    );
    return service;
  };
}

// 추천 키워드/문장 라우트를 Fastify 앱에 등록합니다.
export async function registerRecommendationRoutes(
  app: FastifyInstance,
  options: RegisterRecommendationRoutesOptions
) {
  const recommendationLogger = createBackendLogger({
    level: options.recommendationConfig.logLevel,
    scope: "recommendation"
  });
  const getRecommendationService = createRecommendationServiceAccessor(options);
  const getHeuristicRecommendationService = createHeuristicRecommendationServiceAccessor(
    resolveMaxSuggestions(options.recommendationConfig.maxSuggestions)
  );

  app.post("/api/recommendation/keywords", async (request, reply) => {
    const body = request.body as KeywordRecommendationRequest;
    const startedAt = Date.now();

    if (!body?.story) {
      return reply.status(400).send({
        message: "story is required"
      });
    }

    if (!hasValidStructuredContext(body)) {
      return reply.status(400).send({
        message: "structured_context_invalid"
      });
    }

    const maxSuggestions = resolveRequestMaxSuggestions(
      body.maxSuggestions,
      options.recommendationConfig.maxSuggestions
    );
    const cacheKey = buildKeywordCacheKey(body, options, maxSuggestions);
    const cachedResponse = readKeywordCache(cacheKey);

    if (cachedResponse) {
      recommendationRouteMetrics.cacheHit += 1;
      logRecommendationEvent(recommendationLogger, "keyword_cache_hit", {
        durationMs: Date.now() - startedAt,
        model: options.recommendationConfig.model,
        provider: options.recommendationConfig.provider
      });
      return cachedResponse;
    }

    recommendationRouteMetrics.cacheMiss += 1;

    try {
      const service = getRecommendationService();
      const response = await runWithTimeout(
        service.getKeywordSuggestions(body),
        options.recommendationConfig.timeoutMs
      );
      const trimmedResponse = trimKeywordSuggestions(response, maxSuggestions);

      writeKeywordCache(cacheKey, trimmedResponse, options.recommendationConfig.cacheTtlMs);
      logRecommendationEvent(recommendationLogger, "keyword_success", {
        durationMs: Date.now() - startedAt,
        model: options.recommendationConfig.model,
        provider: options.recommendationConfig.provider
      });
      return trimmedResponse;
    } catch (error) {
      const message = toRecommendationErrorMessage(error);

      if (
        message === "recommendation_timeout" &&
        options.recommendationConfig.fallbackToHeuristicOnError
      ) {
        recommendationRouteMetrics.timeout += 1;
        recommendationRouteMetrics.fallback += 1;
        const fallbackService = getHeuristicRecommendationService();
        const fallbackResponse = trimKeywordSuggestions(
          await fallbackService.getKeywordSuggestions(body),
          maxSuggestions
        );

        writeKeywordCache(cacheKey, fallbackResponse, options.recommendationConfig.cacheTtlMs);
        logRecommendationEvent(recommendationLogger, "keyword_timeout_fallback", {
          durationMs: Date.now() - startedAt,
          model: options.recommendationConfig.model,
          provider: options.recommendationConfig.provider
        });
        return fallbackResponse;
      }

      if (message === "recommendation_timeout") {
        recommendationRouteMetrics.timeout += 1;
      }

      logRecommendationEvent(recommendationLogger, "keyword_error", {
        durationMs: Date.now() - startedAt,
        error: message,
        model: options.recommendationConfig.model,
        provider: options.recommendationConfig.provider
      });
      return reply.status(resolveRecommendationErrorStatus(message)).send({
        message
      });
    }
  });

  app.post("/api/recommendation/sentences", async (request, reply) => {
    const body = request.body as SentenceRecommendationRequest;
    const startedAt = Date.now();

    if (!body?.story) {
      return reply.status(400).send({
        message: "story is required"
      });
    }

    if (!hasValidStructuredContext(body)) {
      return reply.status(400).send({
        message: "structured_context_invalid"
      });
    }

    if (!Array.isArray(body.selectedKeywords) || body.selectedKeywords.length === 0) {
      return reply.status(400).send({
        message: "selected_keywords_required"
      });
    }

    try {
      const service = getRecommendationService();
      const response = await runWithTimeout(
        service.getSentenceSuggestions(body),
        options.recommendationConfig.timeoutMs
      );
      logRecommendationEvent(recommendationLogger, "sentence_success", {
        durationMs: Date.now() - startedAt,
        model: options.recommendationConfig.model,
        provider: options.recommendationConfig.provider
      });
      return response;
    } catch (error) {
      const message = toRecommendationErrorMessage(error);

      if (
        message === "recommendation_timeout" &&
        options.recommendationConfig.fallbackToHeuristicOnError
      ) {
        recommendationRouteMetrics.timeout += 1;
        recommendationRouteMetrics.fallback += 1;
        const fallbackService = getHeuristicRecommendationService();
        const fallbackResponse = await fallbackService.getSentenceSuggestions(body);

        logRecommendationEvent(recommendationLogger, "sentence_timeout_fallback", {
          durationMs: Date.now() - startedAt,
          model: options.recommendationConfig.model,
          provider: options.recommendationConfig.provider
        });
        return fallbackResponse;
      }

      if (message === "recommendation_timeout") {
        recommendationRouteMetrics.timeout += 1;
      }

      logRecommendationEvent(recommendationLogger, "sentence_error", {
        durationMs: Date.now() - startedAt,
        error: message,
        model: options.recommendationConfig.model,
        provider: options.recommendationConfig.provider
      });
      return reply.status(resolveRecommendationErrorStatus(message)).send({
        message
      });
    }
  });
}
