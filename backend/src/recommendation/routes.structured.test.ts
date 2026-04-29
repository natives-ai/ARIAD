// 이 파일은 추천 라우트의 structured context 검증을 확인합니다.
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";

// 테스트에서 공통으로 사용할 legacy story payload를 생성합니다.
function createStoryPayload() {
  return {
    episodeEndpoint: "The heroine's mother orders the lead away.",
    episodeObjective: "Bridge the tense meeting to the episode hook.",
    existingKeywords: [],
    lockedFacts: ["The heroine's mother intervenes at the end."],
    nodeLevel: "minor",
    nodeText: "Mother notices the hesitation.",
    objectAnchors: ["Mother: authority pressure"],
    parentSummary: "meeting, pressure, hesitation",
    projectSummary: "A weekly workspace for episode structure.",
    projectTitle: "Cafe Confrontation"
  };
}

// structured context 기본 payload를 생성합니다.
function createStructuredContext(rankedItems: unknown[] = []) {
  return {
    currentNode: {
      id: "node-current",
      keywords: ["hesitation"],
      level: "minor",
      role: "current",
      text: "Mother notices the hesitation."
    },
    directConnections: [],
    episodeContext: {
      endpoint: "The heroine's mother orders the lead away.",
      objective: "Bridge the tense meeting to the episode hook.",
      title: "Cafe Confrontation"
    },
    language: "en",
    majorLaneFlow: [],
    maxSuggestions: 9,
    nodeLevel: "minor",
    objectContext: [],
    rankedItems,
    selectedKeywords: []
  };
}

describe("recommendation structured route validation", () => {
  const appsToClose: ReturnType<typeof buildApp>[] = [];

  afterEach(async () => {
    await Promise.all(appsToClose.map((app) => app.close()));
    appsToClose.length = 0;
    vi.restoreAllMocks();
  });

  it("rejects malformed structured keyword context", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: createStoryPayload(),
        structuredContext: {
          currentNode: null
        }
      },
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: "structured_context_invalid"
    });
  });

  it("rejects malformed ranked structured context items", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        story: createStoryPayload(),
        structuredContext: createStructuredContext([null])
      },
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: "structured_context_invalid"
    });
  });

  it("rejects invalid keyword cache bypass flags", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        cacheBypass: "yes",
        story: createStoryPayload()
      },
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: "cache_bypass_invalid"
    });
  });

  it("skips keyword route cache hits when cache bypass is true", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const app = buildApp({
      recommendationConfig: {
        cacheTtlMs: 60_000,
        logLevel: "info",
        provider: "heuristic"
      }
    });
    const story = {
      ...createStoryPayload(),
      projectTitle: "Cache Bypass Route Test"
    };
    appsToClose.push(app);
    await app.ready();

    await app.inject({
      method: "POST",
      payload: {
        story
      },
      url: "/api/recommendation/keywords"
    });
    await app.inject({
      method: "POST",
      payload: {
        story
      },
      url: "/api/recommendation/keywords"
    });

    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("keyword_cache_hit"))).toBe(
      true
    );

    logSpy.mockClear();

    await app.inject({
      method: "POST",
      payload: {
        cacheBypass: true,
        story
      },
      url: "/api/recommendation/keywords"
    });

    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("keyword_cache_hit"))).toBe(
      false
    );
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("keyword_cache_bypass"))).toBe(
      true
    );
  });

  it("allows zero keyword suggestions when all cloud slots are filled", async () => {
    const app = buildApp();
    appsToClose.push(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      payload: {
        maxSuggestions: 0,
        story: createStoryPayload()
      },
      url: "/api/recommendation/keywords"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      suggestions: []
    });
  });
});
