// 이 파일은 백엔드 Fastify 앱을 조립하고 라우트를 등록합니다.

import Fastify from "fastify";
import { loadRecommendationEnv } from "@scenaairo/recommendation";

import { registerAuthRoutes } from "./auth/routes.js";
import { type GoogleIdTokenVerifier } from "./auth/google-id-token.js";
import { type AuthStore, BackendAuthService } from "./auth/service.js";
import type { MySqlConfig, PersistenceDriver } from "./config/env.js";
import { loadBackendEnv } from "./config/env.js";
import { createBackendLogger } from "./logging/console.js";
import type { BackendLogLevel } from "./logging/console.js";
import {
  registerPersistenceRoutes,
  type PersistenceStore
} from "./persistence/routes.js";
import { registerRecommendationRoutes } from "./recommendation/routes.js";
import {
  probeMySqlReadiness,
  type MySqlReadinessResult
} from "./health/readiness.js";

interface RecommendationRuntimeConfig {
  cacheTtlMs: number;
  fallbackToHeuristicOnError: boolean;
  logLevel: BackendLogLevel;
  maxSuggestions: number;
  model: string;
  provider: string;
  timeoutMs: number;
}

export interface BuildAppOptions {
  authStore?: AuthStore;
  cloudDataDir?: string;
  googleIdTokenVerifier?: GoogleIdTokenVerifier;
  mysqlReadinessProbe?: () => Promise<MySqlReadinessResult>;
  mysql?: Partial<MySqlConfig>;
  persistenceStoreFactories?: {
    createGuestStore?: () => PersistenceStore;
    createMySqlStore?: () => PersistenceStore;
  };
  persistenceDriver?: PersistenceDriver;
  recommendationApiKey?: string | null;
  recommendationConfig?: Partial<RecommendationRuntimeConfig>;
}

// 백엔드 API 앱 인스턴스를 생성합니다.
export function buildApp(options: BuildAppOptions = {}) {
  const env = loadBackendEnv();
  const backendLogger = createBackendLogger({
    level: env.logLevel,
    scope: "backend"
  });
  const app = Fastify({
    logger: false
  });
  const mergedMySqlConfig = {
    ...env.mysql,
    ...options.mysql
  };
  const mysqlReadinessProbe =
    options.mysqlReadinessProbe ??
    (() => probeMySqlReadiness(mergedMySqlConfig, env.mysqlReadinessTimeoutMs));
  const authService = new BackendAuthService({
    cookieName: env.auth.cookieName,
    cookieSameSite: env.auth.cookieSameSite,
    cookieSecure: env.auth.cookieSecure,
    googleClientId: env.auth.googleClientId,
    mysql: mergedMySqlConfig,
    sessionTtlSeconds: env.auth.sessionTtlSeconds,
    ...(options.authStore ? { store: options.authStore } : {}),
    ...(options.googleIdTokenVerifier
      ? { tokenVerifier: options.googleIdTokenVerifier }
      : {})
  });

  if (!authService.isGoogleAuthConfigured()) {
    backendLogger.warn("google_auth_not_configured", {
      endpoint: "/api/auth/google/login",
      hint: "Set GOOGLE_CLIENT_ID in backend/.env"
    });
  }
  const requestStartMsByRequestId = new Map<string, number>();

  if (env.logRequests) {
    app.addHook("onRequest", (request, _reply, done) => {
      requestStartMsByRequestId.set(request.id, Date.now());
      backendLogger.info("request_start", {
        id: request.id,
        method: request.method,
        url: request.url
      });
      done();
    });

    app.addHook("onResponse", (request, reply, done) => {
      const startedAt = requestStartMsByRequestId.get(request.id) ?? Date.now();
      requestStartMsByRequestId.delete(request.id);

      backendLogger.info("request_end", {
        durationMs: Date.now() - startedAt,
        id: request.id,
        method: request.method,
        statusCode: reply.statusCode,
        url: request.url
      });
      done();
    });

    app.addHook("onError", (request, _reply, error, done) => {
      backendLogger.error("request_error", {
        error: error.message,
        id: request.id,
        method: request.method,
        url: request.url
      });
      done();
    });
  }

  app.addHook("onClose", async () => {
    await authService.close();
  });

  void registerAuthRoutes(app, {
    authService
  });

  void registerPersistenceRoutes(app, {
    cloudDataDir: options.cloudDataDir ?? env.cloudDataDir,
    ...(options.persistenceStoreFactories?.createGuestStore
      ? { createGuestStore: options.persistenceStoreFactories.createGuestStore }
      : {}),
    ...(options.persistenceStoreFactories?.createMySqlStore
      ? { createMySqlStore: options.persistenceStoreFactories.createMySqlStore }
      : {}),
    mysql: mergedMySqlConfig,
    persistenceDriver: options.persistenceDriver ?? env.persistenceDriver,
    resolveSessionAccountId: async (request) => {
      return authService.resolveSessionAccountId(request.headers.cookie);
    }
  });

  const recommendationEnv = loadRecommendationEnv();
  const recommendationConfig = {
    cacheTtlMs: recommendationEnv.cacheTtlMs,
    fallbackToHeuristicOnError: recommendationEnv.fallbackToHeuristicOnError,
    logLevel: env.logLevel,
    maxSuggestions: recommendationEnv.maxSuggestions,
    model: recommendationEnv.model,
    provider: recommendationEnv.provider,
    timeoutMs: recommendationEnv.timeoutMs,
    ...options.recommendationConfig
  };
  const recommendationApiKey = options.recommendationApiKey ?? recommendationEnv.apiKey;

  void registerRecommendationRoutes(app, {
    recommendationApiKey,
    recommendationConfig: {
      cacheTtlMs: recommendationConfig.cacheTtlMs,
      fallbackToHeuristicOnError: recommendationConfig.fallbackToHeuristicOnError,
      logLevel: recommendationConfig.logLevel,
      maxSuggestions: recommendationConfig.maxSuggestions,
      model: recommendationConfig.model,
      provider: recommendationConfig.provider,
      timeoutMs: recommendationConfig.timeoutMs
    }
  });

  app.get("/api/health", async () => {
    return {
      environment: env.appEnv,
      service: "backend" as const,
      status: "ok" as const
    };
  });

  app.get("/api/health/readiness", async (_request, reply) => {
    const mysqlReadiness = await mysqlReadinessProbe();
    const googleAuthConfigured = authService.isGoogleAuthConfigured();
    const status = mysqlReadiness.reachable && googleAuthConfigured ? "ready" : "degraded";

    return reply.status(status === "ready" ? 200 : 503).send({
      checks: {
        googleAuthConfigured,
        mysql: mysqlReadiness
      },
      environment: env.appEnv,
      service: "backend" as const,
      status
    });
  });

  return app;
}
