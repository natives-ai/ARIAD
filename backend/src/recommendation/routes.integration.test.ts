// 이 파일은 recommendation API 라우트의 통합 동작과 env 연동을 검증합니다.
import { afterEach, describe, expect, it } from "vitest";
import type {
  KeywordRecommendationRequest,
  SentenceRecommendationRequest
} from "@scenaairo/recommendation";

import { buildApp } from "../app.js";

const recommendationEnvKeys = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "RECOMMENDATION_API_KEY",
  "RECOMMENDATION_PROVIDER",
  "RECOMMENDATION_MODEL",
  "RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR",
  "RECOMMENDATION_TIMEOUT_MS",
  "RECOMMENDATION_CACHE_TTL_MS",
  "RECOMMENDATION_MAX_SUGGESTIONS"
] as const;

// recommendation 관련 env 값을 스냅샷합니다.
function snapshotRecommendationEnv() {
  return Object.fromEntries(
    recommendationEnvKeys.map((key) => [key, process.env[key]])
  ) as Record<(typeof recommendationEnvKeys)[number], string | undefined>;
}

// recommendation 관련 env 값을 스냅샷으로 복원합니다.
function restoreRecommendationEnv(
  snapshot: Record<(typeof recommendationEnvKeys)[number], string | undefined>
) {
  for (const key of recommendationEnvKeys) {
    const value = snapshot[key];

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

describe("recommendation routes integration", () => {
  const appsToClose: ReturnType<typeof buildApp>[] = [];
  const initialEnv = snapshotRecommendationEnv();

  afterEach(async () => {
    await Promise.all(appsToClose.map((app) => app.close()));
    appsToClose.length = 0;
    restoreRecommendationEnv(initialEnv);
  });

  it("returns a full keyword cloud for an explicit keyword request", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies KeywordRecommendationRequest,
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().suggestions).toHaveLength(10);
  });

  it("gates sentence suggestions until the user has selected at least one keyword", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const blockedResponse = await app.inject({
      method: "POST",
      payload: {
        selectedKeywords: [],
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "detail",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure"],
          parentSummary: "rising pressure",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies SentenceRecommendationRequest,
      url: "/api/recommendation/sentences"
    });

    expect(blockedResponse.statusCode).toBe(400);
    expect(blockedResponse.json()).toEqual({
      message: "selected_keywords_required"
    });
  });

  it("returns three sentence suggestions after the user selects keywords", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        selectedKeywords: ["rising pressure", "defensive reply"],
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: ["rising pressure", "defensive reply"],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies SentenceRecommendationRequest,
      url: "/api/recommendation/sentences"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().suggestions).toHaveLength(3);
    expect(response.json().suggestions[0].text).toContain("pressure");
  });

  it("returns missing_api_key when openai provider is selected without API key", async () => {
    const app = buildApp({
      recommendationApiKey: null,
      recommendationConfig: {
        fallbackToHeuristicOnError: false,
        model: "baseline",
        provider: "openai"
      }
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies KeywordRecommendationRequest,
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: "missing_api_key"
    });
  });

  it("returns missing_api_key when gemini provider is selected without API key", async () => {
    const app = buildApp({
      recommendationApiKey: null,
      recommendationConfig: {
        fallbackToHeuristicOnError: false,
        model: "gemini-2.5-flash",
        provider: "gemini"
      }
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies KeywordRecommendationRequest,
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: "missing_api_key"
    });
  });

  it("returns unsupported_provider when unknown provider is configured", async () => {
    const app = buildApp({
      recommendationApiKey: "test-key",
      recommendationConfig: {
        fallbackToHeuristicOnError: false,
        model: "baseline",
        provider: "unknown-provider"
      }
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies KeywordRecommendationRequest,
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: "unsupported_provider"
    });
  });

  it("uses loadRecommendationEnv values when buildApp options are omitted", async () => {
    process.env.RECOMMENDATION_PROVIDER = "openai";
    process.env.RECOMMENDATION_MODEL = "gpt-4.1-mini";
    process.env.RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR = "false";
    delete process.env.OPENAI_API_KEY;
    delete process.env.RECOMMENDATION_API_KEY;

    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies KeywordRecommendationRequest,
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: "missing_api_key"
    });
  });

  it("falls back to heuristic suggestions when fallback env flag is true", async () => {
    process.env.RECOMMENDATION_PROVIDER = "openai";
    process.env.RECOMMENDATION_MODEL = "gpt-4.1-mini";
    process.env.RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR = "true";
    delete process.env.OPENAI_API_KEY;
    delete process.env.RECOMMENDATION_API_KEY;

    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies KeywordRecommendationRequest,
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().suggestions).toHaveLength(10);
  });

  it("falls back to heuristic suggestions when gemini env is selected and key is missing", async () => {
    process.env.RECOMMENDATION_PROVIDER = "gemini";
    process.env.RECOMMENDATION_MODEL = "gemini-2.5-flash";
    process.env.RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR = "true";
    delete process.env.GEMINI_API_KEY;
    delete process.env.RECOMMENDATION_API_KEY;

    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies KeywordRecommendationRequest,
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().suggestions).toHaveLength(10);
  });

  it("applies maxSuggestions limit to keyword responses", async () => {
    const app = buildApp({
      recommendationConfig: {
        maxSuggestions: 8
      }
    });
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: {
          episodeEndpoint: "The heroine's mother orders the lead away.",
          episodeObjective: "Bridge the tense meeting to the episode hook.",
          existingKeywords: [],
          lockedFacts: ["The heroine's mother intervenes at the end."],
          nodeLevel: "minor",
          nodeText: "",
          objectAnchors: ["Mother: authority pressure", "Cafe: public exposure"],
          parentSummary: "meeting, pressure, hesitation",
          projectSummary: "A weekly workspace for episode structure.",
          projectTitle: "Cafe Confrontation"
        }
      } satisfies KeywordRecommendationRequest,
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().suggestions).toHaveLength(8);
  });
});

