// 이 파일은 recommendation provider factory와 OpenAI/Gemini provider 동작을 검증합니다.
import { describe, expect, it, vi } from "vitest";

import type { RecommendationContext } from "../contracts/index.js";
import { createRecommendationProvider } from "./factory.js";
import { createStaticRecommendationProvider } from "./heuristic.js";
import { createGeminiRecommendationProvider } from "./gemini.js";
import { createOpenAiRecommendationProvider } from "./openai.js";

// 테스트에서 공통으로 사용할 추천 컨텍스트를 생성합니다.
function createContext(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  return {
    anchors: ["Cafe confrontation", "Mother warning"],
    constraints: ["Preserve creator control."],
    focus: "Bridge to an episode hook",
    lockedFacts: ["The mother interrupts at the final beat."],
    nodeLevel: "minor",
    nodeText: "",
    objectAnchors: ["Mother: authority pressure"],
    parentSummary: "Escalating pressure before the confrontation endpoint.",
    selectedKeywords: [],
    ...overrides
  };
}

describe("recommendation provider factory", () => {
  it("returns heuristic provider for heuristic option", async () => {
    const provider = createRecommendationProvider({ provider: "heuristic" });
    const suggestions = await provider.requestKeywords(createContext());

    expect(suggestions).toHaveLength(25);
  });

  it("returns heuristic provider by default", async () => {
    const provider = createRecommendationProvider();
    const suggestions = await provider.requestKeywords(createContext());

    expect(suggestions).toHaveLength(25);
  });

  it("creates gemini provider when configured", async () => {
    const provider = createRecommendationProvider({
      apiKey: "gemini-key",
      geminiClient: {
        models: {
          generateContent: vi.fn(async () => ({
            text: JSON.stringify({
              suggestions: [
                { label: "gemini cue", reason: "Generated from Gemini client." }
              ]
            })
          }))
        }
      },
      provider: "gemini"
    });
    const suggestions = await provider.requestKeywords(createContext());

    expect(suggestions).toEqual([
      { label: "gemini cue", reason: "Generated from Gemini client." }
    ]);
  });

  it("throws unsupported provider errors for unknown provider names", () => {
    expect(() => createRecommendationProvider({ provider: "unsupported-model" })).toThrowError(
      "unsupported_provider"
    );
  });
});

describe("openai provider", () => {
  it("parses structured keyword output from output_parsed", async () => {
    const mockClient = {
      responses: {
        create: vi.fn(async () => ({
          output_parsed: {
            suggestions: [
              { label: "episode hook", reason: "Supports a stronger episode ending beat." },
              { label: "pressure spike", reason: "Keeps tension climbing inside the node." }
            ]
          }
        }))
      }
    };
    const provider = createOpenAiRecommendationProvider({
      apiKey: "test-key",
      client: mockClient,
      model: "gpt-4.1-mini"
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "episode hook", reason: "Supports a stronger episode ending beat." },
      { label: "pressure spike", reason: "Keeps tension climbing inside the node." }
    ]);
  });

  it("parses structured keyword output from output_text JSON", async () => {
    const mockClient = {
      responses: {
        create: vi.fn(async () => ({
          output_text: JSON.stringify({
            suggestions: [
              { label: "hard choice", reason: "Pushes a concrete decision in the scene." }
            ]
          })
        }))
      }
    };
    const provider = createOpenAiRecommendationProvider({
      apiKey: "test-key",
      client: mockClient,
      model: "gpt-4.1-mini"
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "hard choice", reason: "Pushes a concrete decision in the scene." }
    ]);
  });

  it("falls back to fallback provider when structured output is malformed", async () => {
    const mockClient = {
      responses: {
        create: vi.fn(async () => ({
          output_text: "{\"broken\":true}"
        }))
      }
    };
    const fallbackProvider = createStaticRecommendationProvider({
      keywords: [{ label: "fallback cue", reason: "Fallback path is active." }]
    });
    const provider = createOpenAiRecommendationProvider({
      apiKey: "test-key",
      client: mockClient,
      fallbackProvider,
      model: "gpt-4.1-mini"
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "fallback cue", reason: "Fallback path is active." }
    ]);
  });

  it("throws missing_api_key without fallback when key is missing", async () => {
    const provider = createOpenAiRecommendationProvider({
      model: "gpt-4.1-mini"
    });

    await expect(provider.requestKeywords(createContext())).rejects.toThrowError("missing_api_key");
  });

  it("delegates sentence suggestion requests to fallback provider", async () => {
    const fallbackProvider = createStaticRecommendationProvider({
      keywords: [],
      sentences: [
        {
          reason: "Fallback sentence path.",
          text: "A short fallback sentence keeps the user moving."
        }
      ]
    });
    const provider = createOpenAiRecommendationProvider({
      apiKey: "test-key",
      client: {
        responses: {
          create: vi.fn()
        }
      },
      fallbackProvider,
      model: "gpt-4.1-mini"
    });

    await expect(
      provider.requestSentences(
        createContext({
          selectedKeywords: ["pressure"]
        })
      )
    ).resolves.toEqual([
      {
        reason: "Fallback sentence path.",
        text: "A short fallback sentence keeps the user moving."
      }
    ]);
  });
});

describe("gemini provider", () => {
  it("parses keyword output from response text JSON", async () => {
    const provider = createGeminiRecommendationProvider({
      apiKey: "gemini-key",
      client: {
        models: {
          generateContent: vi.fn(async () => ({
            text: JSON.stringify({
              suggestions: [
                { label: "scene pressure", reason: "Adds tension to the current bridge beat." }
              ]
            })
          }))
        }
      },
      model: "gemini-2.5-flash"
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "scene pressure", reason: "Adds tension to the current bridge beat." }
    ]);
  });

  it("parses keyword output from candidate parts", async () => {
    const provider = createGeminiRecommendationProvider({
      apiKey: "gemini-key",
      client: {
        models: {
          generateContent: vi.fn(async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        suggestions: [
                          {
                            label: "emotional pivot",
                            reason: "Turns the moment toward a sharper scene shift."
                          }
                        ]
                      })
                    }
                  ]
                }
              }
            ]
          }))
        }
      },
      model: "gemini-2.5-flash"
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      {
        label: "emotional pivot",
        reason: "Turns the moment toward a sharper scene shift."
      }
    ]);
  });

  it("falls back to fallback provider when output is malformed", async () => {
    const fallbackProvider = createStaticRecommendationProvider({
      keywords: [{ label: "fallback cue", reason: "Fallback path is active." }]
    });
    const provider = createGeminiRecommendationProvider({
      apiKey: "gemini-key",
      client: {
        models: {
          generateContent: vi.fn(async () => ({
            text: "not-json"
          }))
        }
      },
      fallbackProvider,
      model: "gemini-2.5-flash"
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "fallback cue", reason: "Fallback path is active." }
    ]);
  });

  it("enforces maxSuggestions when provider returns too many items", async () => {
    const provider = createGeminiRecommendationProvider({
      apiKey: "gemini-key",
      client: {
        models: {
          generateContent: vi.fn(async () => ({
            text: JSON.stringify({
              suggestions: [
                { label: "cue one", reason: "one" },
                { label: "cue two", reason: "two" },
                { label: "cue three", reason: "three" }
              ]
            })
          }))
        }
      },
      maxSuggestions: 2,
      model: "gemini-2.5-flash"
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "cue one", reason: "one" },
      { label: "cue two", reason: "two" }
    ]);
  });

  it("falls back when the Gemini call times out", async () => {
    const fallbackProvider = createStaticRecommendationProvider({
      keywords: [{ label: "timeout fallback", reason: "Timeout triggered fallback." }]
    });
    const provider = createGeminiRecommendationProvider({
      apiKey: "gemini-key",
      client: {
        models: {
          generateContent: vi.fn(
            async () =>
              await new Promise((resolve) => {
                setTimeout(() => resolve({ text: "{\"suggestions\":[]}" }), 25);
              })
          )
        }
      },
      fallbackProvider,
      timeoutMs: 1
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "timeout fallback", reason: "Timeout triggered fallback." }
    ]);
  });

  it("returns upstream_connection_error when timeout happens without fallback", async () => {
    const provider = createGeminiRecommendationProvider({
      apiKey: "gemini-key",
      client: {
        models: {
          generateContent: vi.fn(
            async () =>
              await new Promise((resolve) => {
                setTimeout(() => resolve({ text: "{\"suggestions\":[]}" }), 25);
              })
          )
        }
      },
      timeoutMs: 1
    });

    await expect(provider.requestKeywords(createContext())).rejects.toThrowError(
      "upstream_connection_error"
    );
  });

  it("reuses cached suggestions for identical requests within TTL", async () => {
    const generateContent = vi.fn(async () => ({
      text: JSON.stringify({
        suggestions: [{ label: "cache hit cue", reason: "Original provider response." }]
      })
    }));
    const provider = createGeminiRecommendationProvider({
      apiKey: "gemini-key",
      cacheTtlMs: 1000,
      client: {
        models: {
          generateContent
        }
      }
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "cache hit cue", reason: "Original provider response." }
    ]);
    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "cache hit cue", reason: "Original provider response." }
    ]);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("refreshes cache after TTL expires", async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          suggestions: [{ label: "cache first", reason: "First provider response." }]
        })
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          suggestions: [{ label: "cache second", reason: "Second provider response." }]
        })
      });
    const provider = createGeminiRecommendationProvider({
      apiKey: "gemini-key",
      cacheTtlMs: 1,
      client: {
        models: {
          generateContent
        }
      }
    });

    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "cache first", reason: "First provider response." }
    ]);
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
    await expect(provider.requestKeywords(createContext())).resolves.toEqual([
      { label: "cache second", reason: "Second provider response." }
    ]);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("throws missing_api_key without fallback when key is missing", async () => {
    const provider = createGeminiRecommendationProvider({
      model: "gemini-2.5-flash"
    });

    await expect(provider.requestKeywords(createContext())).rejects.toThrowError("missing_api_key");
  });
});
