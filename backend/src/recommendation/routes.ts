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

// 키워드 응답을 최대 개수 제한에 맞춰 잘라 반환합니다.
function trimKeywordSuggestions(
  response: KeywordRecommendationResponse,
  maxSuggestions: number
): KeywordRecommendationResponse {
  return {
    suggestions: response.suggestions.slice(0, resolveMaxSuggestions(maxSuggestions))
  };
}

// 요청/모델 기준으로 키워드 캐시 키를 생성합니다.
function buildKeywordCacheKey(
  body: KeywordRecommendationRequest,
  options: RegisterRecommendationRoutesOptions
) {
  return JSON.stringify({
    maxSuggestions: resolveMaxSuggestions(options.recommendationConfig.maxSuggestions),
    model: options.recommendationConfig.model,
    provider: options.recommendationConfig.provider,
    story: body.story
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
        fallbackToHeuristicOnError: options.recommendationConfig.fallbackToHeuristicOnError,
        model: options.recommendationConfig.model,
        provider: options.recommendationConfig.provider
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

    const maxSuggestions = resolveMaxSuggestions(options.recommendationConfig.maxSuggestions);
    const cacheKey = buildKeywordCacheKey(body, options);
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
