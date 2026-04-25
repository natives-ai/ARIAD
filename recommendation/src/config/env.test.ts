// 이 파일은 recommendation 환경 변수 파서의 우선순위와 기본값을 검증합니다.
import { afterEach, describe, expect, it } from "vitest";

import { loadRecommendationEnv } from "./env.js";

// 테스트가 건드리는 recommendation env 키 목록을 정의합니다.
const envKeys = [
  "APP_ENV",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "RECOMMENDATION_API_KEY",
  "RECOMMENDATION_CACHE_TTL_MS",
  "RECOMMENDATION_PROVIDER",
  "RECOMMENDATION_MODEL",
  "RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR",
  "RECOMMENDATION_MAX_SUGGESTIONS",
  "RECOMMENDATION_TIMEOUT_MS"
] as const;

// 현재 프로세스 env 스냅샷을 생성합니다.
function snapshotEnv() {
  return Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
    (typeof envKeys)[number],
    string | undefined
  >;
}

// 스냅샷 값으로 env를 복원합니다.
function restoreEnv(snapshot: Record<(typeof envKeys)[number], string | undefined>) {
  for (const key of envKeys) {
    const value = snapshot[key];

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

describe("loadRecommendationEnv", () => {
  const initialEnv = snapshotEnv();

  afterEach(() => {
    restoreEnv(initialEnv);
  });

  it("uses OPENAI_API_KEY first when provider is openai", () => {
    process.env.RECOMMENDATION_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "openai-priority";
    process.env.RECOMMENDATION_API_KEY = "recommendation-fallback";

    const env = loadRecommendationEnv();

    expect(env.apiKey).toBe("openai-priority");
    expect(env.apiKeyName).toBe("OPENAI_API_KEY");
  });

  it("uses GEMINI_API_KEY first when provider is gemini", () => {
    process.env.RECOMMENDATION_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-priority";
    process.env.RECOMMENDATION_API_KEY = "recommendation-fallback";
    process.env.OPENAI_API_KEY = "openai-should-not-be-used";

    const env = loadRecommendationEnv();

    expect(env.apiKey).toBe("gemini-priority");
    expect(env.apiKeyName).toBe("GEMINI_API_KEY");
  });

  it("falls back to RECOMMENDATION_API_KEY when provider-specific key is missing", () => {
    process.env.RECOMMENDATION_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;
    process.env.RECOMMENDATION_API_KEY = "recommendation-fallback";

    const env = loadRecommendationEnv();

    expect(env.apiKey).toBe("recommendation-fallback");
    expect(env.apiKeyName).toBe("RECOMMENDATION_API_KEY");
  });

  it("uses unified defaults for provider/model/fallback", () => {
    delete process.env.RECOMMENDATION_PROVIDER;
    delete process.env.RECOMMENDATION_MODEL;
    delete process.env.RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR;
    delete process.env.RECOMMENDATION_TIMEOUT_MS;
    delete process.env.RECOMMENDATION_CACHE_TTL_MS;
    delete process.env.RECOMMENDATION_MAX_SUGGESTIONS;

    const env = loadRecommendationEnv();

    expect(env.provider).toBe("heuristic");
    expect(env.model).toBe("gpt-4.1-mini");
    expect(env.fallbackToHeuristicOnError).toBe(false);
    expect(env.timeoutMs).toBe(4000);
    expect(env.cacheTtlMs).toBe(30000);
    expect(env.maxSuggestions).toBe(10);
  });

  it("uses gemini default model when provider is gemini", () => {
    process.env.RECOMMENDATION_PROVIDER = "gemini";
    delete process.env.RECOMMENDATION_MODEL;

    const env = loadRecommendationEnv();

    expect(env.provider).toBe("gemini");
    expect(env.model).toBe("gemini-2.5-flash");
  });

  it("parses provider and fallback flag from env", () => {
    process.env.RECOMMENDATION_PROVIDER = "gemini";
    process.env.RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR = "true";
    process.env.RECOMMENDATION_TIMEOUT_MS = "2500";
    process.env.RECOMMENDATION_CACHE_TTL_MS = "15000";
    process.env.RECOMMENDATION_MAX_SUGGESTIONS = "8";

    const env = loadRecommendationEnv();

    expect(env.provider).toBe("gemini");
    expect(env.fallbackToHeuristicOnError).toBe(true);
    expect(env.timeoutMs).toBe(2500);
    expect(env.cacheTtlMs).toBe(15000);
    expect(env.maxSuggestions).toBe(8);
  });
});
